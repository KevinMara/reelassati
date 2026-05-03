import { Clock, AlertTriangle, CheckCircle2, Loader2, Eye } from "lucide-react";
import { Job } from "./mockData";
import { cn } from "@/lib/utils";

const STATUS_META: Record<Job["status"], { label: string; tone: string; Icon: any }> = {
  queued:        { label: "Queued",        tone: "text-foreground/45 border-border",                     Icon: Clock },
  running:       { label: "Running",       tone: "text-sky-600 dark:text-sky-400 border-sky-500/30",    Icon: Loader2 },
  needs_review:  { label: "Needs review",  tone: "text-amber-600 dark:text-amber-400 border-amber-500/30", Icon: Eye },
  blocked:       { label: "Blocked",       tone: "text-rose-600 dark:text-rose-400 border-rose-500/30", Icon: AlertTriangle },
  done:          { label: "Done",          tone: "text-emerald-600 dark:text-emerald-400 border-emerald-500/30", Icon: CheckCircle2 },
};

export function JobCard({ job }: { job: Job }) {
  const meta = STATUS_META[job.status];
  const Icon = meta.Icon;
  const initials = job.clientName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="group rounded-lg border border-border bg-card p-3 hover:border-foreground/20 hover:shadow-sm transition-all">
      <div className="flex items-start gap-2.5">
        <div
          className="h-7 w-7 rounded-md flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
          style={{ background: `hsl(${job.clientColor})` }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-foreground/50 truncate">{job.clientName}</div>
          <div className="text-sm font-medium leading-snug mt-0.5" style={{ textWrap: "pretty" } as React.CSSProperties}>
            {job.title}
          </div>
        </div>
      </div>

      {/* Progress */}
      {job.status === "running" && (
        <div className="mt-3">
          <div className="h-1 w-full bg-foreground/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-sky-500 transition-all" style={{ width: `${job.progress * 100}%` }} />
          </div>
        </div>
      )}

      {job.status === "blocked" && job.blockedReason && (
        <div className="mt-2.5 text-[11px] text-rose-600 dark:text-rose-400 leading-snug">
          {job.blockedReason}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded border",
            meta.tone,
          )}
        >
          <Icon className={cn("h-2.5 w-2.5", job.status === "running" && "animate-spin")} />
          {meta.label}
        </span>
        <div className="text-[10px] text-foreground/45 tabular-nums">
          {job.status === "running" && job.etaMin != null && `${job.etaMin}m`}
          {job.status === "queued" && job.etaMin != null && `eta ${job.etaMin}m`}
          {(job.status === "done" || job.status === "needs_review") && job.predictedScore != null && `score ${job.predictedScore}`}
          {job.status === "needs_review" && job.predictedScore == null && job.updatedAt}
        </div>
      </div>
    </div>
  );
}
