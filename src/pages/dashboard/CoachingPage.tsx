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
  ShieldCheck,
  Target,
} from "lucide-react";
import { motion } from "framer-motion";
import type { WorkspaceDocument } from "@contracts/workspace";
import { useWorkspace } from "@/providers/workspace";

const DAY = 24 * 60 * 60 * 1000;

function isWithin(timestamp: string | undefined, start: number) {
  if (!timestamp) return false;
  const value = new Date(timestamp).getTime();
  return Number.isFinite(value) && value >= start;
}

function buildReport(workspace: WorkspaceDocument) {
  const now = Date.now();
  const weekStart = now - 7 * DAY;
  const projectsTouched = workspace.projects.filter((project) =>
    isWithin(project.updatedAt, weekStart),
  );
  const postsCreated = workspace.posts.filter((post) =>
    isWithin(post.createdAt, weekStart),
  );
  const postsPublished = workspace.posts.filter(
    (post) =>
      post.status === "published" &&
      (isWithin(post.publishedAt, weekStart) ||
        (!post.publishedAt && isWithin(post.createdAt, weekStart))),
  );
  const draftPosts = workspace.posts.filter((post) => post.status === "draft");
  const scheduledPosts = workspace.posts.filter(
    (post) =>
      post.status === "scheduled" &&
      Boolean(post.scheduledAt) &&
      new Date(post.scheduledAt!).getTime() > now,
  );
  const activeGoals = workspace.goals.filter((goal) => goal.current < goal.target);
  const events = workspace.activity.filter((event) =>
    isWithin(event.createdAt, weekStart),
  );
  const editingProjects = workspace.projects.filter(
    (project) =>
      project.status === "draft" ||
      project.status === "editing" ||
      project.status === "review",
  );
  const connectedAccounts = workspace.accounts.filter(
    (account) => account.status === "connected",
  );

  const evidence = [
    `${projectsTouched.length} project${projectsTouched.length === 1 ? "" : "s"} changed in the last 7 days.`,
    `${postsCreated.length} publication record${postsCreated.length === 1 ? "" : "s"} created; ${postsPublished.length} confirmed published.`,
    `${events.length} workspace action${events.length === 1 ? "" : "s"} recorded in the activity log.`,
    `${connectedAccounts.length} publishing destination${connectedAccounts.length === 1 ? "" : "s"} currently connected.`,
  ];

  const recommendations: string[] = [];
  if (workspace.projects.length === 0) {
    recommendations.push(
      "Start one editing project and define the intended platform before generating variants.",
    );
  } else if (editingProjects.length > 0) {
    recommendations.push(
      `Move one of the ${editingProjects.length} open edit${editingProjects.length === 1 ? "" : "s"} to review or export before starting another.`,
    );
  }
  if (draftPosts.length > 0) {
    recommendations.push(
      `Resolve the ${draftPosts.length} saved publication draft${draftPosts.length === 1 ? "" : "s"}: schedule, publish, or delete each one.`,
    );
  }
  if (connectedAccounts.length === 0) {
    recommendations.push(
      "Connect a verified destination in Social Hub before building a publishing cadence.",
    );
  } else if (postsPublished.length === 0 && scheduledPosts.length === 0) {
    recommendations.push(
      "Choose one finished asset and schedule a real publication; there is no confirmed shipment this week.",
    );
  }
  if (activeGoals.length === 0) {
    recommendations.push(
      "Create one measurable goal so next week’s review can compare progress against a declared target.",
    );
  } else {
    const nearest = [...activeGoals].sort(
      (left, right) =>
        left.target - left.current - (right.target - right.current),
    )[0];
    recommendations.push(
      `Prioritize “${nearest.label}”; it is at ${Math.round((nearest.current / nearest.target) * 100)}% of target.`,
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "The workflow is moving. Keep the next cycle narrow: one edit, one review, one measured publication.",
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
  const { workspace } = useWorkspace();
  const [refreshedAt, setRefreshedAt] = useState(() => new Date());
  const report = useMemo(() => buildReport(workspace), [workspace]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mono-eyebrow mb-2 text-primary">Evidence coach</p>
          <h1 className="text-3xl font-semibold">Weekly Review</h1>
          <p className="mt-2 max-w-2xl text-foreground/60">
            A practical review built only from your saved projects, publishing
            records, goals and activity.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshedAt(new Date())}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:border-primary/40"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh review
        </button>
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-medium">Workspace evidence, not synthetic analytics</p>
          <p className="mt-1 text-xs leading-relaxed text-foreground/55">
            REELassati does not yet have verified reach, watch-time or retention
            data in this workspace, so this report will not fabricate views,
            engagement, growth or “best times.” Updated{" "}
            {refreshedAt.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            .
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <FolderKanban className="mb-3 h-4 w-4 text-primary" />
            <p className="text-2xl font-semibold">{report.projectsTouched}</p>
            <p className="text-xs text-foreground/50">Projects touched · 7d</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <Activity className="mb-3 h-4 w-4 text-blue-500" />
            <p className="text-2xl font-semibold">{report.postsCreated}</p>
            <p className="text-xs text-foreground/50">Publication records · 7d</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <CheckCircle2 className="mb-3 h-4 w-4 text-emerald-500" />
            <p className="text-2xl font-semibold">{report.postsPublished}</p>
            <p className="text-xs text-foreground/50">Confirmed published · 7d</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <Target className="mb-3 h-4 w-4 text-orange-500" />
            <p className="text-2xl font-semibold">{report.activeGoals}</p>
            <p className="text-xs text-foreground/50">Active goals</p>
          </div>
        </div>

        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-4 flex items-center gap-2 font-medium">
            <BarChart3 className="h-4 w-4 text-primary" />
            What the workspace proves
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {report.evidence.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-lg bg-background p-3"
              >
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-sm leading-relaxed text-foreground/70">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-emerald-500/20 bg-surface p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-medium">
              <ArrowRight className="h-4 w-4 text-emerald-500" />
              Next best actions
            </h2>
            {report.scheduledPosts > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                <Clock3 className="h-3 w-3" />
                {report.scheduledPosts} scheduled
              </span>
            )}
          </div>
          <div className="space-y-3">
            {report.recommendations.map((item, index) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-lg border border-emerald-500/10 bg-emerald-500/5 p-3"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 text-[10px] font-semibold text-emerald-600">
                  {index + 1}
                </span>
                <p className="text-sm leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </section>
      </motion.div>
    </div>
  );
}
