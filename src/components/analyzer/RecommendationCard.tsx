import { useState } from "react";
import { ChevronDown, Send, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface Recommendation {
  rank: number;
  what: string;
  why: string;
  expectedImpact: number; // expected score lift in points
  how: string[];
  difficulty: "easy" | "medium" | "hard";
  confidence: "high" | "medium" | "low";
}

const diffColor: Record<Recommendation["difficulty"], string> = {
  easy: "bg-success/15 text-success",
  medium: "bg-warning/15 text-warning",
  hard: "bg-destructive/15 text-destructive",
};

export function RecommendationCard({ r, onSend, onCopy, onSkip }: {
  r: Recommendation;
  onSend?: () => void;
  onCopy?: () => void;
  onSkip?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-surface p-5 transition-all duration-300 ease-out-expo hover:shadow-card-hover">
      <div className="flex gap-4">
        <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary font-semibold tabular flex items-center justify-center">
          {r.rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h4 className="font-semibold text-foreground leading-snug">{r.what}</h4>
            <div className="flex gap-1.5 shrink-0">
              <span className={cn("text-[10px] uppercase px-2 py-0.5 rounded-full tracking-wider font-medium", diffColor[r.difficulty])}>
                {r.difficulty}
              </span>
              <span className="text-[10px] uppercase px-2 py-0.5 rounded-full tracking-wider font-medium bg-foreground/[0.06] text-foreground/60">
                {r.confidence}
              </span>
            </div>
          </div>

          <p className="mt-1.5 text-sm text-foreground/70">{r.why}</p>

          {/* Expected impact mini chart */}
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-foreground/50 shrink-0">Expected impact</span>
            <div className="flex-1 h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700 ease-out-expo"
                style={{ width: `${Math.min(100, r.expectedImpact * 4)}%` }}
              />
            </div>
            <span className="tabular text-xs text-primary font-medium">+{r.expectedImpact}</span>
          </div>

          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {open ? "Hide" : "How to"}
            <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
          </button>

          {open && (
            <ol className="mt-2 pl-4 list-decimal text-sm text-foreground/70 space-y-1">
              {r.how.map((step, i) => <li key={i}>{step}</li>)}
            </ol>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={onSend}>
              <Send className="h-3.5 w-3.5" /> Send to Editor
            </Button>
            <Button variant="outline" size="sm" onClick={onCopy}>
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={onSkip}>
              <X className="h-3.5 w-3.5" /> Skip
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
