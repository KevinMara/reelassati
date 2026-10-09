import type { StillImageInference } from "./still-image-rendering";
import type { StillImageTool } from "./still-image.worker";

export function runStillImageInference(kind: StillImageTool, blob: Blob, signal: AbortSignal, progress: (message: string) => void): Promise<StillImageInference> {
  if (signal.aborted) return Promise.reject(new DOMException("Image processing cancelled.", "AbortError"));
  const worker = new Worker(new URL("./still-image.worker.ts", import.meta.url), { type: "module" });
  return new Promise((resolve, reject) => {
    const finish = () => {
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => { finish(); reject(new DOMException("Image processing cancelled.", "AbortError")); };
    const timeout = window.setTimeout(() => { finish(); reject(new Error("The still-image model took too long. Try a smaller image.")); }, 180_000);
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = () => { finish(); reject(new Error("The local image worker could not start. Reload and try again.")); };
    worker.onmessage = (event: MessageEvent<{ type: string; message?: string; width?: number; height?: number; rgba?: ArrayBuffer; values?: ArrayBuffer }>) => {
      const message = event.data;
      if (message.type === "progress") { progress(message.message || "Processing still image…"); return; }
      finish();
      if (message.type === "result" && message.width && message.height && message.rgba && message.values) {
        resolve({ width: message.width, height: message.height, rgba: new Uint8ClampedArray(message.rgba), values: new Uint8Array(message.values) });
      } else { reject(new Error(message.message || "The still-image model returned an incomplete result.")); }
    };
    worker.postMessage({ kind, blob });
  });
}
