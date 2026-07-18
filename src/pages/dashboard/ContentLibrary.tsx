import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Filter, Grid3X3, List, Plus, FolderOpen, FileText, Video, Image, Music, Wand2 } from "lucide-react";
import { motion } from "framer-motion";

const DEMO_ASSETS = [
  { id: 1, title: "Summer Collection Promo", type: "video", format: "reel", client: "Fashion Brand Co.", status: "published", views: "12.4K", date: "2024-07-01", thumbnail: "🎬" },
  { id: 2, title: "Protein Powder Script v2", type: "script", format: "hook_demo", client: "FitLife Supplements", status: "approved", views: "—", date: "2024-07-02", thumbnail: "📝" },
  { id: 3, title: "Day in the Life — Chef", type: "video", format: "short", client: "Gourmet Kitchen", status: "draft", views: "—", date: "2024-07-03", thumbnail: "🍳" },
  { id: 4, title: "5 Tips for Better Sleep", type: "script", format: "wall_of_text", client: "Wellness Hub", status: "review", views: "—", date: "2024-07-04", thumbnail: "💤" },
  { id: 5, title: "Product Unboxing", type: "template", format: "ugc", client: "TechZone", status: "draft", views: "—", date: "2024-07-05", thumbnail: "📦" },
  { id: 6, title: "Gym Motivation Edit", type: "video", format: "slideshow", client: "Iron Gym", status: "published", views: "45.2K", date: "2024-07-01", thumbnail: "💪" },
  { id: 7, title: "Behind the Scenes", type: "image", format: "story", client: "StudioX", status: "approved", views: "—", date: "2024-07-06", thumbnail: "📸" },
  { id: 8, title: "Holiday Sale Announcement", type: "script", format: "meme", client: "ShopNow", status: "draft", views: "—", date: "2024-07-07", thumbnail: "🛍️" },
];

const TYPE_ICONS: Record<string, any> = { video: Video, script: FileText, image: Image, audio: Music, template: Wand2 };
const TYPE_COLORS: Record<string, string> = { video: "bg-blue-500/10 text-blue-500", script: "bg-amber-500/10 text-amber-500", image: "bg-emerald-500/10 text-emerald-500", audio: "bg-purple-500/10 text-purple-500", template: "bg-pink-500/10 text-pink-500" };
const STATUS_COLORS: Record<string, string> = { published: "text-emerald-500 bg-emerald-500/10", approved: "text-blue-500 bg-blue-500/10", review: "text-amber-500 bg-amber-500/10", draft: "text-foreground/40 bg-foreground/5" };

export default function ContentLibrary() {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = DEMO_ASSETS.filter((a) => {
    if (filter !== "all" && a.type !== filter) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="mono-eyebrow text-primary mb-2">Asset Library</p>
          <h1 className="text-3xl font-semibold">Content Library</h1>
        </div>
        <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Asset
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex gap-1">
          {["all", "video", "script", "image", "template"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${
                filter === f ? "bg-primary text-white" : "bg-surface border border-border hover:border-primary/50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          <button onClick={() => setViewMode("grid")} className={`p-2 rounded-lg ${viewMode === "grid" ? "bg-primary text-white" : "bg-surface border border-border"}`}>
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button onClick={() => setViewMode("list")} className={`p-2 rounded-lg ${viewMode === "list" ? "bg-primary text-white" : "bg-surface border border-border"}`}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === "grid" ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filtered.map((asset) => {
            const Icon = TYPE_ICONS[asset.type] || FolderOpen;
            return (
              <motion.div
                key={asset.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-surface border border-border rounded-xl overflow-hidden hover:shadow-card-hover transition-all group cursor-pointer"
              >
                <div className="aspect-video bg-background flex items-center justify-center text-4xl relative">
                  {asset.thumbnail}
                  <div className="absolute top-2 right-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[asset.status]}`}>
                      {asset.status}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`h-6 w-6 rounded flex items-center justify-center ${TYPE_COLORS[asset.type]}`}>
                      <Icon className="h-3 w-3" />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-foreground/40">{asset.format}</span>
                  </div>
                  <h3 className="font-medium text-sm truncate">{asset.title}</h3>
                  <p className="text-xs text-foreground/50 mt-1">{asset.client}</p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <span className="text-xs text-foreground/40">{asset.date}</span>
                    {asset.views !== "—" && <span className="text-xs font-medium">{asset.views} views</span>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {filtered.map((asset) => {
            const Icon = TYPE_ICONS[asset.type] || FolderOpen;
            return (
              <div key={asset.id} className="flex items-center gap-4 p-4 border-b border-border last:border-0 hover:bg-background/50 transition-colors cursor-pointer">
                <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center text-xl">{asset.thumbnail}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{asset.title}</h3>
                  <p className="text-xs text-foreground/50">{asset.client} • {asset.format}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[asset.status]}`}>
                  {asset.status}
                </span>
                <span className="text-xs text-foreground/40 w-20 text-right">{asset.date}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
