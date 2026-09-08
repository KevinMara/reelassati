/** Duration from a PCM WAV header, never a client-provided duration claim. */
export function pcmWaveDuration(
  header: ArrayBuffer,
  totalBytes: number
): number {
  const view = new DataView(header);
  const text = (offset: number, count: number) =>
    new TextDecoder().decode(new Uint8Array(header, offset, count));
  if (header.byteLength < 44 || text(0, 4) !== "RIFF" || text(8, 4) !== "WAVE")
    throw new Error("Invalid speech audio");
  let byteRate = 0;
  for (let offset = 12; offset + 8 <= header.byteLength;) {
    const type = text(offset, 4);
    const length = view.getUint32(offset + 4, true);
    if (type === "fmt " && length >= 16 && offset + 24 <= header.byteLength) {
      if (
        view.getUint16(offset + 8, true) !== 1 ||
        view.getUint16(offset + 10, true) !== 1 ||
        view.getUint32(offset + 12, true) !== 16000 ||
        view.getUint16(offset + 22, true) !== 16
      )
        throw new Error("Prepare speech as 16 kHz mono PCM");
      byteRate = view.getUint32(offset + 16, true);
      if (byteRate !== 32000) throw new Error("Invalid speech sample rate");
    }
    if (type === "data") {
      if (!byteRate || length <= 0 || offset + 8 + length > totalBytes)
        throw new Error("Incomplete speech audio");
      return length / byteRate;
    }
    offset += 8 + length + (length % 2);
  }
  throw new Error("Speech audio data is missing");
}
