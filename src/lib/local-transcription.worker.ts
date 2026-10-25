import { loadLocalTransformers } from "./local-transformers";
import { LOCAL_SPEECH_MODEL } from "@contracts/local-speech-model";
import { detectLocalSpeechLanguage } from "./local-speech-language";
self.onmessage = async (
  event: MessageEvent<{ audio: Float32Array; language?: string }>
) => {
  // Each foreground caller creates and owns exactly one disposable worker.
  self.onmessage = null;
  try {
    const { env, pipeline, Tensor } = await loadLocalTransformers();
    env.allowLocalModels = false;
    if (env.backends.onnx.wasm) {
      env.backends.onnx.wasm.numThreads = 1;
      env.backends.onnx.wasm.wasmPaths = "/vendor/search/ort/";
      env.backends.onnx.wasm.proxy = false;
    }
    const transcriber = await pipeline(
      "automatic-speech-recognition",
      LOCAL_SPEECH_MODEL.id,
      {
        dtype: "q8",
        revision: LOCAL_SPEECH_MODEL.revision,
        device: "wasm",
        progress_callback: progress => {
          if ("status" in progress && progress.status === "progress")
            self.postMessage({
              type: "progress",
              file: progress.file,
              percent: Math.round(progress.progress),
            });
        },
      }
    );
    const language =
      event.data.language?.trim() ||
      (await detectLocalSpeechLanguage(transcriber, Tensor, event.data.audio));
    if (import.meta.env.DEV) self.postMessage({ type: "language", language });
    const output = await transcriber(event.data.audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: "word",
      task: "transcribe",
      language,
    });
    self.postMessage({ type: "result", output });
  } catch (error) {
    self.postMessage({
      type: "error",
      message:
        error instanceof Error ? error.message : "Local transcription failed.",
    });
  }
};
