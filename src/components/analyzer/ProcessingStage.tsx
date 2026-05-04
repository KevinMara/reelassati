import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_PROCESSING_STAGES } from "./mockData";

/**
 * Animated brain pulse + 8 named stages.
 * Drives a 30s simulation, calls onDone when all stages complete.
 */
export function ProcessingStage({
  onDone,
  onCancel,
  progress,
  message,
  done,
}: {
  onDone: () => void;
  onCancel: () => void;
  progress?: number;
  message?: string;
  done?: boolean;
}) {
  const { t } = useTranslation();
  const driven = progress != null;
  const [activeIdx, setActiveIdx] = useState(0);
  const [stageStart, setStageStart] = useState(performance.now());
  const [now, setNow] = useState(performance.now());

  const total = MOCK_PROCESSING_STAGES.reduce((s, st) => s + st.durationS, 0);
  const elapsed = driven
    ? (progress! / 100) * total
    : MOCK_PROCESSING_STAGES.slice(0, activeIdx).reduce((s, st) => s + st.durationS, 0)
      + Math.min((now - stageStart) / 1000, MOCK_PROCESSING_STAGES[activeIdx]?.durationS ?? 0);
  const remaining = Math.max(0, total - elapsed);
  const externalIdx = driven
    ? Math.min(MOCK_PROCESSING_STAGES.length - 1, Math.floor((progress! / 100) * MOCK_PROCESSING_STAGES.length))
    : activeIdx;

  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (driven) {
      if (done) onDone();
      return;
    }
    const tick = () => {
      const t = performance.now();
      setNow(t);
      const stage = MOCK_PROCESSING_STAGES[activeIdx];
      if (!stage) return;
      if ((t - stageStart) / 1000 >= stage.durationS) {
        if (activeIdx + 1 >= MOCK_PROCESSING_STAGES.length) {
          onDone();
          return;
        }
        setActiveIdx((i) => i + 1);
        setStageStart(t);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [activeIdx, stageStart, onDone, driven, done]);

  return (
    <div className="max-w-2xl mx-auto py-12 text-center">
      {/* Brain pulse SVG */}
      <div className="relative inline-block">
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-3xl animate-pulse-soft" />
        <div className="relative h-32 w-32 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center">
          <Cpu className="h-12 w-12 text-primary" />
          {/* Pulse rings */}
          <span className="absolute inset-0 rounded-full border border-primary/40 animate-ping" />
          <span className="absolute inset-2 rounded-full border border-primary/20 animate-ping" style={{ animationDelay: "0.6s" }} />
        </div>
      </div>

      <h2 className="mt-8 text-2xl font-semibold">{t("app.analyze.processing.title")}</h2>
      <p className="mt-2 text-foreground/55 text-sm tabular">
        {driven
          ? `${message ?? "Processing…"} · ${Math.round(progress!)}%`
          : t("app.analyze.processing.eta", { sec: Math.ceil(remaining) })}
      </p>

      <ol className="mt-10 space-y-2.5 text-left max-w-md mx-auto">
        {MOCK_PROCESSING_STAGES.map((stage, i) => {
          const status = i < externalIdx ? "done" : i === externalIdx ? "active" : "pending";
          return (
            <li
              key={stage.key}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-all duration-300",
                status === "active" && "border-primary/40 bg-primary/[0.04]",
                status === "done" && "border-border bg-surface opacity-70",
                status === "pending" && "border-transparent opacity-40",
              )}
            >
              <span
                className={cn(
                  "h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-medium",
                  status === "done" && "bg-success text-white",
                  status === "active" && "bg-primary text-primary-foreground",
                  status === "pending" && "bg-foreground/10 text-foreground/40",
                )}
              >
                {status === "done" ? "✓" : status === "active" ? <Loader2 className="h-3 w-3 animate-spin" /> : i + 1}
              </span>
              <span className={cn("text-sm flex-1", status === "active" && "text-foreground font-medium")}>
                {t(`app.analyze.processing.stages.${stage.key}`)}
              </span>
            </li>
          );
        })}
      </ol>

      <button
        onClick={onCancel}
        className="mt-8 text-xs text-foreground/40 hover:text-foreground/70 underline"
      >
        {t("app.analyze.processing.cancel")}
      </button>
    </div>
  );
}
