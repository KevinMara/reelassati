import { cn } from "@/lib/utils";

/**
 * Circular progress gauge with score in the center.
 * Used for verdict and per-candidate match scores.
 */
export function ScoreGauge({
  value,
  max = 100,
  size = 120,
  thickness = 10,
  label,
  grade,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  label?: string;
  grade?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);

  // Color shifts with score
  const stroke =
    pct >= 0.8
      ? "hsl(var(--success))"
      : pct >= 0.6
        ? "hsl(var(--primary))"
        : pct >= 0.4
          ? "hsl(var(--warning))"
          : "hsl(var(--destructive))";

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--border-strong))"
          strokeWidth={thickness}
          opacity={0.35}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="tabular text-foreground font-semibold leading-none" style={{ fontSize: size * 0.32 }}>
          {Math.round(value)}
        </span>
        {grade && (
          <span className="tabular text-foreground/50 mt-1" style={{ fontSize: size * 0.13 }}>
            {grade}
          </span>
        )}
        {label && !grade && <span className="text-[10px] uppercase tracking-wider text-foreground/50 mt-1">{label}</span>}
      </div>
    </div>
  );
}
