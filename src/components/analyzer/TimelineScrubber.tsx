import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type Marker = {
  t: number; // seconds
  type: "good" | "bad" | "spike" | "goal" | "miss";
  label: string;
};

const MARKER_EMOJI: Record<Marker["type"], string> = {
  good: "🟢",
  bad: "🔴",
  spike: "⚡",
  goal: "🎯",
  miss: "❌",
};

export function TimelineScrubber({
  duration,
  currentTime,
  onSeek,
  markers = [],
  selectedMarkerIdx,
  onSelectMarker,
}: {
  duration: number;
  currentTime: number;
  onSeek: (t: number) => void;
  markers?: Marker[];
  selectedMarkerIdx?: number;
  onSelectMarker?: (i: number) => void;
}) {
  const pct = (currentTime / duration) * 100;

  // Mock waveform (pseudo-random but stable per duration)
  const bars = useMemo(() => {
    const n = 80;
    return Array.from({ length: n }, (_, i) => {
      const seed = Math.sin(i * 12.9898) * 43758.5453;
      const r = seed - Math.floor(seed);
      // pitch envelope shape
      const env = 0.4 + Math.sin((i / n) * Math.PI * 2.4) * 0.25 + Math.sin((i / n) * Math.PI * 7) * 0.12;
      return Math.max(0.1, Math.min(1, env + (r - 0.5) * 0.35));
    });
  }, []);

  // Mock visual events lane
  const events = useMemo(
    () => [
      { t: 1.2, type: "cut" },
      { t: 3.4, type: "face" },
      { t: 5.8, type: "text" },
      { t: 8.1, type: "cut" },
      { t: 11.6, type: "face" },
      { t: 14.2, type: "text" },
      { t: 18.0, type: "cut" },
      { t: 22.5, type: "face" },
      { t: 26.4, type: "text" },
      { t: 29.0, type: "cut" },
    ],
    [],
  );

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSeek((x / rect.width) * duration);
  };

  return (
    <div className="space-y-3 select-none">
      {/* Critical moments lane */}
      <div className="relative h-7">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border" />
        {markers.map((m, i) => (
          <button
            key={i}
            onClick={() => onSelectMarker?.(i)}
            className={cn(
              "absolute top-0 -translate-x-1/2 text-base transition-transform hover:scale-125",
              selectedMarkerIdx === i && "scale-125",
            )}
            style={{ left: `${(m.t / duration) * 100}%` }}
            title={`${m.label} @ ${m.t.toFixed(1)}s`}
            aria-label={m.label}
          >
            {MARKER_EMOJI[m.type]}
          </button>
        ))}
      </div>

      {/* Waveform + scrubber */}
      <div
        className="relative h-16 cursor-pointer rounded-md bg-foreground/[0.03] border border-border overflow-hidden"
        onClick={handleClick}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
      >
        <div className="absolute inset-x-2 inset-y-2 flex items-center gap-px">
          {bars.map((h, i) => {
            const inPlayed = (i / bars.length) * 100 <= pct;
            return (
              <div
                key={i}
                className={cn(
                  "flex-1 rounded-sm transition-colors",
                  inPlayed ? "bg-primary/80" : "bg-foreground/15",
                )}
                style={{ height: `${h * 100}%` }}
              />
            );
          })}
        </div>
        {/* Pitch overlay (curve) */}
        <svg className="absolute inset-0 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
          <path
            d={`M 0 ${50 - bars[0] * 30} ${bars
              .map((h, i) => `L ${(i / (bars.length - 1)) * 100} ${50 - h * 30}`)
              .join(" ")}`}
            stroke="hsl(var(--warning))"
            strokeWidth={0.5}
            fill="none"
            opacity={0.7}
          />
        </svg>
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground pointer-events-none transition-[left] duration-100"
          style={{ left: `${pct}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-foreground" />
        </div>
      </div>

      {/* Visual events lane */}
      <div className="relative h-6 rounded-md bg-foreground/[0.03] border border-border">
        {events.map((e, i) => (
          <div
            key={i}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 rounded-sm border",
              e.type === "cut" && "w-1 bg-destructive/70 border-destructive",
              e.type === "face" && "w-2 bg-primary/40 border-primary",
              e.type === "text" && "w-2.5 bg-warning/40 border-warning",
            )}
            style={{ left: `${(e.t / duration) * 100}%` }}
            title={`${e.type} @ ${e.t.toFixed(1)}s`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-wider text-foreground/50">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-1 bg-destructive/70" /> cut</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 bg-primary/40 border border-primary" /> face</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2.5 bg-warning/40 border border-warning" /> text</span>
        <span className="inline-flex items-center gap-1.5"><span className="text-warning">~</span> pitch</span>
      </div>
    </div>
  );
}
