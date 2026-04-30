import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Looks-real mock video player — pure UI, no actual video.
 * Vertical aspect by default to match short-form reality.
 */
export function MockVideoPlayer({
  duration = 32,
  thumbnailGradient = "from-orange-300 via-red-400 to-rose-600",
  caption = "POV: la pizza migliore di Roma",
  className,
  onTimeChange,
  currentTime: controlledTime,
}: {
  duration?: number;
  thumbnailGradient?: string;
  caption?: string;
  className?: string;
  onTimeChange?: (t: number) => void;
  currentTime?: number;
}) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [internalTime, setInternalTime] = useState(0);
  const time = controlledTime ?? internalTime;
  const setTime = (t: number) => {
    if (controlledTime === undefined) setInternalTime(t);
    onTimeChange?.(t);
  };

  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);

  useEffect(() => {
    if (!playing) return;
    last.current = performance.now();
    const loop = (now: number) => {
      const dt = (now - last.current) / 1000;
      last.current = now;
      const next = time + dt;
      if (next >= duration) {
        setTime(0);
        setPlaying(false);
        return;
      }
      setTime(next);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(1, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className={cn("relative aspect-[9/16] rounded-xl overflow-hidden bg-foreground/[0.04] border border-border group", className)}>
      {/* Mock thumbnail — gradient with subtle motion */}
      <div className={cn("absolute inset-0 bg-gradient-to-br animate-pulse-soft", thumbnailGradient)} />

      {/* Faux camera grain */}
      <div className="absolute inset-0 grain pointer-events-none" />

      {/* Center silhouette suggestion */}
      <div className="absolute inset-x-0 top-1/4 bottom-1/3 flex items-center justify-center">
        <div className="h-32 w-24 rounded-full bg-black/20 blur-2xl" />
      </div>

      {/* Caption overlay (centered, large) */}
      <div className="absolute inset-x-4 bottom-24 text-center">
        <span className="inline-block px-3 py-1.5 bg-black/70 text-white text-sm font-bold uppercase tracking-tight rounded">
          {caption}
        </span>
      </div>

      {/* Play overlay */}
      <button
        onClick={() => setPlaying((v) => !v)}
        className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors"
        aria-label={playing ? "Pause" : "Play"}
      >
        <span
          className={cn(
            "h-14 w-14 rounded-full bg-white/90 backdrop-blur text-foreground flex items-center justify-center shadow-card-hover transition-all duration-300 ease-out-expo",
            playing && "opacity-0 scale-90",
          )}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </span>
      </button>

      {/* Controls bottom */}
      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
        <input
          type="range"
          min={0}
          max={duration}
          step={0.01}
          value={time}
          onChange={(e) => setTime(parseFloat(e.target.value))}
          className="w-full accent-white h-1"
          aria-label="Scrub"
        />
        <div className="flex items-center justify-between mt-1.5 text-white text-[11px] tabular">
          <span>{fmt(time)} / {fmt(duration)}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setMuted((v) => !v)} aria-label="Mute">
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            <button aria-label="Fullscreen"><Maximize2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
