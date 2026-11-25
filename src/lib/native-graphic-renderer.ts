import type { MotionGraphic } from "@contracts/motion-graphics";
export interface NativeGraphicFrame {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}
/** An owned worker, with serialized rendering, cancellation and a deadline.
 * No code, expressions, paths or arbitrary projects are accepted from a user. */
export class NativeGraphicRenderer {
  private worker: Worker;
  private next = 0;
  private closed = false;
  private pending = new Map<
    number,
    {
      resolve: (frame: NativeGraphicFrame) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor() {
    this.worker = new Worker(
      new URL("./native-graphic-worker.ts", import.meta.url),
      { type: "module" }
    );
    this.worker.onmessage = ({ data }) => {
      const task = this.pending.get(data.id);
      if (!task) return;
      clearTimeout(task.timer);
      if (data.phase === "rendering") {
        // Loading the compositor, fonts and source graph has its own deadline.
        // Give the first painted frame the same budget as every later frame.
        task.timer = setTimeout(() => this.close(new Error(
          "The motion frame took too long. Try a smaller export size."
        )), 45_000);
        return;
      }
      this.pending.delete(data.id);
      if (data.error) task.reject(new Error(data.error));
      else task.resolve(data);
    };
    this.worker.onerror = () =>
      this.close(new Error("The motion renderer stopped. Try again."));
  }
  render(
    graphic: MotionGraphic,
    elapsed: number,
    duration: number,
    width: number,
    height: number
  ): Promise<NativeGraphicFrame> {
    if (this.closed)
      return Promise.reject(new Error("The motion renderer is closed"));
    if (this.pending.size >= 4)
      return Promise.reject(new Error("The motion renderer is busy"));
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          this.close(
            new Error(
              "The motion renderer could not prepare the animation in time. Retry the export."
            )
          ),
        120_000
      );
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({
        id,
        graphic,
        elapsed,
        duration,
        width,
        height,
      });
    });
  }
  close(
    error: Error = new DOMException(
      "Animation rendering cancelled",
      "AbortError"
    )
  ) {
    if (this.closed) return;
    this.closed = true;
    this.worker.terminate();
    for (const task of this.pending.values()) {
      clearTimeout(task.timer);
      task.reject(error);
    }
    this.pending.clear();
  }
}
