import { AppShell } from "@/components/app/AppShell";
import { StageColumn } from "@/components/orchestrator/StageColumn";
import { AgentLoadStrip } from "@/components/orchestrator/AgentLoadStrip";
import { WorkloadHeatmap } from "@/components/orchestrator/WorkloadHeatmap";
import { STAGES, JOBS, AGENT_LOADS, buildWorkload } from "@/components/orchestrator/mockData";
import { useTranslation } from "react-i18next";
import { LayoutGrid, Activity } from "lucide-react";

export default function Orchestrator() {
  const { t } = useTranslation();
  const workload = buildWorkload();

  return (
    <AppShell>
      <div className="p-8 max-w-[1600px] mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="mono-eyebrow text-primary mb-2">{t("app.nav.admin")}</p>
            <h1 className="text-3xl font-semibold tracking-tight">Multi-Client Orchestrator</h1>
            <p className="text-foreground/60 mt-2">Manage all active jobs and agent loads across your workspace.</p>
          </div>
        </header>

        {/* Agent Load Summary */}
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/50 mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4" /> Agent Load Status
          </h3>
          <AgentLoadStrip loads={AGENT_LOADS} />
        </section>

        {/* Pipeline Board */}
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/50 mb-4 flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" /> Pipeline Board
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
            {STAGES.map((s) => (
              <StageColumn
                key={s.id}
                stage={s}
                jobs={JOBS.filter((j) => j.stage === s.id)}
              />
            ))}
          </div>
        </section>

        {/* Global Workload Heatmap */}
        <section className="bg-surface border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/50 mb-6">
            Global Infrastructure Workload
          </h3>
          <WorkloadHeatmap cells={workload} />
        </section>
      </div>
    </AppShell>
  );
}
