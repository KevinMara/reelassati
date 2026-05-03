import { useMemo } from "react";
import { buildWorkload, SCHEDULE_DAYS } from "./mockData";

export function WorkloadHeatmap() {
  const cells = useMemo(buildWorkload, []);
  const hours = Array.from({ length: 17 }, (_, i) => 6 + i); // 6..22

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold">This week's workload</div>
          <div className="text-xs text-foreground/50 mt-0.5">When the agents are busiest across all clients</div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-foreground/45">
          <span>low</span>
          <div className="flex gap-0.5">
            {[0.15, 0.35, 0.55, 0.75, 0.95].map((v) => (
              <div
                key={v}
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: `hsl(220 70% 50% / ${v})` }}
              />
            ))}
          </div>
          <span>high</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-1 min-w-full">
          {/* hour header */}
          <div className="flex gap-1 pl-10">
            {hours.map((h) => (
              <div key={h} className="w-5 text-[9px] text-foreground/35 text-center tabular-nums">
                {h % 3 === 0 ? h : ""}
              </div>
            ))}
          </div>
          {SCHEDULE_DAYS.map((day) => (
            <div key={day} className="flex items-center gap-1">
              <div className="w-10 text-[10px] text-foreground/45 font-medium">{day}</div>
              {hours.map((h) => {
                const cell = cells.find((c) => c.day === day && c.hour === h)!;
                return (
                  <div
                    key={h}
                    className="w-5 h-5 rounded-sm transition-transform hover:scale-110"
                    style={{ background: `hsl(220 70% 50% / ${0.08 + cell.load * 0.85})` }}
                    title={`${day} ${h}:00 — ${Math.round(cell.load * 100)}% load`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
