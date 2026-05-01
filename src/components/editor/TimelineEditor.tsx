import { useRef } from "react";
import { Film, Type, Music, Volume2 } from "lucide-react";
import { EditorProject, Clip, Caption, SfxEvent } from "./mockData";
import { cn } from "@/lib/utils";

const ROW_H = 36;
const PX_PER_SEC = 38;

export function TimelineEditor({
  project,
  playhead,
  setPlayhead,
  selectedId,
  onSelect,
}: {
  project: EditorProject;
  playhead: number;
  setPlayhead: (t: number) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const totalW = project.totalDuration * PX_PER_SEC;

  const seek = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left + ref.current.scrollLeft;
    setPlayhead(Math.max(0, Math.min(project.totalDuration, x / PX_PER_SEC)));
  };

  const ticks = Array.from({ length: Math.floor(project.totalDuration) + 1 }, (_, i) => i);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Lane labels + scrolling area */}
      <div className="flex">
        <div className="shrink-0 w-32 border-r border-border bg-surface/40">
          {[
            { icon: Film, label: "Video", sub: "primary" },
            { icon: Film, label: "B-roll", sub: "overlay" },
            { icon: Type, label: "Captions" },
            { icon: Volume2, label: "SFX" },
            { icon: Music, label: "Music" },
          ].map((l, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 border-b border-border/60 text-xs text-foreground/65"
              style={{ height: ROW_H + (i === 0 ? 8 : 0) + (i === 0 ? 16 : 0) }}
            >
              <l.icon className="h-3.5 w-3.5 text-foreground/40" />
              <span>{l.label}</span>
              {l.sub && <span className="text-[10px] text-foreground/35 uppercase tracking-wider ml-auto">{l.sub}</span>}
            </div>
          ))}
        </div>

        <div ref={ref} className="flex-1 overflow-x-auto relative" onClick={(e) => { onSelect(null); seek(e); }}>
          <div className="relative" style={{ width: Math.max(totalW + 40, 400) }}>
            {/* time ruler */}
            <div className="h-6 border-b border-border/60 relative bg-surface/30">
              {ticks.map((s) => (
                <div key={s} className="absolute top-0 bottom-0" style={{ left: s * PX_PER_SEC }}>
                  <div className="h-2 w-px bg-foreground/15" />
                  <div className="text-[9px] tabular-nums text-foreground/40 -translate-x-1/2 ml-px mt-0.5">{s}s</div>
                </div>
              ))}
            </div>

            {/* Video lane (primary) */}
            <Lane>
              {project.clips.filter((c) => c.kind === "video").map((c) => (
                <ClipBlock key={c.id} clip={c} selected={selectedId === c.id} onSelect={(id) => { onSelect(id); }} />
              ))}
            </Lane>

            {/* B-roll lane */}
            <Lane>
              {project.clips.filter((c) => c.kind === "broll").map((c) => (
                <ClipBlock key={c.id} clip={c} selected={selectedId === c.id} onSelect={(id) => { onSelect(id); }} />
              ))}
            </Lane>

            {/* Captions lane */}
            <Lane>
              {project.captions.map((c) => (
                <CaptionBlock key={c.id} caption={c} selected={selectedId === c.id} onSelect={(id) => onSelect(id)} />
              ))}
            </Lane>

            {/* SFX lane */}
            <Lane>
              {project.sfx.map((s) => (
                <SfxMark key={s.id} sfx={s} selected={selectedId === s.id} onSelect={(id) => onSelect(id)} />
              ))}
            </Lane>

            {/* Music lane */}
            <Lane>
              <div
                className="absolute top-1.5 bottom-1.5 rounded-md border border-fuchsia-500/40 bg-fuchsia-500/10 flex items-center px-2 text-[11px] text-fuchsia-700 dark:text-fuchsia-300 truncate"
                style={{ left: project.music.start * PX_PER_SEC, width: project.music.duration * PX_PER_SEC - 2 }}
              >
                <Waveform />
                <span className="ml-2 truncate">{project.music.title}</span>
              </div>
            </Lane>

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-px bg-primary z-20 pointer-events-none"
              style={{ left: playhead * PX_PER_SEC }}
            >
              <div className="h-3 w-3 -ml-1.5 -mt-1 rounded-full bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.25)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Lane({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative border-b border-border/60"
      style={{ height: ROW_H }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function ClipBlock({ clip, selected, onSelect }: { clip: Clip; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSelect(clip.id); }}
      className={cn(
        "absolute top-1.5 bottom-1.5 rounded-md border flex items-center px-2 text-[11px] text-white truncate transition-all",
        selected ? "ring-2 ring-primary ring-offset-1 ring-offset-card scale-[1.01]" : "hover:brightness-110",
      )}
      style={{
        left: clip.start * PX_PER_SEC,
        width: clip.duration * PX_PER_SEC - 2,
        background: `linear-gradient(135deg, hsl(${clip.hue} 65% 35%), hsl(${clip.hue} 70% 25%))`,
        borderColor: `hsl(${clip.hue} 70% 50% / 0.5)`,
      }}
    >
      <span className="mr-1.5">{clip.thumb}</span>
      <span className="truncate">{clip.label}</span>
    </button>
  );
}

function CaptionBlock({ caption, selected, onSelect }: { caption: Caption; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSelect(caption.id); }}
      className={cn(
        "absolute top-1.5 bottom-1.5 rounded-md border bg-foreground/[0.08] border-foreground/15 flex items-center px-2 text-[11px] text-foreground/80 truncate hover:bg-foreground/[0.12]",
        selected && "ring-2 ring-primary",
      )}
      style={{ left: caption.start * PX_PER_SEC, width: caption.duration * PX_PER_SEC - 2 }}
    >
      <span className="truncate font-medium">{caption.text}</span>
    </button>
  );
}

function SfxMark({ sfx, selected, onSelect }: { sfx: SfxEvent; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSelect(sfx.id); }}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 flex flex-col items-center group",
        selected && "text-primary",
      )}
      style={{ left: sfx.t * PX_PER_SEC - 8 }}
      title={sfx.label}
    >
      <div
        className={cn(
          "h-4 w-4 rotate-45 border bg-card",
          selected ? "border-primary" : "border-foreground/30 group-hover:border-foreground/60",
        )}
        style={{ opacity: 0.5 + sfx.intensity * 0.5 }}
      />
      <div className="text-[9px] text-foreground/45 mt-0.5 absolute top-full whitespace-nowrap">{sfx.label}</div>
    </button>
  );
}

function Waveform() {
  // tiny pseudo-waveform
  return (
    <svg width="60" height="14" viewBox="0 0 60 14" className="opacity-70">
      {Array.from({ length: 30 }).map((_, i) => {
        const h = 2 + Math.abs(Math.sin(i * 0.6) * Math.cos(i * 0.3)) * 12;
        return <rect key={i} x={i * 2} y={(14 - h) / 2} width={1.2} height={h} fill="currentColor" />;
      })}
    </svg>
  );
}
