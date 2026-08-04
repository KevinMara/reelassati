import { describe, expect, it } from "vitest";
import {
  embedMediaProvenanceMarker,
  inspectMediaProvenanceMarker,
} from "./media-provenance";

const token = "0123456789abcdef_verified_media_token";

describe("embedded media provenance", () => {
  it("adds and reversibly detects a top-level MP4 UUID marker", () => {
    const original = new Uint8Array([
      0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0,
    ]).buffer;
    const marked = embedMediaProvenanceMarker(original, "video/mp4", token);
    expect(marked?.method).toBe("mp4-uuid-box");

    const inspected = inspectMediaProvenanceMarker(marked!.bytes);
    expect(inspected?.token).toBe(token);
    expect(new Uint8Array(inspected!.unmarkedBytes)).toEqual(
      new Uint8Array(original)
    );
  });

  it("adds and reversibly detects an MP3 ID3 private frame", () => {
    const original = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 1, 2, 3, 4])
      .buffer;
    const marked = embedMediaProvenanceMarker(original, "audio/mpeg", token);
    expect(marked?.method).toBe("mp3-id3v2-private-frame");

    const inspected = inspectMediaProvenanceMarker(marked!.bytes);
    expect(inspected?.token).toBe(token);
    expect(new Uint8Array(inspected!.unmarkedBytes)).toEqual(
      new Uint8Array(original)
    );
  });

  it("preserves an existing ID3 tag when its marker is removed", () => {
    const original = new Uint8Array([
      0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 4, 1, 2, 3, 4, 0xff, 0xfb, 1, 2,
    ]).buffer;
    const marked = embedMediaProvenanceMarker(original, "audio/mpeg", token);
    const inspected = inspectMediaProvenanceMarker(marked!.bytes);
    expect(new Uint8Array(inspected!.unmarkedBytes)).toEqual(
      new Uint8Array(original)
    );
  });

  it("refuses unsupported generated formats instead of pretending they are marked", () => {
    expect(
      embedMediaProvenanceMarker(
        new Uint8Array([1, 2, 3]).buffer,
        "application/octet-stream",
        token
      )
    ).toBeNull();
  });
});
