import { inspectStillImage, assertStillImageDimensions, assertDepthImageDimensions } from "./still-image-bounds";
import { DEPTH_MODEL, PERSON_MODEL, imageModelCache } from "./still-image-models";
import { loadLocalTransformers } from "./local-transformers";

export type StillImageTool = "person" | "depth";
interface InferenceRequest { kind: StillImageTool; blob: Blob }

const runtime = globalThis as unknown as {
  location: Location;
  onmessage: ((event: MessageEvent<InferenceRequest>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

runtime.onmessage = async event => {
  let bitmap: ImageBitmap | undefined;
  try {
    const { kind, blob } = event.data;
    if (kind !== "person" && kind !== "depth") throw new Error("Unknown still-image tool.");
    const header = await inspectStillImage(blob);
    if (kind === "depth") assertDepthImageDimensions(header.width, header.height);
    bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    assertStillImageDimensions(width, height);
    if (kind === "depth") assertDepthImageDimensions(width, height);
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Still-image decoding is unavailable in this browser.");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    bitmap = undefined;
    const rgba = context.getImageData(0, 0, width, height).data;
    const { env, pipeline, RawImage } = await loadLocalTransformers();
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.useBrowserCache = false;
    env.useFSCache = false;
    env.useCustomCache = true;
    env.customCache = imageModelCache(runtime.location.origin);
    if (env.backends.onnx.wasm) {
      env.backends.onnx.wasm.wasmPaths = "/vendor/search/ort/";
      env.backends.onnx.wasm.numThreads = 1;
      env.backends.onnx.wasm.proxy = false;
    }
    const image = new RawImage(new Uint8ClampedArray(rgba), width, height, 4);
    runtime.postMessage({ type: "progress", message: "Loading the local image model…" });
    let values: Uint8Array;
    if (kind === "person") {
      env.localModelPath = PERSON_MODEL.base;
      const segmenter = await pipeline("image-segmentation", PERSON_MODEL.id, {
        dtype: "fp32", device: "wasm", local_files_only: true,
      });
      runtime.postMessage({ type: "progress", message: "Finding the person in this still image…" });
      try {
        const result = await segmenter(image);
        const mask = result[0]?.mask;
        if (!mask || mask.width !== width || mask.height !== height || mask.channels !== 1) throw new Error("The person model returned an invalid mask.");
        values = new Uint8Array(mask.data);
      } finally { await segmenter.dispose(); }
    } else {
      env.localModelPath = DEPTH_MODEL.base;
      const estimator = await pipeline("depth-estimation", DEPTH_MODEL.id, {
        dtype: "q8", device: "wasm", local_files_only: true,
      });
      runtime.postMessage({ type: "progress", message: "Estimating relative depth in this still image…" });
      try {
        // Keep model input within a 518px canvas even for tall/wide originals.
        // DPT's aspect-preserving processor otherwise sometimes fits the shorter side.
        const scale = Math.min(1, 518 / Math.max(width, height));
        const input = await image.resize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
        const result = await estimator(input);
        if (Array.isArray(result) || result.depth.channels !== 1) throw new Error("The depth model returned an invalid map.");
        const depth = await result.depth.resize(width, height);
        values = new Uint8Array(depth.data);
      } finally { await estimator.dispose(); }
    }
    runtime.postMessage({ type: "result", width, height, rgba: rgba.buffer, values: values.buffer }, [rgba.buffer, values.buffer]);
  } catch (cause) {
    runtime.postMessage({ type: "error", message: cause instanceof Error ? cause.message : "The still-image model could not run." });
  } finally { bitmap?.close(); }
};
