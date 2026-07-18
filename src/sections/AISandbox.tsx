import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, Zap, FileText, TrendingUp, Clock } from "lucide-react";
import { motion } from "framer-motion";

const DEMO_TEMPLATES = [
  { id: "ugc", name: "UGC Review", prompt: "Create a 30-second authentic review for a protein powder brand targeting fitness enthusiasts", icon: Zap },
  { id: "edu", name: "Educational", prompt: "Write a 45-second educational script about why most people fail at content creation", icon: FileText },
  { id: "viral", name: "Viral Hook", prompt: "Generate 5 viral hooks for a fashion brand launching a summer collection", icon: TrendingUp },
];

const DEMO_RESULTS: Record<string, { hook: string; body: string; cta: string; score: number }> = {
  ugc: {
    hook: "I've tried 23 protein powders. This is the only one that actually works.",
    body: "Okay so real talk — I've been hitting the gym for 2 years and wasted so much money on protein that tastes like chalk. Then my trainer showed me this. Mixes in 3 seconds, zero clumps, and the chocolate flavor actually hits different. 25g protein per scoop, no artificial junk. I've been using it for 6 months straight.",
    cta: "Link in bio — use code GAINS20 for 20% off. Trust me on this one.",
    score: 96,
  },
  edu: {
    hook: "95% of content creators quit before month 3. Here's why.",
    body: "Most people think you need expensive gear or perfect lighting. Wrong. The real reason people fail? They post without a system. No hook strategy. No content calendar. No idea what their audience actually wants. The creators who win? They treat content like a science, not art.",
    cta: "Follow for the exact system I used to hit 100K in 90 days.",
    score: 94,
  },
  viral: {
    hook: "POV: You found the summer outfit that makes everyone stop and stare.",
    body: "", // Will be generated as 5 hooks
    cta: "",
    score: 92,
  },
};

export default function AISandbox() {
  const { t } = useTranslation();
  const [activeDemo, setActiveDemo] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<typeof DEMO_RESULTS[string] | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");

  const handleDemo = (id: string) => {
    setActiveDemo(id);
    setGenerating(true);
    setResult(null);
    setTimeout(() => {
      setResult(DEMO_RESULTS[id]);
      setGenerating(false);
    }, 1500);
  };

  return (
    <section className="section border-t border-border bg-surface relative overflow-hidden">
      <div className="container-page">
        <div className="text-center mb-10">
          <p className="mono-eyebrow text-primary mb-2">Try It Now</p>
          <h2 className="text-3xl md:text-4xl font-semibold">Experience the AI</h2>
          <p className="text-foreground/60 mt-3 max-w-lg mx-auto">
            See REELassati generate scripts in real-time. Pick a template or enter your own topic.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Template Buttons */}
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {DEMO_TEMPLATES.map((demo) => (
              <button
                key={demo.id}
                onClick={() => handleDemo(demo.id)}
                disabled={generating}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeDemo === demo.id
                    ? "bg-primary text-white"
                    : "bg-background border border-border hover:border-primary/50"
                }`}
              >
                <demo.icon className="h-3.5 w-3.5" />
                {demo.name}
              </button>
            ))}
          </div>

          {/* Custom Input */}
          <div className="flex gap-3 mb-8 max-w-2xl mx-auto">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && customPrompt && handleDemo("custom")}
              placeholder="Or type any topic (e.g., 'skincare routine for oily skin')..."
              className="flex-1 px-4 py-3 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={() => customPrompt && handleDemo("custom")}
              disabled={!customPrompt || generating}
              className="px-5 py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? (
                <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <><Sparkles className="h-4 w-4" /> Generate</>
              )}
            </button>
          </div>

          {/* Result */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-background border border-border rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">AI-Generated Script</span>
                </div>
                <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-medium">
                  Hook Score: {result.score}/100
                </span>
              </div>

              {result.hook && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 mb-3">
                  <span className="text-[10px] uppercase tracking-wider text-primary font-medium">Hook</span>
                  <p className="text-lg font-semibold mt-1">{result.hook}</p>
                </div>
              )}

              {result.body && (
                <div className="p-4 rounded-lg bg-surface mb-3">
                  <span className="text-[10px] uppercase tracking-wider text-foreground/40 font-medium">Body</span>
                  <p className="text-sm text-foreground/70 mt-1 leading-relaxed">{result.body}</p>
                </div>
              )}

              {result.cta && (
                <div className="p-4 rounded-lg bg-surface mb-4">
                  <span className="text-[10px] uppercase tracking-wider text-foreground/40 font-medium">Call to Action</span>
                  <p className="text-sm font-medium mt-1">{result.cta}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-xs text-foreground/40 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Generated in 1.2s
                </span>
                <Link
                  to="/dashboard/script"
                  className="text-sm text-primary hover:text-primary-hover font-medium flex items-center gap-1"
                >
                  Try the full tool <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>
          )}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <p className="text-foreground/50 text-sm mb-4">
            This is just a preview. The full tool includes 1000+ hooks, brand voice training, and multi-language support.
          </p>
          <Link
            to="/auth/signup"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            Start Creating Free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
