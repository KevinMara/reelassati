import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Video, Plus, X } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UploadStage } from "@/components/analyzer/UploadStage";
import { ProcessingStage } from "@/components/analyzer/ProcessingStage";
import { ResultsStage } from "@/components/analyzer/ResultsStage";
import { ABResults } from "@/components/analyzer/ABResults";
import { TournamentResults } from "@/components/analyzer/TournamentResults";

type Mode = "single" | "ab" | "tournament";
type Stage = "upload" | "processing" | "results";

export default function AnalyzeRoute() {
  return <AppShell renderWith={() => <AnalyzePage />} />;
}

function AnalyzePage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("single");
  const [stage, setStage] = useState<Stage>("upload");
  const [tourneyCount, setTourneyCount] = useState(3);

  const reset = () => setStage("upload");

  return (
    <section className="container-page py-8 lg:py-10">
      <header className="mb-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Video className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">{t("app.analyze.title")}</h1>
          <p className="text-sm text-foreground/55 mt-0.5">{t("app.analyze.sub")}</p>
        </div>
      </header>

      {/* Mode tabs */}
      {stage === "upload" && (
        <div className="mb-8 inline-flex p-1 rounded-pill border border-border bg-surface">
          {(["single", "ab", "tournament"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "px-4 py-1.5 rounded-pill text-sm transition-all",
                mode === m ? "bg-primary text-primary-foreground" : "text-foreground/60 hover:text-foreground",
              )}
            >
              {t(`app.analyze.mode.${m}`)}
            </button>
          ))}
        </div>
      )}

      {/* Stage content */}
      {stage === "upload" && mode === "single" && (
        <UploadStage onAnalyze={() => setStage("processing")} />
      )}

      {stage === "upload" && mode === "ab" && (
        <ABUploadStage onAnalyze={() => setStage("processing")} />
      )}

      {stage === "upload" && mode === "tournament" && (
        <TournamentUploadStage
          count={tourneyCount}
          setCount={setTourneyCount}
          onAnalyze={() => setStage("processing")}
        />
      )}

      {stage === "processing" && (
        <ProcessingStage onDone={() => setStage("results")} onCancel={reset} />
      )}

      {stage === "results" && mode === "single" && <ResultsStage onReset={reset} />}
      {stage === "results" && mode === "ab" && <ABResults onReset={reset} />}
      {stage === "results" && mode === "tournament" && <TournamentResults onReset={reset} />}
    </section>
  );
}

function ABUploadStage({ onAnalyze }: { onAnalyze: () => void }) {
  const { t } = useTranslation();
  const [a, setA] = useState<File | null>(null);
  const [b, setB] = useState<File | null>(null);
  const [variable, setVariable] = useState("");
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        {([{ side: "A", file: a, set: setA }, { side: "B", file: b, set: setB }] as const).map(({ side, file, set }) => (
          <div key={side} className="relative rounded-2xl border-2 border-dashed border-border min-h-[220px] flex flex-col items-center justify-center text-center px-6 py-10 bg-surface/50">
            <input
              type="file"
              accept="video/*"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => set(e.target.files?.[0] ?? null)}
            />
            <div className="text-3xl font-semibold text-foreground/30 mb-2">{side}</div>
            <div className="text-sm text-foreground/60">{file ? file.name : t("app.analyze.ab.drop", { side })}</div>
          </div>
        ))}
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-foreground/55 mb-1.5 font-medium">
          {t("app.analyze.ab.variable")}
        </label>
        <input
          value={variable}
          onChange={(e) => setVariable(e.target.value)}
          placeholder={t("app.analyze.ab.variable_placeholder")}
          className="w-full h-10 rounded-md bg-surface border border-input px-3 text-sm"
        />
      </div>
      <div className="flex justify-end">
        <Button variant="primary" size="lg" disabled={!a || !b} onClick={onAnalyze}>
          {t("app.analyze.ab.compare")}
        </Button>
      </div>
    </div>
  );
}

function TournamentUploadStage({
  count, setCount, onAnalyze,
}: { count: number; setCount: (n: number) => void; onAnalyze: () => void }) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<(File | null)[]>(() => Array(count).fill(null));

  const setFile = (i: number, f: File | null) => {
    const next = [...files];
    next[i] = f;
    setFiles(next);
  };
  const addSlot = () => {
    if (count >= 5) return;
    setCount(count + 1);
    setFiles([...files, null]);
  };
  const removeSlot = (i: number) => {
    if (count <= 2) return;
    setCount(count - 1);
    setFiles(files.filter((_, idx) => idx !== i));
  };
  const ready = files.filter(Boolean).length >= 2;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {files.map((f, i) => (
          <div key={i} className="relative rounded-xl border-2 border-dashed border-border min-h-[160px] flex flex-col items-center justify-center text-center px-3 py-6 bg-surface/50">
            <input
              type="file"
              accept="video/*"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => setFile(i, e.target.files?.[0] ?? null)}
            />
            <div className="text-2xl font-semibold text-foreground/30 mb-1">{i + 1}</div>
            <div className="text-xs text-foreground/55 px-2 truncate max-w-full">{f ? f.name : t("app.analyze.tour.drop")}</div>
            {count > 2 && (
              <button
                onClick={(e) => { e.preventDefault(); removeSlot(i); }}
                className="absolute top-2 right-2 h-6 w-6 rounded-full bg-foreground/[0.06] text-foreground/50 hover:text-destructive flex items-center justify-center"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        {count < 5 && (
          <button
            onClick={addSlot}
            className="rounded-xl border-2 border-dashed border-border min-h-[160px] flex flex-col items-center justify-center text-center px-3 py-6 bg-surface/30 text-foreground/40 hover:text-primary hover:border-primary/50 transition-colors"
          >
            <Plus className="h-6 w-6 mb-1" />
            <div className="text-xs">{t("app.analyze.tour.add")}</div>
          </button>
        )}
      </div>
      <div className="flex justify-end">
        <Button variant="primary" size="lg" disabled={!ready} onClick={onAnalyze}>
          {t("app.analyze.tour.start")}
        </Button>
      </div>
    </div>
  );
}
