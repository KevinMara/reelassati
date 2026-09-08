/** Original procedural effects, with no third-party samples or provider calls. */
export function createEditorSound(
  kind: "click" | "whoosh" | "impact" | "rise"
): File {
  const rate = 44100;
  const seconds = kind === "click" ? 0.12 : kind === "impact" ? 0.6 : 1;
  const count = Math.ceil(rate * seconds);
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + count * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, count * 2, true);
  let noise = 0;
  let seed = 72819;
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    const progress = t / seconds;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    noise = noise * 0.7 + ((seed / 4294967296) * 2 - 1) * 0.3;
    const envelope = Math.sin(Math.PI * progress) ** 2;
    const signal =
      kind === "click"
        ? Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t * 65)
        : kind === "impact"
          ? (Math.sin(2 * Math.PI * (80 * t - 35 * t * t)) * 0.8 +
              noise * 0.2) *
            Math.exp(-t * 10)
          : kind === "rise"
            ? (Math.sin(2 * Math.PI * (180 * t + 800 * t * t)) * 0.25 +
                noise * 0.75) *
              envelope
            : noise * envelope;
    view.setInt16(44 + i * 2, Math.round(signal * 18000), true);
  }
  return new File([buffer], `${kind}.wav`, { type: "audio/wav" });
}
