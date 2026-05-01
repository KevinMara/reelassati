import { useEffect, useState } from "react";
import { Loader2, Scissors, Send, Download, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { EditorViewport } from "@/components/editor/EditorViewport";
import { TimelineEditor } from "@/components/editor/TimelineEditor";
import { InspectorPanel } from "@/components/editor/InspectorPanel";
import { MOCK_PROJECT, EditorProject } from "@/components/editor/mockData";
import { toast } from "@/hooks/use-toast";

type Stage = "intake" | "assembling" | "edit";

export default function EditRoute() {
  return <AppShell renderWith={() => <EditPage />} />;
}

function EditPage() {
  const [stage, setStage] = useState<Stage>("intake");
  return (
    <section className="container-page py-8 lg:py-10">
      <header className="mb-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Scissors className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">Editor</h1>
          <p className="text-sm text-foreground/55 mt-0.5">
            Footage in. Vertical reel out. The agent assembles, you fine-tune.
          </p>
        </div>
      </header>

      {stage === "intake" && <IntakeStage onAssemble={() => setStage("assembling")} />}
      {stage === "assembling" && <AssemblingStage onDone={() => setStage("edit")} />}
      {stage === "edit" && <EditStage onReset={() => setStage("intake")} />}
    </section>
  );
}

function IntakeStage({ onAssemble }: { onAssemble: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [scriptLinked, setScriptLinked] = useState(true);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="text-[11px] uppercase tracking-wider text-primary/80 mb-2 font-medium">From the Scriptwriter</div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={scriptLinked} onChange={(e) => setScriptLinked(e.target.checked)} className="accent-primary h-4 w-4" />
          <div>
            <div className="text-sm font-medium">Use script: "The contrarian"</div>
            <div className="text-xs text-foreground/55">5 beats · 19.0s target · pizza_food client</div>
          </div>
        </label>
      </div>

      <div className="relative rounded-2xl border-2 border-dashed border-border min-h-[220px] flex flex-col items-center justify-center text-center px-6 py-10 bg-surface/40">
        <input
          type="file"
          accept="video/*"
          multiple
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        <div className="text-foreground/40 mb-2"><Scissors className="h-7 w-7 mx-auto" /></div>
        <div className="text-sm text-foreground/70">Drop raw footage (multiple files OK)</div>
        <div className="text-xs text-foreground/45 mt-1">MP4, MOV, WebM up to 2GB total</div>
        {files.length > 0 && (
          <div className="mt-3 text-xs text-primary">{files.length} file{files.length > 1 ? "s" : ""} ready</div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onAssemble}>Skip — use mock footage</Button>
        <Button variant="primary" size="lg" onClick={onAssemble}>
          <Sparkles className="h-4 w-4" /> Assemble
        </Button>
      </div>
    </div>
  );
}

function AssemblingStage({ onDone }: { onDone: () => void }) {
  const stages = [
    "Indexing footage…",
    "Detecting faces & speech…",
    "Aligning to script beats…",
    "Cutting on-beat to 92 BPM track…",
    "Auto-captioning (Italian)…",
    "Placing SFX & b-roll…",
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= stages.length) { const t = setTimeout(onDone, 350); return () => clearTimeout(t); }
    const t = setTimeout(() => setI(i + 1), 650 + Math.random() * 500);
    return () => clearTimeout(t);
  }, [i, onDone, stages.length]);
  return (
    <div className="max-w-xl mx-auto py-16 text-center">
      <div className="inline-flex h-14 w-14 rounded-2xl bg-primary/10 text-primary items-center justify-center mb-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
      <h2 className="text-2xl font-semibold mb-8">Assembling your reel.</h2>
      <ul className="space-y-2 text-left max-w-sm mx-auto">
        {stages.map((s, idx) => (
          <li key={s} className={`flex items-center gap-3 text-sm transition-all duration-300 ${idx < i ? "text-foreground/80" : idx === i ? "text-foreground" : "text-foreground/30"}`}>
            <span className={`h-2 w-2 rounded-full ${idx < i ? "bg-primary" : idx === i ? "bg-primary animate-pulse" : "bg-foreground/15"}`} />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditStage({ onReset }: { onReset: () => void }) {
  const [project, setProject] = useState<EditorProject>(MOCK_PROJECT);
  const [playhead, setPlayhead] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-foreground/50">Editing reel</div>
          <h2 className="text-xl font-semibold">The contrarian — v1</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onReset}>New project</Button>
          <Button variant="ghost" size="sm" onClick={() => toast({ title: "Exported MP4 (mock)" })}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button variant="primary" size="sm" onClick={() => toast({ title: "Sent to Publisher", description: "Ready to schedule." })}>
            <Send className="h-4 w-4" /> Send to Publisher
          </Button>
        </div>
      </div>

      {/* Top row: viewport + inspector */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        <div className="rounded-xl border border-border bg-card p-6 flex justify-center">
          <EditorViewport project={project} playhead={playhead} setPlayhead={setPlayhead} />
        </div>
        <InspectorPanel project={project} selectedId={selectedId} setProject={setProject} />
      </div>

      {/* Timeline */}
      <TimelineEditor
        project={project}
        playhead={playhead}
        setPlayhead={setPlayhead}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    </div>
  );
}
