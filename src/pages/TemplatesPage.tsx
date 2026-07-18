import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, Sparkles, Wand2, Image, Type, Film, Zap, Palette, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const CATEGORIES = ["All", "E-Commerce", "Fitness", "Food", "Tech", "Fashion", "Education", "Lifestyle"];

const TEMPLATES = [
  {
    id: 1, name: "Hook & Demo", niche: "E-Commerce",
    description: "Grab attention in 1 second, demonstrate your product with dynamic cuts",
    icon: Zap, color: "bg-amber-500/10 text-amber-500",
    structure: ["0-1s: Pattern Interrupt", "1-3s: Hook", "3-20s: Demo", "20-30s: CTA"],
    bestFor: "Product launches, reviews",
    performance: "2.4x avg. engagement",
  },
  {
    id: 2, name: "Wall of Text", niche: "Education",
    description: "Text-heavy storytelling with voiceover, perfect for tips and facts",
    icon: Type, color: "bg-blue-500/10 text-blue-500",
    structure: ["0-3s: Title card", "3-25s: Text reveal", "25-30s: CTA"],
    bestFor: "Tips, facts, motivation",
    performance: "3.1x avg. shares",
  },
  {
    id: 3, name: "Slideshow Story", niche: "Lifestyle",
    description: "Image carousel with synced voiceover and music",
    icon: Image, color: "bg-emerald-500/10 text-emerald-500",
    structure: ["0-5s: Intro slide", "5-25s: Story slides", "25-30s: Outro"],
    bestFor: "Day in life, transformations",
    performance: "1.8x avg. completion",
  },
  {
    id: 4, name: "Green Screen React", niche: "Entertainment",
    description: "React to trending content with your commentary",
    icon: Film, color: "bg-purple-500/10 text-purple-500",
    structure: ["0-2s: Setup", "2-20s: Reaction", "20-30s: Takeaway"],
    bestFor: "Trend jacking, memes",
    performance: "4.2x avg. views",
  },
  {
    id: 5, name: "UGC Testimonial", niche: "Fitness",
    description: "Authentic user-style review with AI avatar or real footage",
    icon: Sparkles, color: "bg-pink-500/10 text-pink-500",
    structure: ["0-3s: Intro", "3-25s: Review", "25-30s: CTA"],
    bestFor: "Reviews, testimonials",
    performance: "2.8x avg. trust score",
  },
  {
    id: 6, name: "Problem-Solution", niche: "Tech",
    description: "Present a problem, agitate, then solve with your product",
    icon: TrendingUp, color: "bg-red-500/10 text-red-500",
    structure: ["0-5s: Problem", "5-15s: Agitation", "15-30s: Solution"],
    bestFor: "SaaS, apps, gadgets",
    performance: "3.5x avg. conversion",
  },
  {
    id: 7, name: "Before & After", niche: "Fashion",
    description: "Show transformation with dramatic visual contrast",
    icon: Palette, color: "bg-cyan-500/10 text-cyan-500",
    structure: ["0-3s: Before", "3-5s: Transition", "5-30s: After + Details"],
    bestFor: "Makeup, fashion, fitness",
    performance: "2.9x avg. saves",
  },
  {
    id: 8, name: "Tutorial Quick", niche: "Food",
    description: "Fast-paced how-to with step-by-step visual guide",
    icon: Wand2, color: "bg-orange-500/10 text-orange-500",
    structure: ["0-2s: Final result", "2-25s: Steps", "25-30s: CTA"],
    bestFor: "Recipes, DIY, hacks",
    performance: "2.1x avg. watch time",
  },
];

export default function TemplatesPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = TEMPLATES.filter((t) => {
    if (activeCategory !== "All" && t.niche !== activeCategory) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
            <p className="mono-eyebrow text-primary mb-2">Content Templates</p>
            <h1 className="text-4xl md:text-5xl font-semibold">Templates</h1>
            <p className="text-foreground/60 mt-3 max-w-xl">
              Proven content formats optimized by AI. Choose a template, customize it, and publish.
            </p>
          </div>

          {/* Search + Filter */}
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    activeCategory === cat ? "bg-primary text-white" : "bg-surface border border-border text-foreground/60 hover:border-primary/50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Template Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((template, i) => {
              const Icon = template.icon;
              return (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-surface border border-border rounded-xl p-5 hover:shadow-card-hover transition-all group cursor-pointer flex flex-col"
                >
                  <div className={`h-12 w-12 rounded-xl ${template.color} flex items-center justify-center mb-4`}>
                    <Icon className="h-6 w-6" />
                  </div>

                  <h3 className="font-semibold">{template.name}</h3>
                  <p className="text-xs text-primary font-medium mt-1">{template.niche}</p>
                  <p className="text-sm text-foreground/50 mt-2 flex-1">{template.description}</p>

                  {/* Structure */}
                  <div className="mt-4 space-y-1">
                    {template.structure.map((step, si) => (
                      <div key={si} className="flex items-center gap-2 text-xs text-foreground/40">
                        <span className="h-1 w-1 rounded-full bg-primary/50" />
                        {step}
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="mt-4 pt-3 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-foreground/40">{template.bestFor}</span>
                      <span className="text-[10px] font-medium text-emerald-500">{template.performance}</span>
                    </div>
                    <Link
                      to="/dashboard/script"
                      className="w-full mt-3 py-2 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary hover:text-white transition-colors flex items-center justify-center gap-1"
                    >
                      <Sparkles className="h-3 w-3" /> Use Template
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
