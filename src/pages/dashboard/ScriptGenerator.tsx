import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/providers/trpc";
import { PenLine, Sparkles, Copy, Check, Clock, TrendingUp, MessageSquare, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const PLATFORMS = [
  { value: "tiktok", label: "TikTok", icon: "T" },
  { value: "instagram", label: "Instagram", icon: "I" },
  { value: "youtube", label: "YouTube", icon: "Y" },
  { value: "x", label: "X / Twitter", icon: "X" },
  { value: "facebook", label: "Facebook", icon: "F" },
  { value: "linkedin", label: "LinkedIn", icon: "L" },
];

const TONES = ["energetic", "professional", "casual", "dramatic", "educational", "funny", "inspirational"];
const DURATIONS = [15, 30, 60, 90];

const HOOK_LIBRARY = [
  { text: "Stop scrolling! This changes everything...", score: 94, niche: "general" },
  { text: "I wish I knew this sooner...", score: 91, niche: "education" },
  { text: "POV: You just found the secret to...", score: 89, niche: "lifestyle" },
  { text: "This is why your content isn't going viral...", score: 88, niche: "marketing" },
  { text: "3 things nobody tells you about...", score: 87, niche: "education" },
  { text: "Wait for it... [shocking reveal]", score: 93, niche: "entertainment" },
  { text: "Unpopular opinion but...", score: 85, niche: "general" },
  { text: "The truth about [topic] they don't want you to know", score: 90, niche: "news" },
];

export default function ScriptGenerator() {
  const { t } = useTranslation();
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("tiktok");
  const [tone, setTone] = useState("energetic");
  const [duration, setDuration] = useState(30);
  const [language, setLanguage] = useState("en");
  const [generatedScript, setGeneratedScript] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [showHooks, setShowHooks] = useState(false);

  const generateMutation = trpc.script.generate.useMutation({
    onSuccess: (data) => setGeneratedScript(data),
  });

  const handleGenerate = () => {
    if (!topic.trim()) return;
    generateMutation.mutate({ topic, platform: platform as any, tone, duration, language });
  };

  const handleCopy = () => {
    if (generatedScript?.fullScript) {
      navigator.clipboard.writeText(generatedScript.fullScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="mono-eyebrow text-primary mb-2">AI Script Engineering</p>
        <h1 className="text-3xl font-semibold">Script Generator</h1>
        <p className="text-foreground/60 mt-2">Generate platform-optimized scripts with proven hooks in seconds</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="space-y-5">
          <div className="bg-surface border border-border rounded-xl p-6">
            <label className="block text-sm font-medium mb-2">Topic or Product</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Best protein powder for beginners..."
              className="w-full px-4 py-3 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-2">Platform</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm"
                >
                  {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Tone</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm"
                >
                  {TONES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-2">Duration</label>
                <div className="flex gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                        duration === d ? "bg-primary text-white" : "bg-background border border-border hover:border-primary/50"
                      }`}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm"
                >
                  <option value="en">English</option>
                  <option value="it">Italian</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!topic.trim() || generateMutation.isPending}
              className="w-full mt-5 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generateMutation.isPending ? (
                <><span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" /> Generating...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Generate Script</>
              )}
            </button>
          </div>

          {/* Hook Library */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <button
              onClick={() => setShowHooks(!showHooks)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="font-medium">Hook Library</span>
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{HOOK_LIBRARY.length}+ proven hooks</span>
              </div>
              <span className="text-foreground/40 text-sm">{showHooks ? "▲" : "▼"}</span>
            </button>

            <AnimatePresence>
              {showHooks && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 space-y-2">
                    {HOOK_LIBRARY.map((hook, i) => (
                      <div
                        key={i}
                        onClick={() => setTopic(hook.text)}
                        className="p-3 rounded-lg bg-background border border-border hover:border-primary/50 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm">{hook.text}</p>
                          <span className="text-xs font-mono text-emerald-500 shrink-0 ml-2">{hook.score}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-foreground/40 uppercase">{hook.niche}</span>
                          <span className="text-[10px] text-foreground/20">Click to use</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Output Panel */}
        <div>
          <AnimatePresence mode="wait">
            {generatedScript ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface border border-border rounded-xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <PenLine className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">{generatedScript.title}</h3>
                      <p className="text-xs text-foreground/50">AI-generated • {duration}s • {platform}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-full font-medium">
                      Score: {generatedScript.hookScore}/100
                    </span>
                    <button onClick={handleCopy} className="p-2 rounded-lg hover:bg-background transition-colors">
                      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium text-primary uppercase">Hook</span>
                    </div>
                    <p className="text-lg font-semibold">{generatedScript.hook}</p>
                  </div>

                  <div className="p-4 rounded-lg bg-background border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-3.5 w-3.5 text-foreground/40" />
                      <span className="text-xs font-medium text-foreground/50 uppercase">Body</span>
                    </div>
                    <p className="text-sm leading-relaxed">{generatedScript.body}</p>
                  </div>

                  <div className="p-4 rounded-lg bg-background border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-3.5 w-3.5 text-foreground/40" />
                      <span className="text-xs font-medium text-foreground/50 uppercase">Call to Action</span>
                    </div>
                    <p className="text-sm font-medium">{generatedScript.cta}</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border flex gap-2">
                  <button className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
                    Save to Library
                  </button>
                  <button className="flex-1 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:border-primary/50 transition-colors">
                    Create Video
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-surface border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center"
              >
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-primary/40" />
                </div>
                <h3 className="text-lg font-medium text-foreground/60">Your script will appear here</h3>
                <p className="text-sm text-foreground/40 mt-2 max-w-xs">Enter a topic, choose your platform and tone, then click Generate</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
