import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/providers/trpc";
import { Search, Sparkles, TrendingUp, Clock, Users, Heart, MessageCircle, Share2, BarChart3, Zap, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DEMO_ANALYSIS = {
  url: "https://tiktok.com/@creator/video/123456",
  platform: "tiktok" as const,
  title: "3 Gym Mistakes Killing Your Gains",
  creator: "@fitnessexpert",
  duration: 45,
  hookScore: 94,
  structureScore: 88,
  engagementScore: 91,
  overallScore: 91,
  views: "2.4M",
  likes: "185K",
  comments: "4.2K",
  shares: "12K",
  structure: [
    { time: "0-1s", label: "Hook", desc: "'Stop making these 3 mistakes' — pattern interrupt with finger point", score: 95 },
    { time: "1-3s", label: "Problem", desc: "'Your gains are suffering and you don't even know it'", score: 92 },
    { time: "3-15s", label: "Mistake 1", desc: "Not progressive overload — visual demo with text overlay", score: 88 },
    { time: "15-25s", label: "Mistake 2", desc: "Wrong form — split-screen comparison", score: 90 },
    { time: "25-38s", label: "Mistake 3", desc: "Not enough protein — quick recipe insert", score: 85 },
    { time: "38-45s", label: "CTA", desc: "'Follow for daily tips + which mistake are YOU making?'", score: 93 },
  ],
  hookBreakdown: {
    patternInterrupt: 95,
    curiosityGap: 92,
    relatability: 88,
    urgency: 85,
  },
  whyItWorks: [
    "Uses a '3 mistakes' framework — proven pattern in fitness niche",
    "Opens with direct address + visual gesture (pattern interrupt)",
    "Each mistake gets a unique visual treatment (no repetition)",
    "CTA uses comment-bait technique ('which mistake are YOU making?')",
    "45s length is optimal for TikTok algorithm (high completion rate)",
  ],
  remixSuggestions: [
    "Apply same '3 mistakes' structure to your niche",
    "Replace gym footage with your product/service context",
    "Keep the comment-bait CTA — it drives 3x more comments",
    "Use similar color scheme (high contrast text on dark background)",
  ],
};

export default function VideoAnalyzer() {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleAnalyze = () => {
    if (!url.trim()) return;
    setAnalyzing(true);
    // Simulate AI analysis delay
    setTimeout(() => {
      setResult(DEMO_ANALYSIS);
      setAnalyzing(false);
    }, 2000);
  };

  const scoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-500";
    if (score >= 75) return "text-amber-500";
    return "text-red-500";
  };

  const scoreBg = (score: number) => {
    if (score >= 90) return "bg-emerald-500";
    if (score >= 75) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="mono-eyebrow text-primary mb-2">Neural Analyzer</p>
        <h1 className="text-3xl font-semibold">Video Analyzer</h1>
        <p className="text-foreground/60 mt-2">Paste any viral video URL to uncover why it works and remix it for your brand</p>
      </div>

      {/* URL Input */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste TikTok, Instagram, or YouTube URL..."
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={!url.trim() || analyzing}
            className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {analyzing ? (
              <><span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" /> Analyzing...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Analyze</>
            )}
          </button>
        </div>
        <p className="text-xs text-foreground/40 mt-2">Supports TikTok, Instagram Reels, YouTube Shorts</p>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{result.title}</h2>
                  <p className="text-sm text-foreground/60 mt-1">by {result.creator} • {result.duration}s • {result.platform}</p>
                </div>
                <div className="text-center">
                  <div className={`text-4xl font-bold ${scoreColor(result.overallScore)}`}>{result.overallScore}</div>
                  <p className="text-xs text-foreground/50">Overall Score</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mt-6">
                <div className="text-center p-3 rounded-lg bg-background">
                  <p className="text-lg font-semibold">{result.views}</p>
                  <p className="text-xs text-foreground/50">Views</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-background">
                  <p className="text-lg font-semibold">{result.likes}</p>
                  <Heart className="h-3.5 w-3.5 mx-auto text-foreground/40 mt-1" />
                </div>
                <div className="text-center p-3 rounded-lg bg-background">
                  <p className="text-lg font-semibold">{result.comments}</p>
                  <MessageCircle className="h-3.5 w-3.5 mx-auto text-foreground/40 mt-1" />
                </div>
                <div className="text-center p-3 rounded-lg bg-background">
                  <p className="text-lg font-semibold">{result.shares}</p>
                  <Share2 className="h-3.5 w-3.5 mx-auto text-foreground/40 mt-1" />
                </div>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-surface border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Hook Strength</span>
                  <span className={`text-lg font-bold ${scoreColor(result.hookScore)}`}>{result.hookScore}</span>
                </div>
                <div className="h-2 rounded-full bg-background overflow-hidden">
                  <div className={`h-full rounded-full ${scoreBg(result.hookScore)}`} style={{ width: `${result.hookScore}%` }} />
                </div>
              </div>
              <div className="bg-surface border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Structure</span>
                  <span className={`text-lg font-bold ${scoreColor(result.structureScore)}`}>{result.structureScore}</span>
                </div>
                <div className="h-2 rounded-full bg-background overflow-hidden">
                  <div className={`h-full rounded-full ${scoreBg(result.structureScore)}`} style={{ width: `${result.structureScore}%` }} />
                </div>
              </div>
              <div className="bg-surface border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Engagement</span>
                  <span className={`text-lg font-bold ${scoreColor(result.engagementScore)}`}>{result.engagementScore}</span>
                </div>
                <div className="h-2 rounded-full bg-background overflow-hidden">
                  <div className={`h-full rounded-full ${scoreBg(result.engagementScore)}`} style={{ width: `${result.engagementScore}%` }} />
                </div>
              </div>
            </div>

            {/* Structure Timeline */}
            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Structure Breakdown
              </h3>
              <div className="space-y-3">
                {result.structure.map((s: any, i: number) => (
                  <div key={i} className="flex items-start gap-4 p-3 rounded-lg bg-background">
                    <div className="shrink-0 text-center w-16">
                      <span className="text-xs font-mono text-foreground/40">{s.time}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{s.label}</span>
                        <span className={`text-xs font-mono ${scoreColor(s.score)}`}>{s.score}</span>
                      </div>
                      <p className="text-xs text-foreground/60 mt-1">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Why It Works */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-surface border border-border rounded-xl p-6">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Why It Works
                </h3>
                <ul className="space-y-2">
                  {result.whyItWorks.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/70">
                      <span className="text-primary mt-1">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-surface border border-border rounded-xl p-6">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Remix for Your Brand
                </h3>
                <ul className="space-y-2">
                  {result.remixSuggestions.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/70">
                      <span className="text-primary mt-1">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <button className="w-full mt-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
                  <Sparkles className="h-3.5 w-3.5 inline mr-1" /> Generate Remix Script
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
