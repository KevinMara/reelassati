import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FolderKanban,
  RefreshCw,
  Target,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AnalyticsNavigation } from "@/components/analytics/AnalyticsNavigation";
import { getUiLocale, useUiText } from "@/lib/i18n/ui";
import { buildWeeklyReview } from "@/lib/weekly-review";
import { useWorkspace } from "@/providers/workspace";

export default function CoachingPage() {
  const ui = useUiText();
  const locale = getUiLocale();
  const { workspace, refresh, loading, saving } = useWorkspace();
  const [reviewedAt, setReviewedAt] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const report = useMemo(
    () => buildWeeklyReview(workspace, reviewedAt),
    [workspace, reviewedAt]
  );

  const refreshReview = async () => {
    if (refreshing || saving) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const refreshed = await refresh();
      if (!refreshed) {
        setRefreshError(ui("The latest workspace data could not be loaded."));
        return;
      }
      setReviewedAt(new Date());
    } catch (cause) {
      setRefreshError(
        cause instanceof Error
          ? cause.message
          : ui("The workspace review could not be refreshed.")
      );
    } finally {
      setRefreshing(false);
    }
  };

  if (loading)
    return (
      <div
        className="min-h-[45vh] animate-pulse rounded-xl bg-surface"
        role="status"
        aria-label={ui("Loading weekly coach")}
      />
    );

  const facts = [
    {
      label: "Projects touched · 7d",
      value: report.projectsTouched,
      icon: FolderKanban,
    },
    {
      label: "Confirmed published · 7d",
      value: report.postsPublished,
      icon: CheckCircle2,
    },
    {
      label: "Upcoming scheduled posts",
      value: report.scheduledPosts,
      icon: CalendarClock,
    },
    { label: "Active goals", value: report.activeGoals, icon: Target },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <p className="mono-eyebrow mb-2 text-primary">
          {ui("Measured workspace")}
        </p>
        <h1 className="text-3xl font-semibold">{ui("Analytics")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {ui("Understand your output and choose a useful next step.")}
        </p>
      </div>
      <AnalyticsNavigation active="coach" />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{ui("Weekly coach")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {ui(
              "Practical next steps from your saved work. Updated when you refresh; no AI generation or credit use."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshReview()}
          disabled={refreshing || saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshing ? "motion-safe:animate-spin" : ""}`}
            aria-hidden
          />
          {refreshing
            ? ui("Refreshing")
            : saving
              ? ui("Waiting for save")
              : ui("Refresh review")}
        </button>
      </div>
      {refreshError ? (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {refreshError}
        </p>
      ) : null}
      <div className="mb-6 grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-surface lg:grid-cols-4">
        {facts.map(fact => (
          <div
            key={fact.label}
            className="border-b border-border p-4 [&:nth-child(odd)]:border-r [&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0 lg:[&:not(:last-child)]:border-r"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{ui(fact.label)}</p>
              <fact.icon
                className="h-3.5 w-3.5 shrink-0 text-primary"
                aria-hidden
              />
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums">
              {fact.value.toLocaleString(locale)}
            </p>
          </div>
        ))}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <section
          className="rounded-xl border border-border bg-surface"
          aria-labelledby="coach-actions-title"
        >
          <div className="border-b border-border px-5 py-4">
            <h3 id="coach-actions-title" className="font-medium">
              {ui("Next best actions")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {ui(
                "Start with the first useful step. Each suggestion links to the work behind it."
              )}
            </p>
          </div>
          <div className="divide-y divide-border">
            {report.actions.map((action, index) => (
              <article key={action.key} className="flex gap-4 px-5 py-5">
                <span
                  className="pt-0.5 font-mono text-xs tabular-nums text-muted-foreground"
                  aria-hidden
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold">{ui(action.title)}</h4>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {ui(action.evidence, action.values)}
                  </p>
                  <Link
                    to={action.to}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    {ui(action.cta)}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
        <aside className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-medium">{ui("Behind this review")}</h3>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {ui(
              "The last 7 calendar days in UTC, using saved project updates and dated publication records. Connection status and unfinished work reflect the current workspace."
            )}
          </p>
          <dl className="mt-4 space-y-3 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">
                {ui("New publication records")}
              </dt>
              <dd className="font-medium tabular-nums">
                {report.postsCreated}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">
                {ui("Connected accounts")}
              </dt>
              <dd className="font-medium tabular-nums">
                {report.connectedAccounts}
              </dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
            {ui("Review date")}:{" "}
            {reviewedAt.toLocaleDateString(locale, {
              day: "numeric",
              month: "short",
              timeZone: "UTC",
            })}{" "}
            · {ui("UTC")}
          </p>
          <Link
            to="/dashboard/analytics"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            {ui("Explore analytics")}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </aside>
      </div>
    </div>
  );
}
