import { useState } from "react";
import { Flame, TrendingUp, ExternalLink, Sparkles, Filter } from "lucide-react";
import { motion } from "framer-motion";

const TRENDS = [
  { id: 1, title: "3 Mistakes Killing Your Gains", platform: "tiktok", creator: "@fitnessexpert", niche: "fitness", format: "hook_demo", views: "2.4M", hook: "Stop making these 3 mistakes...", score: 94 },
  { id: 2, title: "POV: You found the perfect outfit", platform: "instagram", creator: "@fashiondaily", niche: "fashion", format: "reel", views: "1.2M", hook: "POV: You just found...", score: 91 },
  { id: 3, title: "3 ingredients, 5 minutes, infinite flavor", platform: "tiktok", creator: "@foodieking", niche: "food", format: "slideshow", views: "3.2M", hook: "3 ingredients...", score: 93 },
  { id: 4, title: "I tested 100 phones so you don't have to", platform: "youtube", creator: "@techreview", niche: "tech", format: "hook_demo", views: "1.5M", hook: "I tested 100...", score: 92 },
  { id: 5, title: "5 habits that 99% of millionaires have", platform: "tiktok", creator: "@motivationdaily", niche: "self_improvement", format: "wall_of_text", views: "4.5M", hook: "5 habits...", score: 95 },
  { id: 6, title: "This hidden gem costs $10 a night", platform: "instagram", creator: "@travelbug", niche: "travel", format: "green_screen", views: "800K", hook: "This hidden gem...", score: 89 },
];

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "bg-black text-white",
  instagram: "bg-gradient-to-br from-purple-500 to-pink-500 text-white",
  youtube: "bg-red-600 text-white",
};

export default function TrendsPage() {
  const [filter, setFilter] = useState("all");
  const [niche, setNiche] = useState("all");

  const filtered = TRENDS.filter((t) => {
    if (filter !== "all" && t.platform !== filter) return false;
    if (niche !== "all" && t.niche !== niche) return false;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="mono-eyebrow text-primary mb-2">Viral Intelligence</p>
        <h1 className="text-3xl font-semibold">Trending Now</h1>
        <p className="text-foreground/60 mt-2">Discover what's going viral and remix it for your brand</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1">
          {["all", "tiktok", "instagram", "youtube"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${filter === f ? "bg-primary text-white" : "bg-surface border border-border"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {["all", "fitness", "fashion", "food", "tech", "travel"].map((n) => (
            <button
              key={n}
              onClick={() => setNiche(n)}
              className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${niche === n ? "bg-primary/10 text-primary border border-primary/20" : "bg-surface border border-border text-foreground/50"}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map((trend) => (
          <motion.div
            key={trend.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface border border-border rounded-xl p-5 hover:shadow-card-hover transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-background flex items-center justify-center text-2xl shrink-0">
                <Flame className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PLATFORM_COLORS[trend.platform]}`}>
                    {trend.platform}
                  </span>
                  <span className="text-xs text-foreground/50">by {trend.creator}</span>
                  <span className="text-xs text-foreground/30">•</span>
                  <span className="text-xs text-foreground/50 capitalize">{trend.niche}</span>
                </div>
                <h3 className="font-medium">{trend.title}</h3>
                <p className="text-sm text-foreground/60 mt-1">Hook: "{trend.hook}"</p>
                <div className="flex items-center gap-4 mt-3">
                  <span className="text-sm font-medium">{trend.views} views</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    Score: {trend.score}
                  </span>
                  <button className="text-xs text-primary hover:underline flex items-center gap-1 ml-auto">
                    <Sparkles className="h-3 w-3" /> Remix this
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
