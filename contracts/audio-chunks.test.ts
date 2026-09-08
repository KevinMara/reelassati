import { expect, it } from "vitest";
import { pcmWaveDuration } from "./audio-chunks";

it("bills prepared speech from PCM bytes and rejects a false or incomplete WAV header", () => {
  const header = new ArrayBuffer(44);
  const bytes = new Uint8Array(header);
  const view = new DataView(header);
  const put = (offset: number, text: string) =>
    bytes.set(new TextEncoder().encode(text), offset);
  put(0, "RIFF");
  put(8, "WAVE");
  put(12, "fmt ");
  put(36, "data");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(34, 16, true);
  view.setUint32(40, 600 * 32000, true);
  expect(pcmWaveDuration(header, 44 + 600 * 32000)).toBe(600);
  expect(() => pcmWaveDuration(header, 500)).toThrow("Incomplete");
  view.setUint32(28, 1, true);
  expect(() => pcmWaveDuration(header, 44 + 600 * 32000)).toThrow(
    "sample rate"
  );
});
