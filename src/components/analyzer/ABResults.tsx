import { useTranslation } from "react-i18next";
import { Trophy, ArrowRight } from "lucide-react";
import { ScoreGauge } from "./ScoreGauge";
import { MockVideoPlayer } from "./MockVideoPlayer";
import { Button } from "@/components/ui/button";
import { MOCK_DIMENSIONS } from "./mockData";

const VARIANT_B_DELTA = [-4, +6, -2, +1, +9, -3];

export function ABResults({ onReset }: { onReset: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-8 animate-fade-up">
      {/* Verdict header */}
      <div className="rounded-2xl bg-surface border border-border shadow-card p-6 md:p-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill bg-success/10 text-success text-xs font-medium uppercase tracking-wider">
          <Trophy className="h-3.5 w-3.5" />
          {t("app.analyze.ab.winner")}: Element B
        </div>
        <div className="mt-4 text-3xl font-semibold tabular">+7.4%</div>
        <p className="mt-2 text-sm text-foreground/60 max-w-xl mx-auto">
          {t("app.analyze.ab.causal", { variable: t("app.analyze.ab.causal_var_default") })}
        </p>
      </div>

      {/* Two players sync-locked + scorecards */}
      <div className="grid lg:grid-cols-2 gap-6">
        {[
          { label: "A", grade: "B-", score: 68, gradient: "from-orange-300 via-red-400 to-rose-600" },
          { label: "B", grade: "B+", score: 76, gradient: "from-amber-300 via-orange-500 to-red-600", winner: true },
        ].map((v) => (
          <div key={v.label} className={`rounded-2xl border p-5 bg-surface ${v.winner ? "border-success/40" : "border-border"}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Element {v.label}</div>
              {v.winner && <span className="text-xs uppercase tracking-wider text-success">{t("app.analyze.ab.winner_badge")}</span>}
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-4 items-center">
              <MockVideoPlayer thumbnailGradient={v.gradient} className="max-w-[180px]" />
              <ScoreGauge value={v.score} grade={v.grade} size={110} />
            </div>
          </div>
        ))}
      </div>

      {/* Side-by-side dimensions with delta + root cause */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/60 mb-3">
          {t("app.analyze.ab.dim_comparison")}
        </h3>
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto_2fr] gap-4 px-5 py-3 bg-foreground/[0.03] text-[11px] uppercase tracking-wider text-foreground/55 font-medium">
            <span>{t("app.analyze.ab.dim")}</span>
            <span className="tabular text-right">A</span>
            <span className="tabular text-right">B</span>
            <span className="tabular text-right">Δ</span>
            <span>{t("app.analyze.ab.root_cause")}</span>
          </div>
          {MOCK_DIMENSIONS.map((d, i) => {
            const delta = VARIANT_B_DELTA[i] ?? 0;
            const bScore = d.score + delta;
            return (
              <div key={d.key} className="grid grid-cols-[1fr_auto_auto_auto_2fr] gap-4 px-5 py-3 border-t border-border items-center text-sm">
                <span className="font-medium">{d.name}</span>
                <span className="tabular text-right text-foreground/70">{d.score}</span>
                <span className="tabular text-right text-foreground/70">{bScore}</span>
                <span className={`tabular text-right font-medium ${delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-foreground/40"}`}>
                  {delta > 0 ? "+" : ""}{delta}
                </span>
                <span className="text-foreground/60 text-xs">
                  {delta > 0 ? t("app.analyze.ab.cause_b_better") : delta < 0 ? t("app.analyze.ab.cause_a_better") : t("app.analyze.ab.cause_tie")}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Variable identification */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/60 mb-3">
          {t("app.analyze.ab.variables")}
        </h3>
        <ol className="space-y-2 text-sm">
          {[
            { var: t("app.analyze.ab.var_pace"), impact: 0.62 },
            { var: t("app.analyze.ab.var_caption"), impact: 0.21 },
            { var: t("app.analyze.ab.var_lighting"), impact: 0.11 },
            { var: t("app.analyze.ab.var_audio"), impact: 0.06 },
          ].map((v, i) => (
            <li key={i} className="grid grid-cols-[auto_1fr_auto] gap-3 items-center">
              <span className="tabular text-foreground/40 text-xs">#{i + 1}</span>
              <span>{v.var}</span>
              <span className="tabular text-xs text-primary">{(v.impact * 100).toFixed(0)}%</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap gap-3 justify-end">
        <Button variant="outline" onClick={onReset}>{t("app.analyze.ab.new")}</Button>
        <Button variant="primary">
          {t("app.analyze.ab.apply_learning")} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
