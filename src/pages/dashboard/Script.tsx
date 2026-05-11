import { useEffect, useState } from "react";
import { PenLine } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ScriptBriefStage, ScriptBrief } from "@/components/script/ScriptBriefStage";
import { ScriptGeneratingStage } from "@/components/script/ScriptGeneratingStage";
import { ScriptResultsStage } from "@/components/script/ScriptResultsStage";
import { useJob } from "@/hooks/useJob";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ScriptVariant, generateVariants } from "@/components/script/mockData";

type Stage = "brief" | "generating" | "results";

export default function ScriptRoute() {
  return <AppShell renderWith={() => <ScriptPage />} />;
}

function ScriptPage() {
  const [stage, setStage] = useState<Stage>("brief");
  const [brief, setBrief] = useState<ScriptBrief | null>(null);
  const [variants, setVariants] = useState<ScriptVariant[] | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useJob(jobId);

  // When the job finishes, advance UI.
  useEffect(() => {
    if (!job) return;
    if (job.status === "completed" && job.result?.variants) {
      setVariants(job.result.variants as ScriptVariant[]);
      setStage("results");
    } else if (job.status === "failed") {
      toast({
        title: "Generation failed",
        description: job.error_details || "An unknown error occurred",
        variant: "destructive"
      });
      // Fall back to deterministic generator so the user isn't stuck.
      if (brief) {
        setVariants(generateVariants({ goal: brief.goal, angle: brief.angle }));
        setStage("results");
      }
    }
  }, [job, brief]);

  const onGenerate = async (b: ScriptBrief) => {
    try {
      setBrief(b);
      setStage("generating");
      setVariants(null);
      
      const { data, error } = await supabase.functions.invoke("generate-script", {
        body: {
          client_id: null,
          goal: b.goal,
          angle: b.angle,
          duration: b.duration,
          tone: b.tone.join(", "),
          format: b.format,
          platform: b.platforms[0] ?? "Reels",
          language: "it",
          references: b.references,
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Failed to start generation");
      }

      setJobId(data.job_id);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive"
      });
      setStage("brief");
    }
  };

  const onReset = () => {
    setJobId(null);
    setVariants(null);
    setBrief(null);
    setStage("brief");
  };

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

      {stage === "brief" && <ScriptBriefStage onGenerate={onGenerate} />}
      {stage === "generating" && (
        <ScriptGeneratingStage
          progress={job?.progress_pct ?? 0}
          message={job?.progress_message ?? "Queued…"}
          onCancel={onReset}
        />
      )}
      {stage === "results" && brief && variants && (
        <ScriptResultsStage brief={brief} variants={variants} onReset={onReset} />
      )}
    </section>
  );
}
