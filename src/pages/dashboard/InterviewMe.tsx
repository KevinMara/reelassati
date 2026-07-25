import { useState } from "react";
import { MessageCircle, Send, Loader2, Sparkles, Copy, CheckCircle, Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/providers/trpc";

export default function InterviewMe() {
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("");
  const [platform, setPlatform] = useState("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [content, setContent] = useState<any[]>([]);
  const [step, setStep] = useState<"setup" | "interview" | "generating" | "done">("setup");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);

  const startMutation = trpc.interview.start.useMutation({
    onSuccess: (data) => {
      setQuestions(data.questions);
      setSessionId(data.sessionId ?? null);
      setStep("interview");
    },
  });

  const answerMutation = trpc.interview.answer.useMutation();
  const generateMutation = trpc.interview.generate.useMutation({
    onSuccess: (data) => {
      setContent(data.content);
      setStep("done");
    },
  });

  const handleStart = () => {
    if (!topic.trim()) return;
    startMutation.mutate({ topic, niche: niche || undefined, platform: platform || undefined });
  };

  const handleSubmitAnswers = () => {
    if (!sessionId) return;
    const answerArray = Object.entries(answers).map(([questionId, answer]) => ({
      questionId: Number(questionId),
      answer,
    }));
    answerMutation.mutate({ sessionId, answers: answerArray });
    setStep("generating");
    generateMutation.mutate({ sessionId });
  };

  const copyScript = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <p className="mono-eyebrow text-primary mb-2">Interview Mode</p>
        <h1 className="text-3xl font-semibold">Interview Me</h1>
        <p className="text-foreground/60 mt-2">AI interviews you like a podcast host, then turns your answers into content.</p>
      </div>

      <AnimatePresence mode="wait">
        {step === "setup" && (
          <motion.div key="setup" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2">What topic should we explore?</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., My journey as a fitness coach, Building a SaaS, Traveling Southeast Asia..."
                  className="w-full px-4 py-3 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Niche (optional)</label>
                  <input
                    type="text"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    placeholder="e.g., fitness, tech, travel"
                    className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Platform (optional)</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm"
                  >
                    <option value="">Any</option>
                    <option value="tiktok">TikTok</option>
                    <option value="instagram">Instagram</option>
                    <option value="youtube">YouTube</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="x">X / Twitter</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleStart}
                disabled={!topic.trim() || startMutation.isPending}
                className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {startMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing questions...</> : <><MessageCircle className="h-4 w-4" /> Start Interview</>}
              </button>
            </div>
          </motion.div>
        )}

        {step === "interview" && (
          <motion.div key="interview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-4 flex items-center gap-2 text-sm text-foreground/50">
              <Lightbulb className="h-4 w-4 text-primary" />
              Answer all {questions.length} questions. AI will turn your responses into content.
            </div>
            <div className="space-y-4">
              {questions.map((q: any) => (
                <div key={q.id} className="bg-surface border border-border rounded-xl p-5">
                  <p className="text-sm font-medium mb-3">{q.id}. {q.question}</p>
                  <textarea
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder="Your answer..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                </div>
              ))}
              <button
                onClick={handleSubmitAnswers}
                disabled={Object.keys(answers).length < questions.length || generateMutation.isPending}
                className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" /> Generate Content from My Answers
              </button>
            </div>
          </motion.div>
        )}

        {step === "generating" && (
          <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-lg font-medium">Turning your interview into content...</p>
          </motion.div>
        )}

        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-500">
              Generated {content.length} posts from your interview
            </div>
            <div className="space-y-4">
              {content.map((c: any, i: number) => (
                <div key={i} className="bg-surface border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium uppercase">{c.platform}</span>
                    <button onClick={() => copyScript(`${c.hook}\n\n${c.body}\n\n${c.cta}`, i)} className="text-xs flex items-center gap-1 text-foreground/40 hover:text-primary transition-colors">
                      {copiedIndex === i ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      {copiedIndex === i ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-primary mb-1">{c.hook}</p>
                  <p className="text-sm text-foreground/70 mb-2">{c.body}</p>
                  <p className="text-sm font-medium">{c.cta}</p>
                </div>
              ))}
            </div>
            <button onClick={() => { setStep("setup"); setTopic(""); setAnswers({}); setContent([]); }} className="mt-6 w-full py-3 border border-border rounded-lg font-medium hover:bg-surface transition-colors">
              New Interview
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
