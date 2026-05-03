import { AGENT_LOADS, STAGES } from "./mockData";
import { cn } from "@/lib/utils";

export function AgentLoadStrip() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {AGENT_LOADS.map((l) => {
        const meta = STAGES.find((s) => s.id === l.stage)!;
        const hot = l.capacityPct >= 80;
        return (
          <div key={l.stage} className="rounded-lg border border-border bg-card p-3.5">
            <div className="flex items-center gap-2 mb-2.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: `hsl(${meta.color})` }}
              />
              <span className="text-[10px] uppercase tracking-wider text-foreground/55 font-medium">
                {meta.label}
              </span>
            </div>
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-xl font-semibold tabular-nums">{l.active}</div>
              <div className="text-[10px] text-foreground/45 tabular-nums">+{l.queued} queued</div>
            </div>
            <div className="h-1 w-full bg-foreground/[0.06] rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", hot ? "bg-amber-500" : "bg-foreground/40")}
                style={{ width: `${l.capacityPct}%` }}
              />
            </div>
            <div className="text-[10px] text-foreground/40 mt-1.5 tabular-nums">
              {l.capacityPct}% capacity
            </div>
          </div>
        );
      })}
    </div>
  );
}
