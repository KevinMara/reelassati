import {
  nativeMattes,
  type NativeMatteId,
} from "@contracts/native-motion-mattes";

export interface NativeMatteFrame {
  sheet: ImageBitmap;
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The preview and exporter sample the same lossless sheets on the source clock.
 * Keep one sheet in memory. Each caller owns its reader and awaits one frame at a time. */
export class NativeMatteReader {
  private sheet?: ImageBitmap;
  private sha = "";
  private readonly controller = new AbortController();
  private readonly id: NativeMatteId;
  constructor(id: NativeMatteId) {
    this.id = id;
  }

  async frame(
    progress: number,
    signal?: AbortSignal
  ): Promise<NativeMatteFrame> {
    const source = nativeMattes[this.id];
    const index = Math.round(
      Math.max(0, Math.min(1, progress)) * (source.frames - 1)
    );
    const cells = source.columns * source.rows;
    const sha = source.sheets[Math.floor(index / cells)];
    const signals = [this.controller.signal, ...(signal ? [signal] : [])];
    const active = AbortSignal.any(signals);
    active.throwIfAborted();
    if (!this.sheet || sha !== this.sha) {
      const response = await fetch("/native-mattes/" + sha + ".png", {
        signal: AbortSignal.any([...signals, AbortSignal.timeout(30000)]),
      });
      if (!response.ok)
        throw Error("The transition mask could not load. Try again.");
      const bytes = await response.arrayBuffer();
      const digest = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        n => n.toString(16).padStart(2, "0")
      ).join("");
      if (digest !== sha)
        throw Error("The transition mask changed. Reload the page.");
      const next = await createImageBitmap(
        new Blob([bytes], { type: "image/png" }),
        {
          colorSpaceConversion: "none",
          premultiplyAlpha: "none",
        }
      );
      if (
        active.aborted ||
        next.width !== source.columns * source.width ||
        next.height !== source.rows * source.height
      ) {
        next.close();
        active.throwIfAborted();
        throw Error("Invalid transition mask dimensions");
      }
      this.sheet?.close();
      this.sheet = next;
      this.sha = sha;
    }
    const cell = index % cells;
    return {
      sheet: this.sheet,
      left: (cell % source.columns) * source.width,
      top: Math.floor(cell / source.columns) * source.height,
      width: source.width,
      height: source.height,
    };
  }
  close() {
    this.controller.abort();
    this.sheet?.close();
    this.sheet = undefined;
  }
}
