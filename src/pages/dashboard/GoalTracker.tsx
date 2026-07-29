import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";
import type { Goal, Platform } from "@contracts/workspace";
import { useWorkspace } from "@/providers/workspace";

const METRIC_META: Record<
  Goal["metric"],
  { label: string; color: string; unit: string }
> = {
  followers: {
    label: "Followers",
    color: "bg-emerald-500",
    unit: "followers",
  },
  posts: { label: "Published posts", color: "bg-blue-500", unit: "posts" },
  engagement: {
    label: "Engagement rate",
    color: "bg-purple-500",
    unit: "%",
  },
  views: { label: "Views", color: "bg-orange-500", unit: "views" },
};

const PLATFORM_OPTIONS: Array<{ value: Platform | ""; label: string }> = [
  { value: "", label: "All platforms" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "X / Twitter" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "pinterest", label: "Pinterest" },
  { value: "threads", label: "Threads" },
];

function createId(prefix: string) {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomPart}`;
}

function progressFor(goal: Goal) {
  if (goal.target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((goal.current / goal.target) * 100)));
}

export default function GoalTracker() {
  const { workspace, updateWorkspace, saving, error } = useWorkspace();
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [metric, setMetric] = useState<Goal["metric"]>("followers");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [platform, setPlatform] = useState<Platform | "">("");
  const [progressInputs, setProgressInputs] = useState<Record<string, string>>({});

  const activeGoals = useMemo(
    () => workspace.goals.filter((goal) => goal.current < goal.target),
    [workspace.goals],
  );
  const achievedGoals = useMemo(
    () => workspace.goals.filter((goal) => goal.current >= goal.target),
    [workspace.goals],
  );
  const averageProgress = useMemo(() => {
    if (workspace.goals.length === 0) return 0;
    return Math.round(
      workspace.goals.reduce((sum, goal) => sum + progressFor(goal), 0) /
        workspace.goals.length,
    );
  }, [workspace.goals]);

  const createGoal = async () => {
    const numericTarget = Number(target);
    if (!Number.isFinite(numericTarget) || numericTarget <= 0) return;
    const now = new Date().toISOString();
    const goal: Goal = {
      id: createId("goal"),
      label: label.trim() || METRIC_META[metric].label,
      metric,
      current: 0,
      target: numericTarget,
      deadline: deadline || undefined,
      platform: platform || undefined,
      createdAt: now,
    };
    await updateWorkspace((current) => ({
      ...current,
      goals: [goal, ...current.goals],
      activity: [
        {
          id: createId("event"),
          type: "goal" as const,
          label: "Goal created",
          detail: `${goal.label}: ${goal.target.toLocaleString()} ${METRIC_META[goal.metric].unit}`,
          createdAt: now,
        },
        ...current.activity,
      ].slice(0, 100),
    }));
    setLabel("");
    setMetric("followers");
    setTarget("");
    setDeadline("");
    setPlatform("");
    setShowAdd(false);
  };

  const updateProgress = async (goal: Goal) => {
    const value = Number(progressInputs[goal.id]);
    if (!Number.isFinite(value) || value < 0) return;
    await updateWorkspace((current) => ({
      ...current,
      goals: current.goals.map((item) =>
        item.id === goal.id ? { ...item, current: value } : item,
      ),
      activity: [
        {
          id: createId("event"),
          type: "goal" as const,
          label: value >= goal.target ? "Goal achieved" : "Goal progress updated",
          detail: `${goal.label}: ${value.toLocaleString()} of ${goal.target.toLocaleString()}`,
          createdAt: new Date().toISOString(),
        },
        ...current.activity,
      ].slice(0, 100),
    }));
    setProgressInputs((current) => ({ ...current, [goal.id]: "" }));
  };

  const deleteGoal = async (goal: Goal) => {
    if (!window.confirm(`Delete “${goal.label}”?`)) return;
    await updateWorkspace((current) => ({
      ...current,
      goals: current.goals.filter((item) => item.id !== goal.id),
    }));
  };

  const renderGoal = (goal: Goal, achieved: boolean) => {
    const progress = progressFor(goal);
    const meta = METRIC_META[goal.metric];
    return (
      <article
        key={goal.id}
        className={`rounded-xl border bg-surface p-5 ${
          achieved ? "border-emerald-500/20" : "border-border"
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.color}`}
            >
              {achieved ? (
                <CheckCircle2 className="h-4 w-4 text-white" />
              ) : (
                <Target className="h-4 w-4 text-white" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-medium">{goal.label}</h3>
              <p className="mt-0.5 text-xs text-foreground/45">
                {meta.label}
                {goal.platform ? ` · ${goal.platform}` : " · all platforms"}
              </p>
              {goal.deadline && (
                <p className="mt-1 flex items-center gap-1 text-xs text-foreground/40">
                  <CalendarDays className="h-3 w-3" />
                  {new Date(`${goal.deadline}T12:00:00`).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{progress}%</span>
            <button
              type="button"
              onClick={() => void deleteGoal(goal)}
              disabled={saving}
              className="rounded-lg p-1.5 text-foreground/25 transition-colors hover:bg-red-500/10 hover:text-red-500"
              aria-label={`Delete ${goal.label}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-background">
          <div
            className={`h-full rounded-full transition-[width] ${meta.color}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-foreground/45">
            {goal.current.toLocaleString()} {meta.unit}
          </span>
          <span className="text-foreground/45">
            Target {goal.target.toLocaleString()}
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            type="number"
            min="0"
            step={goal.metric === "engagement" ? "0.1" : "1"}
            value={progressInputs[goal.id] ?? ""}
            onChange={(event) =>
              setProgressInputs((current) => ({
                ...current,
                [goal.id]: event.target.value,
              }))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") void updateProgress(goal);
            }}
            placeholder={`Current ${meta.unit}`}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs"
          />
          <button
            type="button"
            onClick={() => void updateProgress(goal)}
            disabled={saving || !progressInputs[goal.id]}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:border-primary/40 disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Update
          </button>
        </div>
      </article>
    );
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mono-eyebrow mb-2 text-primary">Progress system</p>
          <h1 className="text-3xl font-semibold">Goal Tracker</h1>
          <p className="mt-2 text-foreground/60">
            Set measurable targets and update them from verified performance data.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((current) => !current)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          New goal
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-surface p-5 text-center">
          <p className="text-3xl font-semibold">{activeGoals.length}</p>
          <p className="text-sm text-foreground/50">Active</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 text-center">
          <p className="text-3xl font-semibold text-emerald-500">
            {achievedGoals.length}
          </p>
          <p className="text-sm text-foreground/50">Achieved</p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
          <p className="text-3xl font-semibold text-primary">
            {averageProgress}%
          </p>
          <p className="text-sm text-foreground/50">Average progress</p>
        </div>
      </div>

      {showAdd && (
        <motion.section
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-xl border border-primary/20 bg-surface p-5"
        >
          <h2 className="mb-4 font-medium">Create a measurable goal</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <label htmlFor="goal-label" className="mb-1.5 block text-xs font-medium">
                Goal name
              </label>
              <input
                id="goal-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Reach the first 10K"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="goal-metric" className="mb-1.5 block text-xs font-medium">
                Metric
              </label>
              <select
                id="goal-metric"
                value={metric}
                onChange={(event) =>
                  setMetric(event.target.value as Goal["metric"])
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {Object.entries(METRIC_META).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="goal-target" className="mb-1.5 block text-xs font-medium">
                Target
              </label>
              <input
                id="goal-target"
                type="number"
                min="0"
                step={metric === "engagement" ? "0.1" : "1"}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder="10000"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="goal-deadline" className="mb-1.5 block text-xs font-medium">
                Deadline
              </label>
              <input
                id="goal-deadline"
                type="date"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="lg:col-span-2">
              <label htmlFor="goal-platform" className="mb-1.5 block text-xs font-medium">
                Platform
              </label>
              <select
                id="goal-platform"
                value={platform}
                onChange={(event) =>
                  setPlatform(event.target.value as Platform | "")
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {PLATFORM_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void createGoal()}
              disabled={saving || !target || Number(target) <= 0}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create goal
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-background"
            >
              Cancel
            </button>
          </div>
        </motion.section>
      )}

      <section className="space-y-3">
        {activeGoals.map((goal) => renderGoal(goal, false))}
        {activeGoals.length === 0 && (
          <div className="rounded-xl border border-dashed border-border py-14 text-center text-foreground/40">
            <TrendingUp className="mx-auto mb-2 h-8 w-8" />
            <p className="text-sm">No active goals. Set the next measurable win.</p>
          </div>
        )}
      </section>

      {achievedGoals.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/45">
            Achieved
          </h2>
          <div className="space-y-3">
            {achievedGoals.map((goal) => renderGoal(goal, true))}
          </div>
        </section>
      )}
    </div>
  );
}
