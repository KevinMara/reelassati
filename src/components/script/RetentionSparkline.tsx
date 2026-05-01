/**
 * Tiny SVG retention curve. Not chart.js — just a hand-built path.
 */
export function RetentionSparkline({
  values,
  className,
  height = 48,
}: {
  values: number[];
  className?: string;
  height?: number;
}) {
  const w = 240;
  const h = height;
  const pad = 2;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const step = innerW / (values.length - 1);

  const points = values.map((v, i) => [pad + i * step, pad + (1 - v) * innerH]);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const fill = `${d} L${pad + innerW},${pad + innerH} L${pad},${pad + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none">
      <defs>
        <linearGradient id="ret-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#ret-grad)" />
      <path d={d} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
    </svg>
  );
}
