import { describe, expect, it } from "vitest";
import {
  mp4MovieDuration,
  validateAnalysisProxyDuration,
} from "./analysis-media";

const box = (type: string, payload: Uint8Array, extended = false) => {
  const header = extended ? 16 : 8;
  const bytes = new Uint8Array(header + payload.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, extended ? 1 : bytes.length);
  bytes.set(
    [...type].map(char => char.charCodeAt(0)),
    4
  );
  if (extended) view.setBigUint64(8, BigInt(bytes.length));
  bytes.set(payload, header);
  return bytes;
};
function movie(seconds: number, version = 0, extended = false) {
  const payload = new Uint8Array(version === 0 ? 100 : 112);
  const view = new DataView(payload.buffer);
  payload[0] = version;
  const scaleOffset = version === 0 ? 12 : 20;
  const durationOffset = version === 0 ? 16 : 24;
  view.setUint32(scaleOffset, 1000);
  if (version === 0) view.setUint32(durationOffset, Math.round(seconds * 1000));
  else view.setBigUint64(durationOffset, BigInt(Math.round(seconds * 1000)));
  const ftyp = box("ftyp", new Uint8Array([105, 115, 111, 109]));
  const mdat = box("mdat", new Uint8Array(9));
  const moov = box("moov", box("mvhd", payload), extended);
  const bytes = new Uint8Array(ftyp.length + mdat.length + moov.length);
  bytes.set(ftyp);
  bytes.set(mdat, ftyp.length);
  bytes.set(moov, ftyp.length + mdat.length);
  return bytes.buffer;
}

describe("full-duration source analysis copies", () => {
  it("reads movie durations across version-0 and extended/version-1 MP4 headers", () => {
    expect(mp4MovieDuration(movie(28.375))).toBe(28.375);
    expect(mp4MovieDuration(movie(7200.25, 1, true))).toBe(7200.25);
  });
  it("rejects a shortened tail but allows codec-frame rounding", () => {
    expect(validateAnalysisProxyDuration(28.375, movie(28.4))).toBe(28.4);
    expect(() => validateAnalysisProxyDuration(28.375, movie(24))).toThrow(
      "complete original duration"
    );
  });
  it("rejects malformed or durationless files and unknown original duration", () => {
    expect(mp4MovieDuration(movie(30).slice(0, 35))).toBeNull();
    expect(() => validateAnalysisProxyDuration(undefined, movie(30))).toThrow(
      "original video duration"
    );
    expect(() =>
      validateAnalysisProxyDuration(30, new Uint8Array([1, 2, 3]).buffer)
    ).toThrow("no readable");
  });
});
