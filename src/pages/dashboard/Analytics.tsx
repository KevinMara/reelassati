import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, BarChart3, Download, RefreshCw, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/app/StatCard";
import { RangeToggle } from "@/components/analytics/RangeToggle";
import { Sparkline } from "@/components/analytics/Sparkline";
import { PlatformChart } from "@/components/analytics/PlatformChart";
import { PostsTable } from "@/components/analytics/PostsTable";
import { InsightCard } from "@/components/analytics/InsightCard";
import { KPIS, INSIGHTS, Range } from "@/components/analytics/mockData";
import { cn } from "@/lib/utils";
import { useAgentJob } from "@/hooks/useAgentJob";

export default function AnalyticsPage() {
  return <AppShell renderWith={() => <AnalyticsContent />} />;
}

function AnalyticsContent() {
  const [range, setRange] = useState<Range>("30d");
  const baseKpis = KPIS[range];
  const { job, start, submitting } = useAgentJob("analytics");

  useEffect(() => {
    start({ jobType: "snapshot", payload: { range } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const live = job?.status === "completed" ? (job.result as any) : null;
  const kpis = live
    ? baseKpis.map((k, i) => {
        if (i === 0 && typeof live.total_views === "number") {
          return { ...k, value: live.total_views.toLocaleString() };
        }
        if (i === 1 && typeof live.avg_engagement === "number") {
          return { ...k, value: `${(live.avg_engagement * 100).toFixed(1)}%` };
        }
        return k;
      })
    : baseKpis;

  return (
    <section className="p-6 lg:p-10 max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider text-foreground/45 font-medium mb-2">
            <BarChart3 className="h-3.5 w-3.5" /> Analytics agent
          </div>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ textWrap: "balance" } as React.CSSProperties}>
            What worked. What didn't. Why.
          </h1>
          <p className="text-sm text-foreground/55 mt-1.5 max-w-xl">
            Performance from every platform, folded back into the next week's strategy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RangeToggle value={range} onChange={setRange} />
          <Button
            variant="outline"
            size="sm"
            disabled={submitting || job?.status === "running"}
            onClick={() => start({ jobType: "snapshot", payload: { range } }).catch(() => {})}
          >
            {submitting || job?.status === "running" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const positive = k.delta >= 0;
          // For watch time, negative delta is bad; for everything else positive is good
          const TrendIcon = positive ? TrendingUp : TrendingDown;
          return (
            <StatCard
              key={k.label}
              label={k.label}
              value={k.value}
              hint={
                <span
                  className={cn(
                    "inline-flex items-center gap-1 tabular-nums font-medium",
                    positive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
                  )}
                >
                  <TrendIcon className="h-3 w-3" />
                  {positive ? "+" : ""}
                  {k.delta}% vs prev
                </span>
              }
            >
              <Sparkline
                values={k.spark}
                color={positive ? "hsl(160 70% 45%)" : "hsl(40 90% 55%)"}
              />
            </StatCard>
          );
        })}
      </div>

      {/* Chart + Insights side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <PlatformChart range={range} />
        </div>
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-foreground/45 font-medium px-1">
            Insights this week
          </div>
          {INSIGHTS.map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </div>
      </div>

      {/* Posts table */}
      <PostsTable />
    </section>
  );
}
