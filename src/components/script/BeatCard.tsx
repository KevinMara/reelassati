import { useState } from "react";
import { Sparkles, GripVertical, X, Wand2 } from "lucide-react";
import { Beat } from "./mockData";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<Beat["type"], string> = {
  hook: "Hook",
  setup: "Setup",
  payoff: "Payoff",
  twist: "Twist",
  cta: "CTA",
};

const TYPE_COLORS: Record<Beat["type"], string> = {
  hook: "bg-primary/10 text-primary border-primary/20",
  setup: "bg-foreground/[0.04] text-foreground/65 border-border",
  payoff: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  twist: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/20",
  cta: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
};

export function BeatCard({
  beat,
  index,
  onChange,
  onDelete,
  onRegenerate,
}: {
  beat: Beat;
  index: number;
  onChange: (b: Beat) => void;
  onDelete: () => void;
  onRegenerate: () => void;
}) {
  const [active, setActive] = useState<"vo" | "os" | "vis" | null>(null);

  const Field = ({
    id, label, value, multiline, placeholder,
  }: { id: "vo" | "os" | "vis"; label: string; value: string; multiline?: boolean; placeholder?: string }) => {
    const Input = multiline ? "textarea" : "input";
    return (
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-foreground/45 mb-1 font-medium">
          {label}
        </label>
        <Input
          value={value}
          placeholder={placeholder}
          onFocus={() => setActive(id)}
          onBlur={() => setActive(null)}
          rows={multiline ? 2 : undefined}
          onChange={(e) =>
            onChange(
              id === "vo"
                ? { ...beat, voiceover: e.target.value }
                : id === "os"
                  ? { ...beat, onScreen: e.target.value }
                  : { ...beat, visual: e.target.value },
            )
          }
          className={cn(
            "w-full bg-transparent text-sm text-foreground/90 leading-relaxed border-0 border-b border-transparent focus:border-primary/40 focus:outline-none px-0 py-1 resize-none transition-colors",
            active === id && "border-primary/40",
          )}
        />
      </div>
    );
  };

  return (
    <div className="group relative rounded-xl border border-border bg-card hover:border-foreground/20 transition-all">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60">
        <button className="text-foreground/30 cursor-grab hover:text-foreground/60" aria-label="Drag">
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="text-[11px] font-mono text-foreground/45 tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </div>
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] uppercase tracking-wider border font-medium", TYPE_COLORS[beat.type])}>
          {TYPE_LABELS[beat.type]}
        </span>
        <div className="text-xs text-foreground/45 tabular-nums">
          {beat.t.toFixed(1)}s · {beat.dur.toFixed(1)}s
        </div>
        <div className="ml-auto flex items-center gap-1">
          <div
            className="text-[10px] tabular-nums text-foreground/40 mr-1"
            title="Predicted attention drop if removed"
          >
            w {beat.weight}
          </div>
          <button
            onClick={onRegenerate}
            className="h-7 w-7 rounded-md text-foreground/45 hover:text-primary hover:bg-primary/8 flex items-center justify-center transition-colors"
            title="Regenerate this beat"
          >
            <Wand2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="h-7 w-7 rounded-md text-foreground/45 hover:text-destructive hover:bg-destructive/8 flex items-center justify-center transition-colors"
            title="Delete beat"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        <Field id="vo" label="Voiceover" value={beat.voiceover} multiline />
        <div className="grid sm:grid-cols-2 gap-3">
          <Field id="os" label="On-screen text" value={beat.onScreen} />
          <Field id="vis" label="Visual direction" value={beat.visual} multiline />
        </div>
      </div>

      {/* Confidence bar */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl bg-gradient-to-b from-primary/60 via-primary/30 to-transparent" style={{ opacity: beat.weight / 100 }} />
    </div>
  );
}

export function AddBeatButton({ onAdd }: { onAdd: (type: Beat["type"]) => void }) {
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <span className="text-xs text-foreground/40">Insert beat:</span>
      {(["hook", "setup", "payoff", "twist", "cta"] as Beat["type"][]).map((t) => (
        <button
          key={t}
          onClick={() => onAdd(t)}
          className="text-xs text-foreground/55 hover:text-primary px-2 py-1 rounded-md hover:bg-primary/8 transition-colors capitalize"
        >
          + {t}
        </button>
      ))}
      <Sparkles className="h-3 w-3 text-foreground/30 ml-2" />
    </div>
  );
}
