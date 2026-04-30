import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DimensionData {
  key: string;
  name: string;
  score: number; // 0-100
  confidence: "high" | "medium" | "low";
  reason: string;
  signals?: { label: string; weight: number; timestamp?: string }[];
}

const confColor: Record<DimensionData["confidence"], string> = {
  high: "bg-success/15 text-success",
  medium: "bg-warning/15 text-warning",
  low: "bg-destructive/15 text-destructive",
};

export function DimensionCard({ d }: { d: DimensionData }) {
  const [open, setOpen] = useState(false);
  const pct = Math.max(0, Math.min(100, d.score));
  const bar =
    pct >= 80 ? "bg-success" : pct >= 60 ? "bg-primary" : pct >= 40 ? "bg-warning" : "bg-destructive";

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface p-5 transition-all duration-300 ease-out-expo hover:shadow-card-hover hover:-translate-y-0.5",
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-foreground/50 font-medium">{d.name}</div>
          <div className="mt-1 text-3xl font-semibold tabular text-foreground leading-none">{Math.round(d.score)}</div>
        </div>
        <span className={cn("text-[10px] uppercase px-2 py-0.5 rounded-full tracking-wider font-medium", confColor[d.confidence])}>
          {d.confidence}
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden mb-3">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out-expo", bar)}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-sm text-foreground/70 leading-snug">{d.reason}</p>

      {d.signals && d.signals.length > 0 && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {open ? "Hide" : "Show"} signals
            <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div className="mt-3 pt-3 border-t border-border space-y-1.5">
              {d.signals.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-foreground/70">
                    {s.label}
                    {s.timestamp && <span className="text-foreground/40 ml-1">@ {s.timestamp}</span>}
                  </span>
                  <span className="tabular text-foreground/50">w {s.weight.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
