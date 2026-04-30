import { useTranslation } from "react-i18next";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MockVideoPlayer } from "./MockVideoPlayer";

const TOURNAMENT_ENTRIES = [
  { id: 1, label: "Variant 1", score: 76, gradient: "from-amber-300 via-orange-500 to-red-600", rank: 1 },
  { id: 2, label: "Variant 2", score: 71, gradient: "from-rose-300 via-pink-500 to-fuchsia-600", rank: 2 },
  { id: 3, label: "Variant 3", score: 68, gradient: "from-orange-300 via-red-400 to-rose-600", rank: 3 },
  { id: 4, label: "Variant 4", score: 62, gradient: "from-yellow-300 via-orange-400 to-red-500", rank: 4 },
  { id: 5, label: "Variant 5", score: 54, gradient: "from-lime-300 via-emerald-400 to-teal-500", rank: 5 },
];

export function TournamentResults({ onReset }: { onReset: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-8 animate-fade-up">
      <div className="rounded-2xl bg-surface border border-border shadow-card p-6 md:p-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill bg-success/10 text-success text-xs font-medium uppercase tracking-wider">
          <Trophy className="h-3.5 w-3.5" />
          {t("app.analyze.tour.winner")}: Variant 1
        </div>
        <p className="mt-3 text-sm text-foreground/60 max-w-xl mx-auto">
          {t("app.analyze.tour.summary")}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/60 mb-4">
          {t("app.analyze.tour.bracket")}
        </h3>
        <ol className="space-y-3">
          {TOURNAMENT_ENTRIES.map((e) => (
            <li
              key={e.id}
              className="grid grid-cols-[auto_60px_1fr_auto] gap-4 items-center p-3 rounded-lg border border-border"
            >
              <span className={`h-8 w-8 rounded-full flex items-center justify-center font-semibold tabular text-sm ${e.rank === 1 ? "bg-success/15 text-success" : "bg-foreground/[0.05] text-foreground/60"}`}>
                {e.rank}
              </span>
              <MockVideoPlayer thumbnailGradient={e.gradient} className="w-12 !aspect-[9/16] !rounded" />
              <div>
                <div className="font-medium">{e.label}</div>
                <div className="text-xs text-foreground/50 mt-0.5">{t("app.analyze.tour.matches", { wins: 5 - e.rank, losses: e.rank - 1 })}</div>
              </div>
              <div className="text-right">
                <div className="text-xl tabular font-semibold">{e.score}</div>
                <div className="text-[10px] uppercase tracking-wider text-foreground/40">score</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onReset}>{t("app.analyze.tour.new")}</Button>
        <Button variant="primary">{t("app.analyze.tour.use_winner")}</Button>
      </div>
    </div>
  );
}
