import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Lightbulb,
  Loader2,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Platform, ScriptDraft } from "@contracts/workspace";
import { platformApi, PlatformApiError } from "@/lib/platform-api";
import { useWorkspace } from "@/providers/workspace";

interface InterviewQuestion {
  id: string;
  eyebrow: string;
  prompt: string;
  guidance: string;
}

const PLATFORM_OPTIONS: Array<{ value: Platform; label: string }> = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram Reels" },
  { value: "youtube", label: "YouTube Shorts" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter", label: "X / Twitter" },
];

function createId(prefix: string) {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomPart}`;
}

function describeError(cause: unknown) {
  if (cause instanceof PlatformApiError && cause.missing.length > 0) {
    return `${cause.message} Missing: ${cause.missing.join(", ")}.`;
  }
  return cause instanceof Error ? cause.message : "Script generation failed.";
}

export default function InterviewMe() {
  const { workspace, capabilities, updateWorkspace } = useWorkspace();
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [step, setStep] = useState<"setup" | "interview" | "generating" | "done">(
    "setup",
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [script, setScript] = useState<ScriptDraft | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const questions = useMemo<InterviewQuestion[]>(
    () => [
      {
        id: "tension",
        eyebrow: "The hook",
        prompt: `What is the most surprising, painful or counter-intuitive truth about ${topic || "this topic"}?`,
        guidance:
          "Name the tension plainly. Avoid an introduction—start where attention is already at stake.",
      },
      {
        id: "before",
        eyebrow: "The old belief",
        prompt: "What did you believe or do before you learned this?",
        guidance:
          "A clear before-state makes the transformation concrete and relatable.",
      },
      {
        id: "moment",
        eyebrow: "The proof",
        prompt: "Describe one specific moment, result or mistake that changed your mind.",
        guidance:
          "Use an observable detail: a number, a scene, a decision or a consequence.",
      },
      {
        id: "method",
        eyebrow: "The value",
        prompt: "What are the 2–3 steps someone can copy immediately?",
        guidance:
          "Keep each step executable. This becomes the useful center of the short.",
      },
      {
        id: "voice",
        eyebrow: "The point of view",
        prompt: "What would you say that a generic creator would be afraid to say?",
        guidance:
          "Give the script a defensible opinion and your actual voice.",
      },
      {
        id: "action",
        eyebrow: "The close",
        prompt: "What is the single next action the viewer should take?",
        guidance:
          "Choose one outcome: try, save, comment, follow or visit—never all of them.",
      },
    ],
    [topic],
  );

  const currentQuestion = questions[questionIndex];
  const currentAnswer = answers[currentQuestion?.id] || "";

  const startInterview = () => {
    if (!topic.trim()) return;
    setError("");
    setQuestionIndex(0);
    setAnswers({});
    setScript(null);
    setStep("interview");
  };

  const generateScript = async () => {
    if (!capabilities.ai) {
      setError(
        "AI generation is not configured. Your interview answers remain on this screen; configure the server-side OpenRouter key before generating.",
      );
      return;
    }

    setStep("generating");
    setError("");
    const interviewContext = questions
      .map(
        (question, index) =>
          `${index + 1}. ${question.prompt}\nAnswer: ${answers[question.id]?.trim() || "(not answered)"}`,
      )
      .join("\n\n");
    try {
      const result = await platformApi.generateScript({
        topic: [
          `Create one short-form script about: ${topic.trim()}.`,
          niche.trim() ? `Creator niche: ${niche.trim()}.` : "",
          "Use the interview evidence below. Preserve the creator's facts and point of view; do not invent results, credentials or anecdotes.",
          interviewContext,
        ]
          .filter(Boolean)
          .join("\n\n"),
        platform,
        tone: "direct, specific, human",
        duration: 45,
        language: workspace.profile.contentLanguage,
        brandVoice: workspace.brandKit.voice || undefined,
      });

      await updateWorkspace((current) => ({
        ...current,
        scripts: [
          result.script,
          ...current.scripts.filter((item) => item.id !== result.script.id),
        ],
        activity: [
          {
            id: createId("event"),
            type: "script" as const,
            label: "Interview script generated",
            detail: result.script.title || topic.trim(),
            createdAt: new Date().toISOString(),
          },
          ...current.activity,
        ].slice(0, 100),
      }));
      setScript(result.script);
      setStep("done");
    } catch (cause) {
      setError(describeError(cause));
      setStep("interview");
    }
  };

  const advance = async () => {
    if (!currentAnswer.trim()) return;
    if (questionIndex === questions.length - 1) {
      await generateScript();
      return;
    }
    setQuestionIndex((current) => current + 1);
  };

  const copyScript = async () => {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script.fullScript);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard access was blocked. Select the script and copy it manually.");
    }
  };

  const reset = () => {
    setTopic("");
    setNiche("");
    setPlatform("tiktok");
    setQuestionIndex(0);
    setAnswers({});
    setScript(null);
    setError("");
    setStep("setup");
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <p className="mono-eyebrow mb-2 text-primary">Story extractor</p>
        <h1 className="text-3xl font-semibold">Interview Me</h1>
        <p className="mt-2 max-w-2xl text-foreground/60">
          Answer a focused editorial interview, then turn your own evidence into
          one production-ready short-form script.
        </p>
      </div>

      {!capabilities.ai && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-sm text-foreground/65">
            The guided interview is available. Final script generation requires
            the server-side AI integration; REELassati will not pretend a local
            template is an AI result.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-500">
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === "setup" && (
          <motion.section
            key="setup"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-border bg-surface p-6"
          >
            <div className="space-y-5">
              <div>
                <label htmlFor="interview-topic" className="mb-2 block text-sm font-medium">
                  What should this short be about?
                </label>
                <input
                  id="interview-topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="The lesson I learned after launching too early…"
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="interview-niche" className="mb-2 block text-sm font-medium">
                    Niche
                  </label>
                  <input
                    id="interview-niche"
                    value={niche}
                    onChange={(event) => setNiche(event.target.value)}
                    placeholder="Design, fitness, business…"
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="interview-platform" className="mb-2 block text-sm font-medium">
                    Destination
                  </label>
                  <select
                    id="interview-platform"
                    value={platform}
                    onChange={(event) =>
                      setPlatform(event.target.value as Platform)
                    }
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm"
                  >
                    {PLATFORM_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={startInterview}
                disabled={!topic.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
              >
                <MessageCircle className="h-4 w-4" />
                Start the interview
              </button>
            </div>
          </motion.section>
        )}

        {step === "interview" && currentQuestion && (
          <motion.section
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
          >
            <div className="mb-4 flex items-center justify-between text-xs text-foreground/45">
              <span>
                Question {questionIndex + 1} of {questions.length}
              </span>
              <span>{Math.round(((questionIndex + 1) / questions.length) * 100)}%</span>
            </div>
            <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{
                  width: `${((questionIndex + 1) / questions.length) * 100}%`,
                }}
              />
            </div>

            <div className="rounded-xl border border-border bg-surface p-6">
              <p className="mono-eyebrow mb-3 text-primary">
                {currentQuestion.eyebrow}
              </p>
              <h2 className="text-xl font-semibold leading-snug">
                {currentQuestion.prompt}
              </h2>
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-xs leading-relaxed text-foreground/55">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                {currentQuestion.guidance}
              </div>
              <textarea
                autoFocus
                value={currentAnswer}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [currentQuestion.id]: event.target.value,
                  }))
                }
                placeholder="Answer in your own words. Specific beats polished."
                rows={7}
                className="mt-5 w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary/30"
              />

              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    questionIndex === 0
                      ? setStep("setup")
                      : setQuestionIndex((current) => current - 1)
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-background"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void advance()}
                  disabled={!currentAnswer.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40"
                >
                  {questionIndex === questions.length - 1 ? (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate script
                    </>
                  ) : (
                    <>
                      Next question
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.section>
        )}

        {step === "generating" && (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-border bg-surface py-20 text-center"
          >
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
            <p className="text-lg font-medium">Writing from your answers…</p>
            <p className="mt-2 text-sm text-foreground/45">
              One request, then one persisted script—sequentially.
            </p>
          </motion.div>
        )}

        {step === "done" && script && (
          <motion.section
            key="done"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Script saved to your workspace
            </div>
            <article className="rounded-xl border border-border bg-surface p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-primary">
                    {script.platform}
                  </span>
                  <h2 className="mt-3 text-xl font-semibold">{script.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => void copyScript()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:border-primary/40"
                >
                  {copied ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <p className="mono-eyebrow mb-2 text-primary">Hook</p>
                  <p className="text-base font-medium leading-relaxed">{script.hook}</p>
                </div>
                <div>
                  <p className="mono-eyebrow mb-2 text-primary">Body</p>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/75">
                    {script.body}
                  </p>
                </div>
                <div>
                  <p className="mono-eyebrow mb-2 text-primary">Call to action</p>
                  <p className="text-sm font-medium">{script.cta}</p>
                </div>
              </div>
            </article>
            <button
              type="button"
              onClick={reset}
              className="mt-5 w-full rounded-lg border border-border py-3 text-sm font-medium hover:bg-surface"
            >
              Start a new interview
            </button>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
