import { Loader2, X } from "lucide-react";

const STAGES = [
  "Reading client brief…",
  "Surveying reference cohort…",
  "Drafting hooks…",
  "Scoring against retention model…",
  "Selecting top 3 angles…",
  "Writing voiceover & visual direction…",
];

export function ScriptGeneratingStage({
  progress,
  message,
  onCancel,
}: {
  progress: number;
  message: string;
  onCancel?: () => void;
}) {
  // Map progress to stage index for the visual stepper
  const activeIdx = Math.min(STAGES.length - 1, Math.floor((progress / 100) * STAGES.length));

  return (
    <div className="max-w-xl mx-auto py-16 text-center">
      <div className="inline-flex h-14 w-14 rounded-2xl bg-primary/10 text-primary items-center justify-center mb-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
      <h2 className="text-2xl font-semibold mb-2">Writing your script.</h2>
      <p className="text-sm text-foreground/55 mb-8 tabular-nums">
        {message} · {progress}%
      </p>
      <ul className="space-y-2 text-left max-w-sm mx-auto">
        {STAGES.map((s, idx) => (
          <li
            key={s}
            className={`flex items-center gap-3 text-sm transition-all duration-300 ${
              idx < activeIdx ? "text-foreground/80" : idx === activeIdx ? "text-foreground" : "text-foreground/30"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full transition-all ${
                idx < activeIdx ? "bg-primary" : idx === activeIdx ? "bg-primary animate-pulse" : "bg-foreground/15"
              }`}
            />
            {s}
          </li>
        ))}
      </ul>

      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-10 inline-flex items-center gap-1.5 text-xs text-foreground/40 hover:text-foreground/80"
        >
          <X className="h-3 w-3" /> Cancel
        </button>
      )}
    </div>
  );
}
