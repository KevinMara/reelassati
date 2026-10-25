import type { Asset } from "@contracts/workspace";
import { LOCAL_SPEECH_MODEL } from "@contracts/local-speech-model";
import {
  localSpeechSegments,
  type LocalSpeechOutput,
} from "./local-speech-segments";
import {
  platformApi,
  captureUploadRequestScope,
  type UploadRequestScope,
} from "./platform-api";

/** Web Audio decoding cannot be cancelled, but a cancelled caller must stop
 * waiting and must never launch inference or save a late result. */
function whileActive<T>(
  signal: AbortSignal,
  run: () => Promise<T>
): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    Promise.resolve()
      .then(() => {
        signal.throwIfAborted();
        return run();
      })
      .then(resolve, reject)
      .finally(() => {
        signal.removeEventListener("abort", aborted);
      });
  });
}

/** Local inference runs only while this foreground caller owns the worker. */
export async function transcribeMediaLocally(
  asset: Asset,
  language?: string,
  projectId?: string,
  onProgress?: (message: string) => void,
  signal?: AbortSignal,
  requestScope?: UploadRequestScope
) {
  const abort = new AbortController();
  const current = AbortSignal.any([abort.signal, ...(signal ? [signal] : [])]);
  const timeout = window.setTimeout(
    () =>
      abort.abort(
        new DOMException(
          "Local transcription timed out. No paid fallback was started.",
          "TimeoutError"
        )
      ),
    10 * 60_000
  );
  const stop = () =>
    abort.abort(
      new DOMException(
        "The page closed. Local transcription stopped.",
        "AbortError"
      )
    );
  window.addEventListener("pagehide", stop, { once: true });
  let worker: Worker | undefined;
  const terminate = () => worker?.terminate();
  current.addEventListener("abort", terminate, { once: true });
  try {
    current.throwIfAborted();
    const scope =
      requestScope ?? (await whileActive(current, captureUploadRequestScope));
    onProgress?.("Preparing local speech timing…");
    if (asset.duration && asset.duration > LOCAL_SPEECH_MODEL.maxSeconds)
      throw new Error(
        "Local transcription supports clips up to 10 minutes. Use the quoted provider option for longer media."
      );
    const source = await whileActive(current, () =>
      platformApi.downloadAssetBlob(asset.id, current, {
        scope,
      })
    );
    const context = new AudioContext();
    let decoded: AudioBuffer;
    try {
      const bytes = await whileActive(current, () => source.arrayBuffer());
      decoded = await whileActive(current, () =>
        context.decodeAudioData(bytes)
      );
    } finally {
      await context.close();
    }
    current.throwIfAborted();
    if (!Number.isFinite(decoded.duration) || decoded.duration <= 0)
      throw new Error("The media has no decodable audio.");
    if (decoded.duration > LOCAL_SPEECH_MODEL.maxSeconds)
      throw new Error("Local transcription supports clips up to 10 minutes.");
    const offline = new OfflineAudioContext(
        1,
        Math.ceil(decoded.duration * LOCAL_SPEECH_MODEL.sampleRate),
        LOCAL_SPEECH_MODEL.sampleRate
      ),
      node = offline.createBufferSource();
    node.buffer = decoded;
    node.connect(offline.destination);
    node.start();
    let audio: Float32Array<ArrayBuffer>;
    try {
      audio = (
        await whileActive(current, () => offline.startRendering())
      ).getChannelData(0);
    } finally {
      node.stop();
      node.disconnect();
    }
    current.throwIfAborted();
    onProgress?.(
      "Running Whisper locally · first use downloads the speech model…"
    );
    current.throwIfAborted();
    worker = new Worker(
      new URL("./local-transcription.worker.ts", import.meta.url),
      { type: "module" }
    );
    const output = await new Promise<LocalSpeechOutput>((resolve, reject) => {
      const activeWorker = worker!;
      const cleanup = () => {
        current.removeEventListener("abort", aborted);
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        activeWorker.onmessageerror = null;
      };
      const fail = (error: unknown) => {
        cleanup();
        reject(error);
      };
      const aborted = () => fail(current.reason);
      current.addEventListener("abort", aborted, { once: true });
      activeWorker.onerror = activeWorker.onmessageerror = () => {
        fail(
          new Error(
            "The local speech engine could not run in this browser. No paid fallback was started."
          )
        );
      };
      activeWorker.onmessage = event => {
        if (current.aborted) {
          aborted();
          return;
        }
        if (event.data.type === "language" && import.meta.env.DEV)
          console.info(`[local-speech-language] ${event.data.language}`);
        else if (event.data.type === "progress")
          onProgress?.(`Downloading speech model · ${event.data.percent}%`);
        else if (event.data.type === "result") {
          cleanup();
          resolve(
            Array.isArray(event.data.output)
              ? event.data.output[0]
              : event.data.output
          );
        } else if (event.data.type === "error") {
          fail(new Error(event.data.message));
        }
      };
      try {
        current.throwIfAborted();
        activeWorker.postMessage(
          { audio, language: language?.trim() || undefined },
          [audio.buffer]
        );
      } catch (error) {
        fail(error);
      }
    });
    current.throwIfAborted();
    const segments = localSpeechSegments(output, decoded.duration);
    onProgress?.("Saving local speech timing · no AI credits…");
    const result = await whileActive(current, () =>
      platformApi.registerLocalTranscript(
        { assetId: asset.id, projectId, segments },
        { scope, signal: current }
      )
    );
    current.throwIfAborted();
    return result;
  } finally {
    window.clearTimeout(timeout);
    current.removeEventListener("abort", terminate);
    window.removeEventListener("pagehide", stop);
    worker?.terminate();
  }
}
