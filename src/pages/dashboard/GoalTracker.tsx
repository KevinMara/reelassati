import { useState } from "react";
import { Target, Plus, TrendingUp, CheckCircle, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { trpc } from "@/providers/trpc";

const GOAL_COLORS: Record<string, string> = {
  followers: "bg-emerald-500",
  posts: "bg-blue-500",
  engagement: "bg-purple-500",
  views: "bg-orange-500",
  revenue: "bg-amber-500",
};

const GOAL_LABELS: Record<string, string> = {
  followers: "Followers",
  posts: "Posts",
  engagement: "Engagement Rate",
  views: "Views",
  revenue: "Revenue",
};

export default function GoalTracker() {
  const [showAdd, setShowAdd] = useState(false);
  const [type, setType] = useState<"followers" | "posts" | "engagement" | "views" | "revenue">("followers");
  const [target, setTarget] = useState("");
  const [platform, setPlatform] = useState("");

  const utils = trpc.useUtils();
  const goalsQuery = trpc.goals.list.useQuery(undefined, { retry: false });
  const goals = goalsQuery.data || [];

  const createMutation = trpc.goals.create.useMutation({
    onSuccess: () => { utils.goals.list.invalidate(); setShowAdd(false); setTarget(""); },
  });

  const updateMutation = trpc.goals.updateProgress.useMutation({
    onSuccess: () => utils.goals.list.invalidate(),
  });

  const deleteMutation = trpc.goals.delete.useMutation({
    onSuccess: () => utils.goals.list.invalidate(),
  });

  const activeGoals = goals.filter((g: any) => g.status === "active");
  const achievedGoals = goals.filter((g: any) => g.status === "achieved");

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="mono-eyebrow text-primary mb-2">Goal Tracker</p>
          <h1 className="text-3xl font-semibold">Your Goals</h1>
          <p className="text-foreground/60 mt-2">Set targets, track progress, celebrate wins.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Goal
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-xl p-5 text-center">
          <p className="text-3xl font-semibold">{activeGoals.length}</p>
          <p className="text-sm text-foreground/50">Active Goals</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5 text-center">
          <p className="text-3xl font-semibold text-emerald-500">{achievedGoals.length}</p>
          <p className="text-sm text-foreground/50">Achieved</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5 text-center">
          <p className="text-3xl font-semibold text-primary">
            {goals.length > 0 ? Math.round((achievedGoals.length / goals.length) * 100) : 0}%
          </p>
          <p className="text-sm text-foreground/50">Success Rate</p>
        </div>
      </div>

      {/* Add Goal Form */}
      {showAdd && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-surface border border-border rounded-xl p-5 mb-6 space-y-4">
          <h3 className="font-medium">Create New Goal</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm">
                {Object.entries(GOAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Target</label>
              <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="1000" className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Platform (optional)</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm">
                <option value="">All</option>
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
                <option value="linkedin">LinkedIn</option>
                <option value="x">X</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMutation.mutate({ type, targetValue: Number(target), platform: platform || undefined })} disabled={!target} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-40">
              Create Goal
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface">Cancel</button>
          </div>
        </motion.div>
      )}

      {/* Active Goals */}
      <div className="space-y-3">
        {activeGoals.map((goal: any) => {
          const pct = Math.min(100, Math.round(((goal.currentValue || 0) / goal.targetValue) * 100));
          return (
            <div key={goal.id} className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg ${GOAL_COLORS[goal.type] || "bg-primary"} flex items-center justify-center`}>
                    <Target className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{GOAL_LABELS[goal.type] || goal.type}{goal.platform ? ` (${goal.platform})` : ""}</p>
                    <p className="text-xs text-foreground/40">{(goal.currentValue || 0).toLocaleString()} / {goal.targetValue.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{pct}%</span>
                  <button onClick={() => deleteMutation.mutate({ id: goal.id })} className="p-1.5 rounded-lg hover:bg-red-500/10 text-foreground/30 hover:text-red-500 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                <div className={`h-full ${GOAL_COLORS[goal.type] || "bg-primary"} rounded-full transition-all`} style={{ width: `${pct}%` }} />
              </div>
              {/* Quick update */}
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="number"
                  placeholder="Update progress"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      updateMutation.mutate({ id: goal.id, currentValue: Number((e.target as HTMLInputElement).value) });
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                  className="w-32 px-2 py-1.5 rounded-lg bg-background border border-border text-xs"
                />
                <span className="text-xs text-foreground/30">Press Enter to update</span>
              </div>
            </div>
          );
        })}
        {activeGoals.length === 0 && (
          <div className="text-center py-12 text-foreground/40">
            <TrendingUp className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">No active goals. Create one to start tracking.</p>
          </div>
        )}
      </div>

      {/* Achieved */}
      {achievedGoals.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-foreground/50 mb-3 uppercase tracking-wider">Achieved</h3>
          <div className="space-y-2">
            {achievedGoals.map((goal: any) => (
              <div key={goal.id} className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="text-sm line-through text-foreground/50">{GOAL_LABELS[goal.type] || goal.type} — {goal.targetValue.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
