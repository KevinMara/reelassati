import type { Asset } from "@contracts/workspace";
import { directVideoType, validateDirectVideoUrl, PUBLIC_VIDEO_MAX_BYTES, PUBLIC_VIDEO_MAX_SECONDS, PUBLIC_VIDEO_TIMEOUT_MS, DIRECT_VIDEO_HELP } from "@contracts/public-video";
import { platformApi, captureUploadRequestScope, verifyUploadRequestScope, type UploadRequestScope } from "./platform-api";

/** Inspect a locally owned blob; loadeddata proves a decodable picture, not just a declared MIME. */
export async function probePlayableVideo(blob: Blob, signal?: AbortSignal): Promise<{ duration: number; width: number; height: number }> {
  signal?.throwIfAborted();
  const objectUrl = URL.createObjectURL(blob);
  const video = document.createElement("video");
  try {
    return await new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        video.onloadeddata = video.onerror = null;
        video.removeAttribute("src");
        video.load();
      };
      const fail = (error: unknown) => { cleanup(); reject(error); };
      const abort = () => fail(signal?.reason ?? new DOMException("Import cancelled", "AbortError"));
      const timer = setTimeout(() => fail(new Error("The video did not produce a playable picture. Upload a browser-compatible original instead.")), 25_000);
      signal?.addEventListener("abort", abort, { once: true });
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.onloadeddata = () => {
        const { duration, videoWidth: width, videoHeight: height } = video;
        if (!Number.isFinite(duration) || duration <= 0 || duration > PUBLIC_VIDEO_MAX_SECONDS || width <= 0 || height <= 0 || video.readyState < 2) {
          fail(new Error(`Import a playable video up to ${PUBLIC_VIDEO_MAX_SECONDS} seconds. Upload longer originals directly to Library.`));
          return;
        }
        cleanup();
        resolve({ duration, width, height });
      };
      video.onerror = () => fail(new Error("This file could not be decoded as video. Upload a browser-compatible original instead."));
      video.src = objectUrl;
      video.load();
    });
  } finally { URL.revokeObjectURL(objectUrl); }
}

export async function fetchDirectVideo(value: string, signal?: AbortSignal, onProgress?: (detail: string) => void): Promise<{ file: File; duration: number }> {
  const error = validateDirectVideoUrl(value);
  if (error) throw new Error(error);
  const url = new URL(value.trim());
  const timeout = AbortSignal.timeout(PUBLIC_VIDEO_TIMEOUT_MS);
  const boundedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  boundedSignal.throwIfAborted();
  let response: Response;
  try {
    response = await fetch(url.href, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", cache: "no-store", signal: boundedSignal });
  } catch (cause) {
    boundedSignal.throwIfAborted();
    throw new Error(`The final video file could not be downloaded in this browser. ${DIRECT_VIDEO_HELP}`, { cause });
  }
  if (!response.ok || response.type === "opaque" || response.redirected || !response.body || (response.url && response.url !== url.href))
    throw new Error(`The host did not provide the final readable video file. ${DIRECT_VIDEO_HELP}`);
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > PUBLIC_VIDEO_MAX_BYTES) {
    await response.body.cancel();
    throw new Error("Direct video imports are limited to 256 MB. Upload the original to Library instead.");
  }
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  const reader = response.body.getReader();
  let size = 0;
  let prefix = new Uint8Array(0);
  try {
    for (;;) {
      boundedSignal.throwIfAborted();
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > PUBLIC_VIDEO_MAX_BYTES) throw new Error("Direct video imports are limited to 256 MB. Upload the original to Library instead.");
      const chunk = new Uint8Array(item.value);
      chunks.push(chunk);
      if (prefix.length < 4096) {
        const next = new Uint8Array(Math.min(4096, prefix.length + chunk.length));
        next.set(prefix); next.set(chunk.subarray(0, next.length - prefix.length), prefix.length); prefix = next;
        if (prefix.length >= 4096 && !directVideoType(prefix)) throw new Error(`The downloaded bytes are not MP4, MOV or WebM video. ${DIRECT_VIDEO_HELP}`);
      }
      onProgress?.(`Downloading video · ${(size / 1024 / 1024).toFixed(1)} MB`);
    }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  const type = directVideoType(prefix);
  if (!size || !type) throw new Error(`The downloaded bytes are not MP4, MOV or WebM video. ${DIRECT_VIDEO_HELP}`);
  const extension = type === "video/webm" ? "webm" : type === "video/quicktime" ? "mov" : "mp4";
  // No external URL, host, signed query or fragment is persisted in asset metadata.
  const file = new File(chunks, `Imported video.${extension}`, { type });
  onProgress?.("Checking video duration and playable picture…");
  const metadata = await probePlayableVideo(file, boundedSignal);
  boundedSignal.throwIfAborted();
  return { file, duration: metadata.duration };
}

export async function importDirectVideo(value: string, options: { signal?: AbortSignal; scope?: UploadRequestScope; onProgress?: (detail: string) => void } = {}): Promise<Asset> {
  const scope = options.scope ?? await captureUploadRequestScope();
  const media = await fetchDirectVideo(value, options.signal, options.onProgress);
  options.signal?.throwIfAborted();
  await verifyUploadRequestScope(scope);
  const asset = await platformApi.uploadAsset(media.file, "video", percent => options.onProgress?.(`Saving private video · ${percent}%`), undefined, { scope, signal: options.signal });
  options.signal?.throwIfAborted();
  await verifyUploadRequestScope(scope);
  return { ...asset, duration: media.duration };
}
