import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Network, Filter, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { StageColumn } from "@/components/orchestrator/StageColumn";
import { WorkloadHeatmap } from "@/components/orchestrator/WorkloadHeatmap";
import { AgentLoadStrip } from "@/components/orchestrator/AgentLoadStrip";
import { JOBS as MOCK_JOBS, CLIENTS, STAGES, type Job, type AgentStage } from "@/components/orchestrator/mockData";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const AGENT_TO_STAGE: Record<string, AgentStage> = {
  analyzer: "analyze",
  scriptwriter: "script",
  editor: "edit",
  publisher: "publish",
  analytics: "analytics",
};

const STATUS_MAP: Record<string, Job["status"]> = {
  queued: "queued",
  running: "running",
  completed: "done",
  failed: "blocked",
};

export default function OrchestratorPage() {
  return <AppShell renderWith={() => <OrchestratorContent />} />;
}

function OrchestratorContent() {
  const [activeClient, setActiveClient] = useState<string | "all">("all");
  const [liveJobs, setLiveJobs] = useState<Job[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("jobs")
        .select("id, agent_name, job_type, status, progress_pct, payload, result, created_at, client_id")
        .order("created_at", { ascending: false })
        .limit(40);
      if (cancelled || !data) return;
      const mapped: Job[] = data
        .map((row): Job | null => {
          const stage = AGENT_TO_STAGE[row.agent_name as string];
          if (!stage) return null;
          return {
            id: row.id,
            clientId: row.client_id ?? "live",
            clientName: "Live job",
            clientColor: "265 70% 60%",
            title: row.job_type ?? row.agent_name,
            stage,
            status: STATUS_MAP[row.status] ?? "queued",
            progress: (row.progress_pct ?? 0) / 100,
            updatedAt: relTime(row.created_at as string),
          };
        })
        .filter((j): j is Job => j !== null);
      setLiveJobs(mapped);
    }
    load();
    const ch = supabase
      .channel("orchestrator-jobs")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  const allJobs = useMemo(() => [...liveJobs, ...MOCK_JOBS], [liveJobs]);
  const filteredJobs = useMemo(
    () => (activeClient === "all" ? allJobs : allJobs.filter((j) => j.clientId === activeClient)),
    [allJobs, activeClient],
  );

  const totalActive = filteredJobs.filter((j) => j.status === "running").length;
  const needsReview = filteredJobs.filter((j) => j.status === "needs_review").length;
  const blocked = filteredJobs.filter((j) => j.status === "blocked").length;

  return (
    <section className="p-6 lg:p-10 max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-end justify-between flex-wrap gap-4"
      >
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider text-foreground/45 font-medium mb-2">
            <Network className="h-3.5 w-3.5" /> Orchestrator
          </div>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ textWrap: "balance" } as React.CSSProperties}>
            Every client. Every agent. One board.
          </h1>
          <p className="text-sm text-foreground/55 mt-1.5 max-w-xl">
            See what's running, what's stuck, and what needs your eye — across the entire roster.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-3.5 w-3.5" /> Rules
          </Button>
          <Button size="sm">
            <Sparkles className="h-3.5 w-3.5" /> Auto-balance
          </Button>
        </div>
      </motion.header>

      {/* Live counters */}
      <div className="flex items-center gap-6 flex-wrap text-sm">
        <Counter label="Live now" value={totalActive} dotClass="bg-sky-500 animate-pulse" />
        <Counter label="Needs your review" value={needsReview} dotClass="bg-amber-500" />
        <Counter label="Blocked" value={blocked} dotClass="bg-rose-500" />
      </div>

      {/* Agent load */}
      <AgentLoadStrip />

      {/* Client filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setActiveClient("all")}
          className={cn(
            "text-xs px-3 py-1.5 rounded-full border transition-all",
            activeClient === "all"
              ? "border-foreground/30 bg-foreground/[0.04] text-foreground"
              : "border-border text-foreground/50 hover:text-foreground/80",
          )}
        >
          All clients ({allJobs.length})
        </button>
        {CLIENTS.map((c) => {
          const count = allJobs.filter((j) => j.clientId === c.id).length;
          const on = activeClient === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setActiveClient(c.id)}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all",
                on
                  ? "border-foreground/30 bg-foreground/[0.04] text-foreground"
                  : "border-border text-foreground/50 hover:text-foreground/80",
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${c.color})` }} />
              {c.name}
              <span className="text-foreground/35 tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto -mx-6 lg:-mx-10 px-6 lg:px-10 pb-2">
        <div className="flex gap-4 min-w-max">
          {STAGES.map((s) => (
            <StageColumn key={s.id} stage={s.id} jobs={filteredJobs} />
          ))}
        </div>
      </div>

      {/* Workload heatmap */}
      <WorkloadHeatmap />
    </section>
  );
}

function Counter({ label, value, dotClass }: { label: string; value: number; dotClass: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2 w-2 rounded-full", dotClass)} />
      <span className="text-foreground/55">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
