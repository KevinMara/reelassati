import { describe, expect, it } from "vitest";
import { directVideoType, validateDirectVideoUrl } from "./public-video";

describe("final direct video sources", () => {
  it.each(["https://127.0.0.1/a.mp4", "https://2130706433/a.mp4", "https://0x7f000001/a.mp4", "https://127.1/a.mp4", "https://[::1]/a.mp4", "https://[::ffff:127.0.0.1]/a.mp4", "https://printer.local/a.mp4", "https://secret.internal/a.mp4", "https://localhost./a.mp4", "https://user:secret@cdn.test.org/a.mp4", "http://cdn.test.org/a.mp4", "https://cdn.test.org:9443/a.mp4", "https://youtube.com/watch?v=1", "https://sub.tiktok.com/a.mp4", "https://cdn.test.org/page.html", "https://cdn.test.org/?video=a.mp4"])("rejects unsafe or non-file URL %s", url => { expect(validateDirectVideoUrl(url)).toBeTruthy(); });
  it("accepts a final signed file without exposing its query in metadata", () => { expect(validateDirectVideoUrl("https://cdn.test.org/clip.MP4?sig=private#fragment")).toBeNull(); });
  it("distinguishes video container signatures from HTML and audio-only ISO files", () => {
    expect(directVideoType(new TextEncoder().encode("<!doctype html><html>video.mp4</html>"))).toBeNull();
    expect(directVideoType(new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109]))).toBe("video/mp4");
    expect(directVideoType(new Uint8Array([0,0,0,24,102,116,121,112,113,116,32,32]))).toBe("video/quicktime");
    expect(directVideoType(new Uint8Array([0,0,0,24,102,116,121,112,77,52,65,32]))).toBeNull();
    expect(directVideoType(new Uint8Array([0x1a,0x45,0xdf,0xa3,...new TextEncoder().encode("\0\0webm\0\0")]))).toBe("video/webm");
  });
});
