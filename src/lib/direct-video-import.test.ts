import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDirectVideo, probePlayableVideo } from "./direct-video-import";
import { PUBLIC_VIDEO_MAX_BYTES } from "@contracts/public-video";

const mp4 = new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109,0,0,0,0]);
function fakeVideo(patch: Record<string, unknown> = {}) {
  let src = "";
  const video = { duration: 8.125, videoWidth: 720, videoHeight: 1280, readyState: 2, onloadeddata: null as (() => void) | null, onerror: null as (() => void) | null, removeAttribute: vi.fn(), load: vi.fn(), ...patch, get src() { return src; }, set src(value: string) { src = value; queueMicrotask(() => video.onloadeddata?.()); } };
  vi.stubGlobal("document", { createElement: () => video });
  return video;
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("bounded browser video ingestion", () => {
  it("downloads without browser credentials or referrer and refuses redirects", async () => {
    const video = fakeVideo();
    const fetchMock = vi.fn().mockResolvedValue(new Response(mp4)); vi.stubGlobal("fetch", fetchMock);
    const result = await fetchDirectVideo("https://cdn.test.org/clip.mp4?token=private#fragment");
    expect(fetchMock).toHaveBeenCalledWith("https://cdn.test.org/clip.mp4?token=private", expect.objectContaining({ mode: "cors", credentials: "omit", referrerPolicy: "no-referrer", redirect: "error" }));
    expect(result).toMatchObject({ duration: 8.125, file: { name: "Imported video.mp4", type: "video/mp4" } });
    expect(result.file.name).not.toContain("private");
    expect(video.removeAttribute).toHaveBeenCalledWith("src");
  });
  it("rejects HTML mislabeled as video instead of uploading the page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<!doctype html><title>video</title>", { headers: { "content-type": "video/mp4" } })));
    await expect(fetchDirectVideo("https://cdn.test.org/a.mp4")).rejects.toThrow("downloaded bytes");
  });
  it("cancels oversized streams even if content-length understates the data", async () => {
    let cancelled = false;
    const bytes = new Uint8Array(PUBLIC_VIDEO_MAX_BYTES + 1);
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes); }, cancel() { cancelled = true; } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream, { headers: { "content-length": "1" } })));
    await expect(fetchDirectVideo("https://cdn.test.org/a.mp4")).rejects.toThrow("256 MB");
    expect(cancelled).toBe(true);
  });
  it.each([{ duration: Infinity }, { duration: 121 }, { videoWidth: 0 }, { readyState: 1 }])("requires actual bounded playable picture metadata %j", async metadata => {
    fakeVideo(metadata);
    await expect(probePlayableVideo(new Blob([mp4]))).rejects.toThrow("playable video");
  });
  it("never downloads a social page or starts after cancellation", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(fetchDirectVideo("https://youtube.com/watch?v=1")).rejects.toThrow("Social video pages");
    const controller = new AbortController(); controller.abort();
    await expect(fetchDirectVideo("https://cdn.test.org/a.mp4", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
