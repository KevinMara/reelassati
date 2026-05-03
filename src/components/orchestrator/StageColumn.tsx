import { Job, AgentStage, STAGES } from "./mockData";
import { JobCard } from "./JobCard";

export function StageColumn({ stage, jobs }: { stage: AgentStage; jobs: Job[] }) {
  const meta = STAGES.find((s) => s.id === stage)!;
  const list = jobs.filter((j) => j.stage === stage);
  const running = list.filter((j) => j.status === "running").length;

  return (
    <div className="flex flex-col min-w-[260px] w-[260px]">
      <div className="flex items-center justify-between px-1 mb-2.5">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: `hsl(${meta.color})` }}
          />
          <span className="text-[11px] uppercase tracking-wider font-medium text-foreground/60">
            {meta.label}
          </span>
          <span className="text-[10px] text-foreground/35 tabular-nums">
            {list.length}
          </span>
        </div>
        {running > 0 && (
          <span className="text-[10px] text-sky-600 dark:text-sky-400 tabular-nums">
            {running} live
          </span>
        )}
      </div>
      <div className="rounded-xl bg-foreground/[0.025] dark:bg-foreground/[0.02] border border-border/60 p-2 space-y-2 flex-1 min-h-[120px]">
        {list.length === 0 ? (
          <div className="text-[11px] text-foreground/35 text-center py-8">
            Nothing here
          </div>
        ) : (
          list.map((j) => <JobCard key={j.id} job={j} />)
        )}
      </div>
    </div>
  );
}
