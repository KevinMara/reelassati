import { Fragment, useMemo } from "react";

export function ScheduleHeatmap({
  platform,
  selectedSlot,
  onSelect,
}: {
  platform: Platform;
  selectedSlot: { day: string; hour: number } | null;
  onSelect: (s: { day: string; hour: number }) => void;
}) {
  const meta = PLATFORMS.find((p) => p.id === platform)!;
  const slots = useMemo(() => buildHeatmap(platform), [platform]);
  const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6..23

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${meta.color})` }} />
          <span className="text-sm font-medium">{meta.name} engagement window</span>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-foreground/45">
          ★ = peak slot
        </div>
      </div>

      <div className="grid grid-cols-[28px_repeat(7,1fr)] gap-1 text-[10px]">
        <div />
        {DAYS_ORDER.map((d) => (
          <div key={d} className="text-center text-foreground/50 font-medium">{d}</div>
        ))}
        {HOURS.map((h) => (
          <>
            <div key={`l-${h}`} className="text-right pr-1 text-foreground/40 tabular-nums leading-[18px]">
              {h}
            </div>
            {DAYS_ORDER.map((d) => {
              const s = slots.find((x) => x.day === d && x.hour === h)!;
              const sel = selectedSlot?.day === d && selectedSlot?.hour === h;
              return (
                <button
                  key={`${d}-${h}`}
                  onClick={() => onSelect({ day: d, hour: h })}
                  className="relative h-[18px] rounded-[3px] transition-transform hover:scale-110"
                  style={{
                    background: `hsl(${meta.color} / ${0.08 + s.score * 0.85})`,
                    outline: sel ? `2px solid hsl(${meta.color})` : undefined,
                    outlineOffset: sel ? "1px" : undefined,
                  }}
                  title={`${d} ${h}:00 · ${Math.round(s.score * 100)}% engagement`}
                >
                  {s.isBest && (
                    <span className="absolute inset-0 flex items-center justify-center text-white text-[9px]">★</span>
                  )}
                </button>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
