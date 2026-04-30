import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * One region's heatmap row over time. Generates stable mock activation
 * from a seed so the visualization looks varied but consistent.
 */
export function RegionActivationLane({
  name,
  seed,
  duration,
  currentTime,
  steps = 40,
  className,
}: {
  name: string;
  seed: number;
  duration: number;
  currentTime: number;
  steps?: number;
  className?: string;
}) {
  const cells = useMemo(() => {
    return Array.from({ length: steps }, (_, i) => {
      // deterministic noise
      const a = Math.sin(seed * 1.3 + i * 0.41) * 43758.5453;
      const b = Math.cos(seed * 0.7 + i * 0.27) * 12345.678;
      const v = (a - Math.floor(a)) * 0.6 + (b - Math.floor(b)) * 0.4;
      // amplify peaks
      return Math.max(0, Math.min(1, Math.pow(v, 1.6) + Math.sin((i / steps) * Math.PI * 2 + seed) * 0.15));
    });
  }, [seed, steps]);

  const playheadPct = (currentTime / duration) * 100;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="w-28 shrink-0 text-[11px] uppercase tracking-wider text-foreground/55 font-medium truncate">
        {name}
      </div>
      <div className="relative flex-1 h-5 rounded-sm overflow-hidden bg-foreground/[0.04] flex gap-px">
        {cells.map((v, i) => (
          <div
            key={i}
            className="flex-1 transition-colors"
            style={{
              backgroundColor: `hsl(var(--primary) / ${(v * 0.85 + 0.05).toFixed(2)})`,
            }}
          />
        ))}
        <div
          className="absolute top-0 bottom-0 w-px bg-foreground"
          style={{ left: `${playheadPct}%` }}
        />
      </div>
    </div>
  );
}
