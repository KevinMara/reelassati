import { useUiText } from "@/lib/i18n/ui";
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Lightbulb,
  RefreshCw,
  Target,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import type { WorkspaceDocument } from "@contracts/workspace";
import { useWorkspace } from "@/providers/workspace";

const DAY = 24 * 60 * 60 * 1000;

function isWithin(timestamp: string | undefined, start: number) {
  if (!timestamp) return false;
  const value = new Date(timestamp).getTime();
  return Number.isFinite(value) && value >= start;
}

function buildReport(
  workspace: WorkspaceDocument,
  ui: ReturnType<typeof useUiText>
) {
  const now = Date.now();
  const weekStart = now - 7 * DAY;
  const projectsTouched = workspace.projects.filter(project =>
    isWithin(project.updatedAt, weekStart)
  );
  const postsCreated = workspace.posts.filter(post =>
    isWithin(post.createdAt, weekStart)
  );
  const postsPublished = workspace.posts.filter(
    post =>
      post.status === "published" &&
      (isWithin(post.publishedAt, weekStart) ||
        (!post.publishedAt && isWithin(post.createdAt, weekStart)))
  );
  const draftPosts = workspace.posts.filter(post => post.status === "draft");
  const scheduledPosts = workspace.posts.filter(
    post =>
      post.status === "scheduled" &&
      Boolean(post.scheduledAt) &&
      new Date(post.scheduledAt!).getTime() > now
  );
  const activeGoals = workspace.goals.filter(
    goal => goal.current < goal.target
  );
  const events = workspace.activity.filter(event =>
    isWithin(event.createdAt, weekStart)
  );
  const editingProjects = workspace.projects.filter(
    project =>
      project.status === "draft" ||
      project.status === "editing" ||
      project.status === "review"
  );
  const connectedAccounts = workspace.accounts.filter(
    account => account.status === "connected"
  );

  const evidence = [
    ui("Projects updated in the last 7 days: {{count}}", {
      count: projectsTouched.length,
    }),
    ui(
      "Publication records: {{created}} · confirmed published: {{published}}",
      { created: postsCreated.length, published: postsPublished.length }
    ),
    ui("Workspace actions recorded: {{count}}", { count: events.length }),
    ui("Connected publishing destinations: {{count}}", {
      count: connectedAccounts.length,
    }),
  ];

  const recommendations: { text: string; to: string }[] = [];
  const recommend = (to: string, text: string) =>
    recommendations.push({ to, text });
  if (workspace.projects.length === 0) {
    recommend(
      "/dashboard/edit",
      ui(
        "Start one editing project and define the intended platform before generating variants."
      )
    );
  } else if (editingProjects.length > 0) {
    recommend(
      "/dashboard/edit",
      ui(
        "Review or export one of your open edits before starting another. Open edits: {{count}}",
        { count: editingProjects.length }
      )
    );
  }
  if (draftPosts.length > 0) {
    recommend(
      "/dashboard/publish",
      ui(
        "Schedule, publish, or delete your saved publication drafts. Drafts: {{count}}",
        { count: draftPosts.length }
      )
    );
  }
  if (connectedAccounts.length === 0) {
    recommend(
      "/dashboard/social",
      ui(
        "Connect a verified destination in Social Hub before building a publishing cadence."
      )
    );
  } else if (postsPublished.length === 0 && scheduledPosts.length === 0) {
    recommend(
      "/dashboard/publish",
      ui(
        "Choose one finished asset and schedule a publication; nothing has been published this week."
      )
    );
  }
  if (activeGoals.length === 0) {
    recommend(
      "/dashboard/goals",
      ui(
        "Create one measurable goal so next week’s review can compare progress against a declared target."
      )
    );
  } else {
    const nearest = [...activeGoals].sort(
      (left, right) =>
        left.target - left.current - (right.target - right.current)
    )[0];
    recommend(
      "/dashboard/goals",
      ui("Prioritize “{{goal}}”; it is at {{percent}}% of target.", {
        goal: nearest.label,
        percent: Math.round((nearest.current / nearest.target) * 100),
      })
    );
  }
  if (recommendations.length === 0) {
    recommend(
      "/dashboard/calendar",
      ui(
        "The workflow is moving. Keep the next cycle narrow: one edit, one review, one measured publication."
      )
    );
  }

  return {
    projectsTouched: projectsTouched.length,
    postsCreated: postsCreated.length,
    postsPublished: postsPublished.length,
    activeGoals: activeGoals.length,
    scheduledPosts: scheduledPosts.length,
    evidence,
    recommendations,
  };
}

export default function CoachingPage() {
  const ui = useUiText();
  const { workspace, refresh, saving } = useWorkspace();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const report = useMemo(() => buildReport(workspace, ui), [workspace, ui]);

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

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mono-eyebrow mb-2 text-primary">
            {ui("Weekly momentum")}
          </p>
          <h1 className="text-3xl font-semibold">{ui("Weekly Review")}</h1>
          <p className="mt-2 max-w-2xl text-foreground/60">
            {ui(
              "A practical review built only from your saved projects, publishing records, goals and activity."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshReview()}
          disabled={refreshing || saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
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

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <FolderKanban className="mb-3 h-4 w-4 text-primary" />
            <p className="text-2xl font-semibold">{report.projectsTouched}</p>
            <p className="text-xs text-foreground/70">
              {ui("Projects touched · 7d")}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <Activity className="mb-3 h-4 w-4 text-blue-500" />
            <p className="text-2xl font-semibold">{report.postsCreated}</p>
            <p className="text-xs text-foreground/70">
              {ui("Publication records · 7d")}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <CheckCircle2 className="mb-3 h-4 w-4 text-emerald-500" />
            <p className="text-2xl font-semibold">{report.postsPublished}</p>
            <p className="text-xs text-foreground/70">
              {ui("Confirmed published · 7d")}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <Target className="mb-3 h-4 w-4 text-orange-500" />
            <p className="text-2xl font-semibold">{report.activeGoals}</p>
            <p className="text-xs text-foreground/70">{ui("Active goals")}</p>
          </div>
        </div>

        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-4 flex items-center gap-2 font-medium">
            <BarChart3 className="h-4 w-4 text-primary" />
            {ui("Your week at a glance")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {report.evidence.map(item => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-lg bg-background p-3"
              >
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-sm leading-relaxed text-foreground/70">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-emerald-500/20 bg-surface p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-medium">
              <ArrowRight className="h-4 w-4 text-emerald-500" />
              {ui("Next best actions")}
            </h2>
            {report.scheduledPosts > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                <Clock3 className="h-3 w-3" />
                {report.scheduledPosts} {ui("scheduled")}
              </span>
            )}
          </div>
          <div className="space-y-3">
            {report.recommendations.map((item, index) => (
              <Link
                key={item.text}
                to={item.to}
                className="group flex items-start gap-3 rounded-lg border border-emerald-500/10 bg-emerald-500/5 p-3 transition motion-safe:hover:-translate-y-0.5 hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 text-xs font-semibold text-emerald-600">
                  {index + 1}
                </span>
                <p className="min-w-0 flex-1 text-sm leading-relaxed">
                  {item.text}
                </p>
                <ArrowRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 transition-transform motion-safe:group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            ))}
          </div>
        </section>
      </motion.div>
    </div>
  );
}
