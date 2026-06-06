import { useState, useEffect } from "react";
import { AppShell } from "@/components/app/AppShell";
import { ScriptBriefStage, type ScriptBrief } from "@/components/script/ScriptBriefStage";
import { ScriptGeneratingStage } from "@/components/script/ScriptGeneratingStage";
import { ScriptResultsStage } from "@/components/script/ScriptResultsStage";
import { useTranslation } from "react-i18next";

export default function Script() {
  const { t } = useTranslation();
  const [stage, setStage] = useState<"brief" | "generating" | "results">("brief");
  const [brief, setBrief] = useState<ScriptBrief | null>(null);
  const [progress, setProgress] = useState(0);

  const handleGenerate = (b: ScriptBrief) => {
    setBrief(b);
    setStage("generating");
    setProgress(0);
  };

  useEffect(() => {
    if (stage === "generating") {
      const interval = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            clearInterval(interval);
            setStage("results");
            return 100;
          }
          return p + 2;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [stage]);

  return (
    <AppShell>
      <div className="p-8 max-w-7xl mx-auto">
        <header className="mb-8">
          <p className="mono-eyebrow text-primary mb-2">{t("app.nav.script")}</p>
          <h1 className="text-3xl font-semibold tracking-tight">Script Engineering</h1>
          <p className="text-foreground/60 mt-2">Engineered against neural targets, scored before production.</p>
        </header>

        {stage === "brief" && <ScriptBriefStage onGenerate={handleGenerate} />}
        
        {stage === "generating" && (
          <ScriptGeneratingStage 
            progress={progress} 
            message="TRIBE agent is drafting..." 
          />
        )}
        
        {stage === "results" && brief && (
          <ScriptResultsStage 
            brief={brief} 
            onReset={() => setStage("brief")} 
          />
        )}
      </div>
    </AppShell>
  );
}
