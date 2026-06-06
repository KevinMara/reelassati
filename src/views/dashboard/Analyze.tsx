import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/app/AppShell";
import { UploadStage, type AnalyzePayload } from "@/components/analyzer/UploadStage";
import { ProcessingStage } from "@/components/analyzer/ProcessingStage";
import { ResultsStage } from "@/components/analyzer/ResultsStage";
import { MOCK_VERDICT } from "@/components/analyzer/mockData";

type Stage = "upload" | "processing" | "results";

export default function Analyze() {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>("upload");
  const [payload, setPayload] = useState<AnalyzePayload | null>(null);

  const handleAnalyze = (p: AnalyzePayload) => {
    setPayload(p);
    setStage("processing");
  };

  const handleDone = () => {
    setStage("results");
  };

  const handleReset = () => {
    setStage("upload");
    setPayload(null);
  };

  return (
    <AppShell>
      <div className="p-8 max-w-7xl mx-auto">
        <header className="mb-8">
          <p className="mono-eyebrow text-primary mb-2">{t("app.nav.analyze")}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{t("app.analyze.title")}</h1>
          <p className="text-foreground/60 mt-2">{t("app.analyze.sub")}</p>
        </header>

        {stage === "upload" && <UploadStage onAnalyze={handleAnalyze} />}
        
        {stage === "processing" && (
          <ProcessingStage 
            onDone={handleDone} 
            onCancel={handleReset} 
          />
        )}
        
        {stage === "results" && (
          <ResultsStage 
            onReset={handleReset} 
            verdict={{
              ...MOCK_VERDICT,
              goal: payload?.goal ? t(`app.analyze.upload.goals.${payload.goal}`) : MOCK_VERDICT.goal,
              platform: payload?.platform || MOCK_VERDICT.platform,
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
