import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { EditorProject } from "./mockData";

/**
 * Mock 9:16 video viewport with a fake play head, current caption, and
 * a "now playing" SFX flash. No real video.
 */
export function EditorViewport({
  project,
  playhead,
  setPlayhead,
}: {
  project: EditorProject;
  playhead: number;
  setPlayhead: (t: number) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number | null>(null);
  const lastT = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      if (raf.current) cancelAnimationFrame(raf.current);
      lastT.current = null;
      return;
    }
    const tick = (now: number) => {
      if (lastT.current === null) lastT.current = now;
      const dt = (now - lastT.current) / 1000;
      lastT.current = now;
      const next = playhead + dt;
      if (next >= project.totalDuration) {
        setPlayhead(0);
        setPlaying(false);
        return;
      }
      setPlayhead(next);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const activeClip = project.clips.find(
    (c) => playhead >= c.start && playhead < c.start + c.duration,
  );
  const activeCaption = project.captions.find(
    (c) => playhead >= c.start && playhead < c.start + c.duration,
  );
  const activeSfx = project.sfx.find((s) => Math.abs(s.t - playhead) < 0.18);

  return (
    <div className="flex flex-col items-center">
      {/* 9:16 frame */}
      <div className="relative aspect-[9/16] w-full max-w-[260px] rounded-2xl overflow-hidden border border-border bg-black shadow-card">
        {/* fake content layer — gradient based on clip hue */}
        <div
          className="absolute inset-0 transition-colors duration-300"
          style={{
            background: activeClip
              ? `linear-gradient(160deg, hsl(${activeClip.hue} 60% 25%), hsl(${activeClip.hue} 80% 14%))`
              : "#0a0a0a",
          }}
        />
        {/* big emoji as visual proxy */}
        {activeClip && (
          <div className="absolute inset-0 flex items-center justify-center text-7xl opacity-90">
            {activeClip.thumb}
          </div>
        )}
        {/* caption */}
        {activeCaption && (
          <div className="absolute bottom-10 left-0 right-0 flex justify-center px-4 pointer-events-none">
            <span
              className={`px-3 py-1.5 rounded-md font-bold text-base text-white drop-shadow-lg ${
                activeCaption.emphasis === "shake" ? "animate-pulse" : ""
              }`}
              style={{
                background: activeCaption.emphasis === "bold" ? "rgba(155,135,245,0.95)" : "rgba(0,0,0,0.55)",
                letterSpacing: "0.02em",
              }}
            >
              {activeCaption.text}
            </span>
          </div>
        )}
        {/* sfx flash */}
        {activeSfx && (
          <div
            className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider text-white bg-primary/80 backdrop-blur-sm"
            style={{ opacity: activeSfx.intensity }}
          >
            ♪ {activeSfx.label}
          </div>
        )}
        {/* timecode */}
        <div className="absolute top-3 left-3 text-[10px] tabular-nums text-white/70 font-mono">
          {playhead.toFixed(1).padStart(4, "0")}s
        </div>
      </div>

      {/* Transport */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="h-11 w-11 rounded-full bg-foreground text-background flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>
        <div className="text-xs tabular-nums text-foreground/55">
          {playhead.toFixed(1)}s / {project.totalDuration.toFixed(1)}s
        </div>
      </div>
    </div>
  );
}
