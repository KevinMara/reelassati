import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Share2, BookOpen, RotateCcw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoreGauge } from "./ScoreGauge";
import { DimensionCard } from "./DimensionCard";
import { RecommendationCard } from "./RecommendationCard";
import { MockVideoPlayer } from "./MockVideoPlayer";
import { NeuralBrainViz, BRAIN_REGIONS } from "./NeuralBrainViz";
import { TimelineScrubber } from "./TimelineScrubber";
import { RegionActivationLane } from "./RegionActivationLane";
import {
  MOCK_VERDICT,
  MOCK_DIMENSIONS,
  MOCK_RECOMMENDATIONS,
  MOCK_MARKERS,
  MOCK_REGION_INTENSITIES,
  MOCK_DURATION_S,
} from "./mockData";

export function ResultsStage({
  onReset,
  verdict: verdictOverride,
}: {
  onReset: () => void;
  verdict?: typeof MOCK_VERDICT;
}) {
  const { t } = useTranslation();
  const verdict = verdictOverride ?? MOCK_VERDICT;
  const [time, setTime] = useState(0);
  const [selectedMarker, setSelectedMarker] = useState<number | null>(null);
  const [showExports, setShowExports] = useState(false);

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Verdict card */}
      <div className="rounded-2xl bg-surface border border-border shadow-card p-6 md:p-8 relative overflow-hidden">
        {/* Subtle accent border colored by grade */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

        <div className="grid md:grid-cols-[auto_1fr_auto] gap-6 md:gap-8 items-center">
          <ScoreGauge value={verdict.score} grade={verdict.grade} size={140} thickness={12} />
          <div>
            <div className="mono-eyebrow text-foreground/50">{t("app.analyze.results.verdict")}</div>
            <p className="mt-2 text-lg leading-relaxed text-foreground/85 text-pretty max-w-2xl">
              {verdict.text}
            </p>
          </div>
          <div className="text-xs text-foreground/55 space-y-1.5 md:text-right tabular">
            <div><span className="text-foreground/40">{t("app.analyze.results.goal")}:</span> {verdict.goal}</div>
            <div><span className="text-foreground/40">{t("app.analyze.results.cohort")}:</span> N={verdict.cohort}</div>
            <div><span className="text-foreground/40">{t("app.analyze.results.lang")}:</span> {verdict.language}</div>
            <div><span className="text-foreground/40">{t("app.analyze.results.platform")}:</span> {verdict.platform}</div>
          </div>
        </div>
      </div>

      {/* Six dimension scorecard */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/60 mb-3">
          {t("app.analyze.results.dimensions")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MOCK_DIMENSIONS.map((d) => <DimensionCard key={d.key} d={d} />)}
        </div>
      </section>

      {/* Interactive timeline + brain */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/60 mb-3">
          {t("app.analyze.results.timeline")}
        </h3>
        <div className="grid lg:grid-cols-[280px_320px_1fr] gap-5">
          <MockVideoPlayer
            duration={MOCK_DURATION_S}
            currentTime={time}
            onTimeChange={setTime}
            className="w-full max-w-[280px] mx-auto lg:mx-0"
          />

          <div className="rounded-xl border border-border bg-surface p-3">
            <div className="text-[11px] uppercase tracking-wider text-foreground/50 font-medium mb-2 px-1">
              {t("app.analyze.results.brain")}
            </div>
            <NeuralBrainViz
              intensities={MOCK_REGION_INTENSITIES.map((v, i) => {
                // Light pulse over time so it feels alive
                const phase = (time / MOCK_DURATION_S) * Math.PI * 2;
                return Math.max(0, Math.min(1, v * (0.7 + Math.sin(phase + i) * 0.3)));
              })}
              size={280}
              className="mx-auto"
            />
            <div className="text-[10px] text-foreground/40 text-center mt-2">
              {t("app.analyze.results.brain_hint")}
            </div>
          </div>

          <div className="space-y-4">
            <TimelineScrubber
              duration={MOCK_DURATION_S}
              currentTime={time}
              onSeek={setTime}
              markers={MOCK_MARKERS}
              selectedMarkerIdx={selectedMarker ?? undefined}
              onSelectMarker={(i) => {
                setSelectedMarker(i);
                setTime(MOCK_MARKERS[i].t);
              }}
            />
            {/* Region activation lanes */}
            <div className="rounded-xl border border-border bg-surface p-3 space-y-1.5 max-h-[260px] overflow-y-auto">
              {BRAIN_REGIONS.map((r, i) => (
                <RegionActivationLane
                  key={r.name}
                  name={r.name}
                  seed={i + 1}
                  duration={MOCK_DURATION_S}
                  currentTime={time}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Marker detail panel */}
        {selectedMarker !== null && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/[0.03] p-4 animate-fade-up">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-primary font-medium">
                  {MOCK_MARKERS[selectedMarker].t.toFixed(1)}s · {MOCK_MARKERS[selectedMarker].type}
                </div>
                <div className="mt-1 font-medium">{MOCK_MARKERS[selectedMarker].label}</div>
                <p className="mt-2 text-sm text-foreground/70">
                  {t("app.analyze.results.marker_detail")}
                </p>
              </div>
              <button
                onClick={() => setSelectedMarker(null)}
                className="text-xs text-foreground/40 hover:text-foreground/70"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Top 5 recommendations */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/60 mb-3">
          {t("app.analyze.results.recommendations")}
        </h3>
        <div className="space-y-3">
          {MOCK_RECOMMENDATIONS.map((r) => <RecommendationCard key={r.rank} r={r} />)}
        </div>
      </section>

      {/* Reference basis */}
      <div className="text-xs text-foreground/50 border-t border-border pt-4">
        {t("app.analyze.results.basis")} · <span className="text-success">{t("app.analyze.results.confidence_high")}</span> · <a className="text-primary hover:underline" href="/dashboard/library">{t("app.analyze.results.open_library")}</a>
      </div>

      {/* Export floating button */}
      <div className="fixed bottom-24 right-6 z-30">
        <div className="relative">
          {showExports && (
            <div className="absolute bottom-14 right-0 w-64 rounded-xl bg-surface border border-border shadow-modal py-1 animate-fade-up">
              {[
                { label: t("app.analyze.results.export.json"), icon: Download },
                { label: t("app.analyze.results.export.matrix"), icon: Download },
                { label: t("app.analyze.results.export.edit_template"), icon: Download },
                { label: t("app.analyze.results.export.share"), icon: Share2 },
                { label: t("app.analyze.results.export.send_library"), icon: BookOpen },
              ].map((it, i) => (
                <button
                  key={i}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-foreground/[0.04]"
                >
                  <it.icon className="h-4 w-4 text-foreground/50" />
                  {it.label}
                </button>
              ))}
              <div className="border-t border-border mt-1 pt-1">
                <button
                  onClick={onReset}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-foreground/[0.04] text-foreground/70"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t("app.analyze.results.new_analysis")}
                </button>
              </div>
            </div>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={() => setShowExports((v) => !v)}
            className="shadow-card-hover"
          >
            <Download className="h-4 w-4" />
            {t("app.analyze.results.export.button")}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showExports ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </div>
    </div>
  );
}
