import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const STAGES = [
  "Reading client brief…",
  "Surveying reference cohort…",
  "Drafting hooks (12 candidates)…",
  "Scoring against retention model…",
  "Selecting top 3 angles…",
  "Writing voiceover & visual direction…",
];

export function ScriptGeneratingStage({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= STAGES.length) {
      const t = setTimeout(onDone, 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI(i + 1), 700 + Math.random() * 600);
    return () => clearTimeout(t);
  }, [i, onDone]);

  return (
    <div className="max-w-xl mx-auto py-16 text-center">
      <div className="inline-flex h-14 w-14 rounded-2xl bg-primary/10 text-primary items-center justify-center mb-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
      <h2 className="text-2xl font-semibold mb-8">Writing your script.</h2>
      <ul className="space-y-2 text-left max-w-sm mx-auto">
        {STAGES.map((s, idx) => (
          <li
            key={s}
            className={`flex items-center gap-3 text-sm transition-all duration-300 ${
              idx < i ? "text-foreground/80" : idx === i ? "text-foreground" : "text-foreground/30"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full transition-all ${
                idx < i ? "bg-primary" : idx === i ? "bg-primary animate-pulse" : "bg-foreground/15"
              }`}
            />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
