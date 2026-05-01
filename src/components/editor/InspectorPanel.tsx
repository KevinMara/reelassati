import { Sparkles, Type, Music, Volume2, Wand2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditorProject, CAPTION_STYLES, TRANSITION_PRESETS } from "./mockData";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export function InspectorPanel({
  project,
  selectedId,
  setProject,
}: {
  project: EditorProject;
  selectedId: string | null;
  setProject: (p: EditorProject) => void;
}) {
  if (!selectedId) return <NoSelection />;

  const clip = project.clips.find((c) => c.id === selectedId);
  const caption = project.captions.find((c) => c.id === selectedId);
  const sfx = project.sfx.find((s) => s.id === selectedId);

  if (clip) {
    return (
      <Wrap title="Clip" subtitle={clip.label}>
        <Row label="Start">{clip.start.toFixed(2)}s</Row>
        <Row label="Duration">{clip.duration.toFixed(2)}s</Row>
        <Row label="Kind">{clip.kind === "video" ? "Primary video" : "B-roll overlay"}</Row>
        <div className="pt-2 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-foreground/45 font-medium">Transition out</p>
          <select className="w-full h-9 rounded-md bg-surface border border-input px-2 text-sm">
            {TRANSITION_PRESETS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <Actions onDelete={() => toast({ title: "Clip removed (mock)" })} />
      </Wrap>
    );
  }

  if (caption) {
    return (
      <Wrap title="Caption" subtitle={`"${caption.text}"`}>
        <Row label="In">{caption.start.toFixed(2)}s</Row>
        <Row label="Duration">{caption.duration.toFixed(2)}s</Row>
        <div className="pt-2 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-foreground/45 font-medium">Style</p>
          <div className="grid grid-cols-2 gap-2">
            {CAPTION_STYLES.map((s) => (
              <button
                key={s.id}
                className="rounded-lg border border-border p-2 text-center hover:border-primary/50 transition-colors"
              >
                <div className="text-xs font-bold mb-1" style={{ color: s.color === "primary" ? "hsl(var(--primary))" : undefined }}>
                  {s.preview}
                </div>
                <div className="text-[10px] text-foreground/55">{s.name}</div>
              </button>
            ))}
          </div>
        </div>
        <Actions onDelete={() => toast({ title: "Caption removed (mock)" })} />
      </Wrap>
    );
  }

  if (sfx) {
    return (
      <Wrap title="SFX" subtitle={sfx.label}>
        <Row label="At">{sfx.t.toFixed(2)}s</Row>
        <Row label="Intensity">{Math.round(sfx.intensity * 100)}%</Row>
        <div className="pt-2 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-foreground/45 font-medium">Replace from library</p>
          <select className="w-full h-9 rounded-md bg-surface border border-input px-2 text-sm">
            {["whoosh", "tick", "crunch", "swell", "ding", "boom", "snap"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
        <Actions onDelete={() => toast({ title: "SFX removed (mock)" })} />
      </Wrap>
    );
  }

  return <NoSelection />;
}

function NoSelection() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-foreground/45 mb-1 font-medium flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" /> Suggestions
        </div>
        <p className="text-sm text-foreground/70 leading-relaxed">
          Cuts feel slightly slow at <b>9.2s</b>. Try a J-cut into the b-roll.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <QuickAction icon={Type} label="Auto-caption" />
        <QuickAction icon={Volume2} label="Auto-SFX" />
        <QuickAction icon={Music} label="Pick music" />
      </div>
      <p className="text-xs text-foreground/45 pt-1">Select a clip, caption, or SFX to edit it.</p>
    </div>
  );
}

function QuickAction({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button
      onClick={() => toast({ title: `${label} applied (mock)` })}
      className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-surface/40 px-2 py-3 text-foreground/70 hover:border-primary/40 hover:text-primary transition-colors"
    >
      <Icon className="h-4 w-4" />
      <span className="text-[10px] text-center leading-tight">{label}</span>
    </button>
  );
}

function Wrap({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-foreground/45 font-medium">{title}</div>
        <div className="text-sm font-semibold text-foreground truncate">{subtitle}</div>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-foreground/55 text-xs">{label}</span>
      <span className="tabular-nums">{children}</span>
    </div>
  );
}

function Actions({ onDelete }: { onDelete: () => void }) {
  return (
    <div className="flex gap-2 pt-2 border-t border-border/60">
      <Button variant="ghost" size="sm" className="flex-1">
        <Wand2 className="h-3.5 w-3.5" /> Regenerate
      </Button>
      <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
