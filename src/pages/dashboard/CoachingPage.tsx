import { Mail, TrendingUp, Target, Lightbulb, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { trpc } from "@/providers/trpc";

export default function CoachingPage() {
  const utils = trpc.useUtils();
  const latestQuery = trpc.coaching.latest.useQuery(undefined, { retry: false });
  const generateMutation = trpc.coaching.generate.useMutation({
    onSuccess: () => utils.coaching.latest.invalidate(),
  });

  const insight = latestQuery.data;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <p className="mono-eyebrow text-primary mb-2">Weekly Coach</p>
        <h1 className="text-3xl font-semibold">Your Weekly Report</h1>
        <p className="text-foreground/60 mt-2">AI analyzes your week and gives personalized advice.</p>
      </div>

      {/* Generate Button */}
      <button
        onClick={() => generateMutation.mutate()}
        disabled={generateMutation.isPending}
        className="mb-8 w-full py-4 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
      >
        {generateMutation.isPending ? (
          <><Loader2 className="h-5 w-5 animate-spin" /> Analyzing your week...</>
        ) : (
          <><Mail className="h-5 w-5" /> Generate This Week's Report</>
        )}
      </button>

      {insight && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Weekly Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-semibold">{insight.postsCreated || 0}</p>
              <p className="text-xs text-foreground/50">Posts Created</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-semibold">{insight.postsPublished || 0}</p>
              <p className="text-xs text-foreground/50">Published</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-semibold">{(insight.totalViews || 0).toLocaleString()}</p>
              <p className="text-xs text-foreground/50">Total Views</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-semibold text-primary">{insight.growthRate || "N/A"}</p>
              <p className="text-xs text-foreground/50">Engagement</p>
            </div>
          </div>

          {/* Insights */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              Key Insights
            </h3>
            <div className="space-y-3">
              {(insight.insights as any[])?.map((item: string, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background">
                  <TrendingUp className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm">{item}</p>
                </div>
              )) || <p className="text-sm text-foreground/40">No insights yet. Generate a report.</p>}
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-emerald-500" />
              Recommendations
            </h3>
            <div className="space-y-3">
              {(insight.recommendations as any[])?.map((item: string, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <span className="text-xs font-semibold text-emerald-500 shrink-0 mt-0.5">{i + 1}.</span>
                  <p className="text-sm">{item}</p>
                </div>
              )) || <p className="text-sm text-foreground/40">No recommendations yet.</p>}
            </div>
          </div>

          {/* Next Week Goals */}
          <div className="bg-surface border border-primary/20 rounded-xl p-6">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Goals for Next Week
            </h3>
            <div className="space-y-2">
              {(insight.nextWeekGoals as any[])?.map((item: string, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-primary/5">
                  <span className="h-5 w-5 rounded-full border-2 border-primary flex items-center justify-center text-[10px] text-primary font-bold shrink-0">{i + 1}</span>
                  <p className="text-sm">{item}</p>
                </div>
              )) || <p className="text-sm text-foreground/40">No goals set yet.</p>}
            </div>
          </div>
        </motion.div>
      )}

      {!insight && !generateMutation.isPending && (
        <div className="text-center py-20 text-foreground/40">
          <Mail className="h-12 w-12 mx-auto mb-3" />
          <p className="text-lg font-medium">No report yet</p>
          <p className="text-sm mt-1">Click "Generate This Week's Report" to get your first coaching session.</p>
        </div>
      )}
    </div>
  );
}
