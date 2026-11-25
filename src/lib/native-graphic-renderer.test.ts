import { afterEach, expect, it, vi } from "vitest";
import { NativeGraphicRenderer } from "./native-graphic-renderer";
import { normalizeGraphic } from "@contracts/motion-graphics";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("allows a cold start, then bounds the painting of each frame", async () => {
  vi.useFakeTimers();
  let worker!: TestWorker;
  class TestWorker {
    onmessage!: (event: { data: unknown }) => void;
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor() { worker = this; }
  }
  vi.stubGlobal("Worker", TestWorker);
  const renderer = new NativeGraphicRenderer();
  const graphic = normalizeGraphic({ kind: "text", text: "Example" })!;
  const first = renderer.render(graphic, 0, 2, 1, 1);
  vi.advanceTimersByTime(65_000);
  expect(worker.terminate).not.toHaveBeenCalled();
  worker.onmessage({ data: { id: 1, phase: "rendering" } });
  vi.advanceTimersByTime(1_000);
  const pixels = new Uint8ClampedArray(4);
  worker.onmessage({ data: { id: 1, pixels, width: 1, height: 1 } });
  await expect(first).resolves.toMatchObject({ pixels });
  const second = renderer.render(graphic, 1, 2, 1, 1);
  const rejected = expect(second).rejects.toThrow("motion frame took too long");
  worker.onmessage({ data: { id: 2, phase: "rendering" } });
  vi.advanceTimersByTime(45_001);
  await rejected;
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});
