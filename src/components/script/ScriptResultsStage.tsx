import { useState } from "react";
import { ArrowLeft, Send, Download, Copy, AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScriptVariant, Beat, generateVariants } from "./mockData";
import { ScriptBrief } from "./ScriptBriefStage";
import { RetentionSparkline } from "./RetentionSparkline";
import { BeatCard, AddBeatButton } from "./BeatCard";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export function ScriptResultsStage({
  brief, onReset, variants: initialVariants,
}: {
  brief: ScriptBrief;
  onReset: () => void;
  variants?: ScriptVariant[];
}) {
  const [variants, setVariants] = useState<ScriptVariant[]>(
    () => initialVariants ?? generateVariants(brief),
  );
  const [activeId, setActiveId] = useState<string>(variants[0].id);
  const active = variants.find((v) => v.id === activeId)!;

  const updateActive = (mut: (v: ScriptVariant) => ScriptVariant) => {
    setVariants((vs) => vs.map((v) => (v.id === activeId ? mut(v) : v)));
  };

  const updateBeat = (b: Beat) =>
    updateActive((v) => ({ ...v, beats: v.beats.map((x) => (x.id === b.id ? b : x)) }));
  const deleteBeat = (id: string) =>
    updateActive((v) => ({ ...v, beats: v.beats.filter((x) => x.id !== id) }));
  const addBeat = (type: Beat["type"]) =>
    updateActive((v) => {
      const last = v.beats[v.beats.length - 1];
      const t = last ? last.t + last.dur : 0;
      return {
        ...v,
        beats: [
          ...v.beats,
          {
            id: `${v.id}_b${Date.now()}`,
            t, dur: 3, type,
            title: `New ${type}`,
            voiceover: "",
            onScreen: "",
            visual: "",
            weight: 50,
          },
        ],
      };
    });

  const totalDuration = active.beats.reduce((s, b) => s + b.dur, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">3 variants ready.</h2>
          <p className="text-sm text-foreground/55 mt-0.5">
            Each one approaches the same idea from a different rhetorical angle. Pick one, edit, send to Editor.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <ArrowLeft className="h-4 w-4" /> New brief
        </Button>
      </div>

      {/* Variant tabs */}
      <div className="grid md:grid-cols-3 gap-3">
        {variants.map((v) => (
          <button
            key={v.id}
            onClick={() => setActiveId(v.id)}
            className={cn(
              "text-left rounded-xl border p-4 transition-all",
              v.id === activeId
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border bg-card hover:border-foreground/20",
            )}
          >
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-sm font-semibold">{v.label}</div>
              <div className="tabular-nums text-lg font-semibold text-primary">{v.score}</div>
            </div>
            <div className="text-xs text-foreground/55 mb-3 leading-snug">{v.angle}</div>
            <RetentionSparkline values={v.retention} className="w-full h-10" height={40} />
            <div className="mt-2 text-[10px] uppercase tracking-wider text-foreground/45 flex items-center justify-between">
              <span>{v.device}</span>
              <span>{v.cohortRank}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Active variant editor */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-4 bg-surface/40">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-foreground/50">Editing</div>
            <div className="text-base font-semibold">{active.label}</div>
          </div>
          <div className="ml-auto flex items-center gap-4 text-xs text-foreground/55">
            <Stat label="Beats" value={String(active.beats.length)} />
            <Stat label="Duration" value={`${totalDuration.toFixed(1)}s`} />
            <Stat label="Predicted" value={`${active.score}/100`} accent />
          </div>
        </div>

        {active.warnings.length > 0 && (
          <div className="mx-5 mt-4 flex gap-2 rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div>{active.warnings[0]}</div>
          </div>
        )}

        <div className="p-5 space-y-3">
          {active.beats.map((b, i) => (
            <BeatCard
              key={b.id}
              beat={b}
              index={i}
              onChange={updateBeat}
              onDelete={() => deleteBeat(b.id)}
              onRegenerate={() =>
                toast({ title: "Regenerated", description: `Beat ${i + 1} rewritten in the same voice.` })
              }
            />
          ))}
          <AddBeatButton onAdd={addBeat} />
        </div>

        <div className="px-5 py-4 border-t border-border bg-surface/40 flex flex-wrap items-center gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const text = active.beats
                .map((b, i) => `## ${i + 1}. ${b.title} (${b.t.toFixed(1)}s — ${b.dur.toFixed(1)}s)\nVO: ${b.voiceover}\nOn-screen: ${b.onScreen}\nVisual: ${b.visual}`)
                .join("\n\n");
              navigator.clipboard.writeText(text);
              toast({ title: "Copied", description: "Script copied to clipboard." });
            }}
          >
            <Copy className="h-4 w-4" /> Copy
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toast({ title: "Exported", description: "Saved as PDF." })}>
            <Download className="h-4 w-4" /> Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast({ title: "Saved to library" })}>
            <Plus className="h-4 w-4" /> Save to library
          </Button>
          <Button variant="primary" size="sm" onClick={() => toast({ title: "Sent to Editor", description: `${active.label} is ready to cut.` })}>
            <Send className="h-4 w-4" /> Send to Editor
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wider text-foreground/45">{label}</div>
      <div className={cn("text-sm tabular-nums font-medium", accent && "text-primary")}>{value}</div>
    </div>
  );
}
