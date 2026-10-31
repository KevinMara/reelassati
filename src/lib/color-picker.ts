export type HSV = { h: number; s: number; v: number };
export function normalizeHex(value: string): string | undefined {
  const hex = value.trim().replace(/^#/, "");
  if (/^[\da-f]{3}$/i.test(hex))
    return `#${[...hex]
      .map(c => c + c)
      .join("")
      .toUpperCase()}`;
  if (/^[\da-f]{6}$/i.test(hex)) return `#${hex.toUpperCase()}`;
}
export function hexToRgb(hex: string): [number, number, number] {
  const value = normalizeHex(hex) ?? "#000000";
  return [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}
export function rgbToHex(rgb: number[]): string {
  return `#${rgb
    .map(n =>
      Math.round(Math.max(0, Math.min(255, Number.isFinite(n) ? n : 0)))
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`.toUpperCase();
}
export function hexToHsv(hex: string): HSV {
  const [r, g, b] = hexToRgb(hex).map(n => n / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  const sector = !d
    ? 0
    : max === r
      ? (g - b) / d
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return {
    h: (((sector * 60) % 360) + 360) % 360,
    s: max ? (d / max) * 100 : 0,
    v: max * 100,
  };
}
export function hsvToHex({ h, s, v }: HSV): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  v = Math.max(0, Math.min(100, v)) / 100;
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  const rgb =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return rgbToHex(rgb.map(n => (n + m) * 255));
}
