import { useState } from "react";
import { PenLine } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ScriptBriefStage, ScriptBrief } from "@/components/script/ScriptBriefStage";
import { ScriptGeneratingStage } from "@/components/script/ScriptGeneratingStage";
import { ScriptResultsStage } from "@/components/script/ScriptResultsStage";

type Stage = "brief" | "generating" | "results";

export default function ScriptRoute() {
  return <AppShell renderWith={() => <ScriptPage />} />;
}

function ScriptPage() {
  const [stage, setStage] = useState<Stage>("brief");
  const [brief, setBrief] = useState<ScriptBrief | null>(null);

  return (
    <section className="container-page py-8 lg:py-10">
      <header className="mb-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <PenLine className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">Scriptwriter</h1>
          <p className="text-sm text-foreground/55 mt-0.5">
            Tell the agent what to say. Get three angles. Edit. Ship.
          </p>
        </div>
      </header>

      {stage === "brief" && (
        <ScriptBriefStage
          onGenerate={(b) => {
            setBrief(b);
            setStage("generating");
          }}
        />
      )}
      {stage === "generating" && <ScriptGeneratingStage onDone={() => setStage("results")} />}
      {stage === "results" && brief && (
        <ScriptResultsStage brief={brief} onReset={() => setStage("brief")} />
      )}
    </section>
  );
}
