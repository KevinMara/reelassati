import { useMemo, useState } from "react";
import { Platform, PLATFORMS, Range, buildPlatformSeries } from "./mockData";
import { cn } from "@/lib/utils";

export function PlatformChart({ range }: { range: Range }) {
  const [active, setActive] = useState<Platform[]>(["instagram", "tiktok", "youtube"]);
  const series = useMemo(
    () => active.map((p) => ({ platform: p, points: buildPlatformSeries(p, range) })),
    [active, range],
  );

  const allY = series.flatMap((s) => s.points.map((p) => p.y));
  const max = Math.max(...allY, 1);
  const w = 600;
  const h = 220;
  const pad = { l: 32, r: 12, t: 12, b: 22 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const xCount = series[0]?.points.length ?? 1;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: pad.t + innerH - t * innerH,
    label: Math.round(max * t),
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-sm font-semibold">Reach by platform</div>
          <div className="text-xs text-foreground/50 mt-0.5">Toggle platforms to compare</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PLATFORMS.map((p) => {
            const on = active.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() =>
                  setActive((cur) =>
                    cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id],
                  )
                }
                className={cn(
                  "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-all",
                  on
                    ? "border-transparent bg-surface text-foreground"
                    : "border-border text-foreground/45 hover:text-foreground/75",
                )}
              >
                <span
                  className={cn("h-2 w-2 rounded-full transition-opacity", !on && "opacity-30")}
                  style={{ background: `hsl(${p.color})` }}
                />
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }}>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={w - pad.r} y1={t.y} y2={t.y} stroke="hsl(var(--border))" strokeDasharray="2 4" />
            <text x={pad.l - 6} y={t.y + 3} textAnchor="end" className="fill-foreground/40" fontSize="9">
              {t.label}
            </text>
          </g>
        ))}

        {series.map((s) => {
          const meta = PLATFORMS.find((p) => p.id === s.platform)!;
          const points = s.points
            .map((pt, i) => {
              const x = pad.l + (i / (xCount - 1)) * innerW;
              const y = pad.t + innerH - (pt.y / max) * innerH;
              return `${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(" ");
          return (
            <polyline
              key={s.platform}
              points={points}
              fill="none"
              stroke={`hsl(${meta.color})`}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        <text x={pad.l} y={h - 6} className="fill-foreground/40" fontSize="9">
          {range === "7d" ? "7 days ago" : range === "30d" ? "30 days ago" : "90 days ago"}
        </text>
        <text x={w - pad.r} y={h - 6} textAnchor="end" className="fill-foreground/40" fontSize="9">
          today
        </text>
      </svg>
    </div>
  );
}
