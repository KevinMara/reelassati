import { useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { RangeToggle } from "@/components/analytics/RangeToggle";
import { InsightCard } from "@/components/analytics/InsightCard";
import { PlatformChart } from "@/components/analytics/PlatformChart";
import { PostsTable } from "@/components/analytics/PostsTable";
import { INSIGHTS, PLATFORM_STATS, POSTS } from "@/components/analytics/mockData";
import { useTranslation } from "react-i18next";
import { BarChart3, TrendingUp, TrendingDown, Target } from "lucide-react";

export default function Analytics() {
  const { t } = useTranslation();
  const [range, setRange] = useState("7d");

  return (
    <AppShell>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="mono-eyebrow text-primary mb-2">{t("app.nav.analytics")}</p>
            <h1 className="text-3xl font-semibold tracking-tight">Performance Analytics</h1>
            <p className="text-foreground/60 mt-2">Real performance feeds back into the system. Every week, it's sharper.</p>
          </div>
          <RangeToggle value={range} onChange={setRange} />
        </header>

        {/* Insights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {INSIGHTS.map((insight, i) => {
            const Icon = i === 0 ? TrendingUp : i === 1 ? Target : TrendingDown;
            return (
              <InsightCard 
                key={i}
                insight={insight}
                icon={Icon}
              />
            )
          })}
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-8">
          {/* Main Chart Section */}
          <div className="space-y-6">
            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/50 mb-6 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Views by Platform
              </h3>
              <div className="h-[300px]">
                {/* PlatformChart probably expects some props, let's assume it's like this for now */}
                <PlatformChart data={PLATFORM_STATS} />
              </div>
            </div>

            {/* Posts Table */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/50">Recent Content Performance</h3>
              </div>
              <PostsTable posts={POSTS} />
            </div>
          </div>

          <aside className="space-y-8">
            {/* Sidebar analytics components if any */}
            <div className="bg-primary/[0.03] border border-primary/20 rounded-2xl p-6">
              <h3 className="font-semibold text-lg mb-4">Neural Learning</h3>
              <p className="text-sm text-foreground/70 leading-relaxed">
                The analyzer cohort has been updated with 12 new data points from your recent TikTok performance. 
                <span className="block mt-2 font-medium text-primary">Retention prediction is now 4% more accurate for your brand.</span>
              </p>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
