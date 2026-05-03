import { Sparkles, AlertTriangle, Lightbulb } from "lucide-react";
import { Insight } from "./mockData";
import { cn } from "@/lib/utils";

const KIND_META = {
  win: { Icon: Sparkles, color: "emerald", label: "Win" },
  warn: { Icon: AlertTriangle, color: "amber", label: "Watch out" },
  idea: { Icon: Lightbulb, color: "primary", label: "Idea" },
} as const;

export function InsightCard({ insight }: { insight: Insight }) {
  const meta = KIND_META[insight.kind];
  const Icon = meta.Icon;
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex gap-3 transition-[box-shadow,transform] duration-200 hover:shadow-md">
      <div
        className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
          meta.color === "emerald" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          meta.color === "amber" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
          meta.color === "primary" && "bg-primary/10 text-primary",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-foreground/45 font-medium mb-1">
          {meta.label}
        </div>
        <div className="text-sm font-semibold leading-tight mb-1.5">{insight.title}</div>
        <p className="text-xs text-foreground/60 leading-relaxed">{insight.body}</p>
      </div>
    </div>
  );
}
