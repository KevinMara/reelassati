import { expect, it, vi } from "vitest";
import { catalogRequest } from "./catalog-request";
it("ends a stalled request, clears its timer, and propagates cancellation", async () => {
  vi.useFakeTimers();
  try {
    let child!: AbortSignal;
    const pending = catalogRequest(signal => {
      child = signal;
      return new Promise(() => {});
    }).catch(e => e);
    await vi.runAllTimersAsync();
    expect(await pending).toMatchObject({ name: "TimeoutError" });
    expect(child.aborted).toBe(true);
    const parent = new AbortController();
    const canceled = catalogRequest(
      () => new Promise(() => {}),
      parent.signal
    ).catch(e => e);
    parent.abort();
    expect(await canceled).toMatchObject({ name: "AbortError" });
    expect(await catalogRequest(async () => "ok")).toBe("ok");
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
