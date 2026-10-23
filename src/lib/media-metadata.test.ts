import { afterEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@contracts/workspace";
import { resolveVideoMetadata } from "./media-metadata";

const source = {
  id: "owned",
  name: "Landscape.mp4",
  kind: "video",
  url: "/private-owned-source.mp4",
} as Asset;
function fixture() {
  const media = {
    duration: 28.350708,
    videoWidth: 1920,
    videoHeight: 1080,
    onloadedmetadata: null as (() => void) | null,
    onerror: null as (() => void) | null,
    removeAttribute: vi.fn(),
    load: vi.fn(),
    src: "",
    preload: "",
  };
  const createElement = vi.fn(() => media);
  vi.stubGlobal("document", { createElement });
  return { media, createElement };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("analysis source metadata before charging", () => {
  it("preserves landscape geometry and source-clock precision without changing the asset", async () => {
    const { media } = fixture();
    const result = resolveVideoMetadata(source);
    media.onloadedmetadata!();
    expect(await result).toMatchObject({
      id: source.id,
      duration: 28.350708,
      width: 1920,
      height: 1080,
    });
    expect(source.width).toBeUndefined();
    expect(media.removeAttribute).toHaveBeenCalledWith("src");
    expect(media.load).toHaveBeenCalledOnce();
    expect(media.onloadedmetadata).toBeNull();
  });
  it("uses already measured dimensions without another media request", async () => {
    const { createElement } = fixture();
    const measured = { ...source, duration: 4, width: 1080, height: 1080 };
    expect(await resolveVideoMetadata(measured)).toBe(measured);
    expect(createElement).not.toHaveBeenCalled();
  });
  it("cleans up on cancellation before a source quote can be accepted", async () => {
    vi.useFakeTimers();
    const { media } = fixture();
    const abort = new AbortController();
    const result = resolveVideoMetadata(source, abort.signal);
    abort.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(media.onloadedmetadata).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("fails a bounded stalled load and releases its media source", async () => {
    vi.useFakeTimers();
    const { media } = fixture();
    const result = resolveVideoMetadata(source);
    const rejected = expect(result).rejects.toThrow("source preview");
    await vi.advanceTimersByTimeAsync(15_000);
    await rejected;
    expect(media.removeAttribute).toHaveBeenCalledWith("src");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("refuses missing geometry rather than creating an incorrectly cropped project", async () => {
    const { media } = fixture();
    media.videoWidth = 0;
    const result = resolveVideoMetadata(source);
    media.onloadedmetadata!();
    await expect(result).rejects.toThrow("video metadata");
  });
});
