import { useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Eye, Heart, MessageCircle, Share2, Users, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

const PLATFORMS = [
  { name: "TikTok", views: 125400, likes: 18200, comments: 840, shares: 1200, followers: 45200, growth: 12.5 },
  { name: "Instagram", views: 89300, likes: 12400, comments: 620, shares: 890, followers: 31200, growth: 8.3 },
  { name: "YouTube", views: 56700, likes: 8900, comments: 1200, shares: 340, followers: 18500, growth: -2.1 },
  { name: "X / Twitter", views: 23400, likes: 3400, comments: 420, shares: 1800, followers: 12300, growth: 5.7 },
];

const TOP_CONTENT = [
  { title: "Summer Collection Promo", platform: "TikTok", views: "12.4K", engagement: "8.2%", trend: "up" },
  { title: "5 Gym Mistakes", platform: "Instagram", views: "9.1K", engagement: "7.5%", trend: "up" },
  { title: "Protein Powder Review", platform: "YouTube", views: "6.8K", engagement: "5.1%", trend: "down" },
  { title: "Behind the Scenes", platform: "TikTok", views: "5.2K", engagement: "9.1%", trend: "up" },
  { title: "Product Unboxing", platform: "Instagram", views: "4.7K", engagement: "6.3%", trend: "up" },
];

const formatNumber = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("7d");

  const totalViews = PLATFORMS.reduce((a, p) => a + p.views, 0);
  const totalLikes = PLATFORMS.reduce((a, p) => a + p.likes, 0);
  const totalComments = PLATFORMS.reduce((a, p) => a + p.comments, 0);
  const totalFollowers = PLATFORMS.reduce((a, p) => a + p.followers, 0);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="mono-eyebrow text-primary mb-2">Performance Loop</p>
          <h1 className="text-3xl font-semibold">Analytics</h1>
        </div>
        <div className="flex gap-1">
          {["24h", "7d", "30d", "90d"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-2 rounded-lg text-xs font-medium ${period === p ? "bg-primary text-white" : "bg-surface border border-border"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Views", value: formatNumber(totalViews), icon: Eye, change: "+23.5%", positive: true },
          { label: "Engagement", value: formatNumber(totalLikes), icon: Heart, change: "+18.2%", positive: true },
          { label: "Comments", value: formatNumber(totalComments), icon: MessageCircle, change: "+31.0%", positive: true },
          { label: "Followers", value: formatNumber(totalFollowers), icon: Users, change: "+8.7%", positive: true },
        ].map((kpi) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface border border-border rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <kpi.icon className="h-4 w-4 text-foreground/40" />
              <span className={`text-xs font-medium flex items-center gap-0.5 ${kpi.positive ? "text-emerald-500" : "text-red-500"}`}>
                {kpi.change} {kpi.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              </span>
            </div>
            <p className="text-2xl font-semibold">{kpi.value}</p>
            <p className="text-xs text-foreground/50 mt-1">{kpi.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Platform Breakdown */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="font-medium mb-4">Platform Performance</h2>
          <div className="space-y-4">
            {PLATFORMS.map((p) => (
              <div key={p.name} className="flex items-center gap-4">
                <div className="w-24 shrink-0">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-foreground/50">{formatNumber(p.views)} views</p>
                </div>
                <div className="flex-1 h-8 bg-background rounded-lg overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(p.views / 125400) * 100}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-primary/20 rounded-lg"
                  />
                </div>
                <span className={`text-xs font-medium ${p.growth >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {p.growth >= 0 ? "+" : ""}{p.growth}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Content */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="font-medium mb-4">Top Performing Content</h2>
          <div className="space-y-3">
            {TOP_CONTENT.map((c, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-background">
                <span className="text-sm font-mono text-foreground/30 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.title}</p>
                  <p className="text-xs text-foreground/50">{c.platform} • {c.engagement} engagement</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{c.views}</p>
                  <ArrowUpRight className={`h-3 w-3 inline ${c.trend === "up" ? "text-emerald-500" : "text-red-500"}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
