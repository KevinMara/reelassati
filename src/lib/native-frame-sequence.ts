import type { NativeFrameProgram } from "@contracts/native-frame-program";
import {
  createNativeFrameRenderer,
  type NativeImageInput,
} from "./native-frame-renderer";

/** Backpressured, deterministic frame source for the existing export engine.
 * Only one decoded pair and one encoded frame are live at a time. The caller
 * owns source clocks, final encoding, source audio and project persistence. */
export async function renderNativeFrameSequence(
  program: NativeFrameProgram,
  size: { width: number; height: number },
  options: {
    signal: AbortSignal;
    loadInputs: (
      frame: number,
      signal: AbortSignal
    ) => Promise<[NativeImageInput, NativeImageInput]>;
    format?: "png" | "rgb24";
    writeFrame: (frame: number, data: Uint8Array) => Promise<void>;
    releaseInputs?: (inputs: [NativeImageInput, NativeImageInput]) => void;
    onProgress?: (frame: number, total: number) => void;
  }
) {
  options.signal.throwIfAborted();
  const canvas = new OffscreenCanvas(size.width, size.height);
  const renderer = createNativeFrameRenderer(canvas, size.width, size.height);
  try {
    for (let frame = 0; frame < program.frames; frame++) {
      options.signal.throwIfAborted();
      const inputs = await options.loadInputs(frame, options.signal);
      try {
        options.signal.throwIfAborted();
        renderer.render(program, inputs, frame);
        let bytes: Uint8Array;
        if (options.format === "rgb24") {
          // Premultiplied float RGB is already composited against black. This
          // avoids PNG alpha unpremultiplication and extra color conversions.
          const rgba = renderer.readFloatFrame();
          bytes = new Uint8Array(size.width * size.height * 3);
          for (let pixel = 0; pixel < size.width * size.height; pixel++)
            for (let c = 0; c < 3; c++)
              bytes[pixel * 3 + c] = Math.round(
                Math.max(0, Math.min(1, rgba[pixel * 4 + c])) * 255
              );
        } else {
          const blob = await canvas.convertToBlob({ type: "image/png" });
          bytes = new Uint8Array(await blob.arrayBuffer());
        }
        options.signal.throwIfAborted();
        await options.writeFrame(frame, bytes);
        options.onProgress?.(frame + 1, program.frames);
      } finally {
        options.releaseInputs?.(inputs);
      }
    }
  } finally {
    renderer.dispose();
  }
}
