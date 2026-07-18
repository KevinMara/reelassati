import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Play, ExternalLink, Heart, Eye, Filter } from "lucide-react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const CATEGORIES = ["All", "UGC", "Slideshow", "Hook & Demo", "Green Screen", "Educational", "Product"];

const SHOWCASE_ITEMS = [
  {
    id: 1,
    title: "Summer Collection Launch",
    category: "Product",
    platform: "TikTok",
    thumbnail: "🎬",
    stats: { views: "1.2M", likes: "89K", shares: "12K" },
    description: "AI-generated product showcase with trending audio and auto-captions",
    aiFeatures: ["Script Gen", "Auto-Edit", "Caption Sync"],
  },
  {
    id: 2,
    title: "5 Habits of Millionaires",
    category: "Educational",
    platform: "Instagram",
    thumbnail: "📚",
    stats: { views: "3.4M", likes: "245K", shares: "67K" },
    description: "Wall-of-text format with AI voiceover and dynamic text animations",
    aiFeatures: ["Script Gen", "Voice Synth", "Text Animations"],
  },
  {
    id: 3,
    title: "Gym Motivation 2024",
    category: "UGC",
    platform: "TikTok",
    thumbnail: "💪",
    stats: { views: "892K", likes: "78K", shares: "23K" },
    description: "AI avatar testimonial with realistic expressions and gestures",
    aiFeatures: ["AI Avatar", "Script Gen", "Background Music"],
  },
  {
    id: 4,
    title: "React to This Viral Trend",
    category: "Green Screen",
    platform: "YouTube",
    thumbnail: "🎭",
    stats: { views: "567K", likes: "45K", shares: "8K" },
    description: "Green screen reaction format with AI-suggested commentary",
    aiFeatures: ["Trend Analysis", "Script Gen", "Green Screen"],
  },
  {
    id: 5,
    title: "Day in the Life — Chef",
    category: "Slideshow",
    platform: "Instagram",
    thumbnail: "🍳",
    stats: { views: "445K", likes: "34K", shares: "5K" },
    description: "Slideshow story with AI-selected music and auto-timed transitions",
    aiFeatures: ["Auto-Edit", "Music Match", "Transitions"],
  },
  {
    id: 6,
    title: "Stop Making This Mistake",
    category: "Hook & Demo",
    platform: "TikTok",
    thumbnail: "⚡",
    stats: { views: "2.1M", likes: "178K", shares: "45K" },
    description: "High-impact hook with product demonstration and CTA optimization",
    aiFeatures: ["Hook Library", "Script Gen", "CTA Optimize"],
  },
];

export default function Showcase() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedItem, setSelectedItem] = useState<typeof SHOWCASE_ITEMS[0] | null>(null);

  const filtered = activeCategory === "All"
    ? SHOWCASE_ITEMS
    : SHOWCASE_ITEMS.filter((item) => item.category === activeCategory);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-20 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-10">
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-foreground/50 hover:text-foreground mb-4">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to home
            </Link>
            <p className="mono-eyebrow text-primary mb-2">AI Content Gallery</p>
            <h1 className="text-4xl md:text-5xl font-semibold">Showcase</h1>
            <p className="text-foreground/60 mt-3 max-w-xl">
              See what's possible with REELassati's AI. Every piece here was created or enhanced using our platform.
            </p>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mb-8">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-primary text-white"
                    : "bg-surface border border-border text-foreground/60 hover:border-primary/50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => setSelectedItem(item)}
                className="bg-surface border border-border rounded-xl overflow-hidden cursor-pointer hover:shadow-card-hover transition-all group"
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-background flex items-center justify-center text-6xl relative">
                  {item.thumbnail}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Play className="h-10 w-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="absolute top-3 left-3">
                    <span className="text-[10px] px-2 py-1 rounded-full bg-black/60 text-white font-medium">
                      {item.platform}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <span className="text-[10px] uppercase tracking-wider text-primary font-medium">{item.category}</span>
                  <h3 className="font-semibold mt-1">{item.title}</h3>
                  <p className="text-sm text-foreground/50 mt-1 line-clamp-2">{item.description}</p>

                  {/* AI Features */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {item.aiFeatures.map((feature) => (
                      <span key={feature} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {feature}
                      </span>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border text-xs text-foreground/40">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {item.stats.views}</span>
                    <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {item.stats.likes}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedItem(null)}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-background border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="aspect-video bg-background flex items-center justify-center text-8xl">
              {selectedItem.thumbnail}
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{selectedItem.platform}</span>
                <span className="text-xs text-foreground/50">{selectedItem.category}</span>
              </div>
              <h2 className="text-2xl font-semibold">{selectedItem.title}</h2>
              <p className="text-foreground/60 mt-2">{selectedItem.description}</p>

              <div className="grid grid-cols-3 gap-4 mt-6 p-4 rounded-xl bg-surface">
                <div className="text-center">
                  <p className="text-xl font-semibold">{selectedItem.stats.views}</p>
                  <p className="text-xs text-foreground/50">Views</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-semibold">{selectedItem.stats.likes}</p>
                  <p className="text-xs text-foreground/50">Likes</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-semibold">{selectedItem.stats.shares}</p>
                  <p className="text-xs text-foreground/50">Shares</p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-sm font-medium mb-2">AI Features Used</p>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.aiFeatures.map((f) => (
                    <span key={f} className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-medium">{f}</span>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Link to="/dashboard/script" className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium text-center hover:bg-primary-hover transition-colors">
                  Create Similar
                </Link>
                <button onClick={() => setSelectedItem(null)} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-surface transition-colors">
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <Footer />
    </div>
  );
}
