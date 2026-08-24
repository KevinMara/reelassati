import { lazy, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Check,
  Clock3,
  Copy,
  FileText,
  Library,
  MessageSquareText,
  PenLine,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import type {
  Platform,
  ScriptDraft,
  WorkspaceEvent,
} from "@contracts/workspace";
import { platformApi } from "@/lib/platform-api";
import { useWorkspace } from "@/providers/workspace";
import { WRITING_LANGUAGES } from "@/lib/languages";
import { AiProvenanceBadge } from "@/components/compliance/AiProvenanceBadge";
import { copyTextWithProvenance } from "@/lib/provenance";
import posthog from "@/lib/posthog";

const InterviewMe = lazy(() => import("./InterviewMe"));

const PLATFORMS: Array<{ value: Platform; label: string }> = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram Reels" },
  { value: "youtube", label: "YouTube Shorts" },
  { value: "twitter", label: "X" },
  { value: "facebook", label: "Facebook Reels" },
  { value: "linkedin", label: "LinkedIn" },
];

const TONES = [
  "energetic",
  "professional",
  "casual",
  "dramatic",
  "educational",
  "funny",
  "inspirational",
] as const;

const DURATIONS = [15, 30, 60, 90] as const;

const HOOK_PATTERNS = [
  {
    id: "contrarian",
    name: "Contrarian reset",
    pattern:
      "Most people believe [common belief]. Here is what actually works for [topic].",
    intent:
      "Challenge an assumption, then earn attention with a specific alternative.",
  },
  {
    id: "specific-result",
    name: "Specific result",
    pattern: "I changed [one action] and got [specific result] in [timeframe].",
    intent: "Lead with an outcome the viewer can understand immediately.",
  },
  {
    id: "costly-mistake",
    name: "Costly mistake",
    pattern:
      "If you are trying to [goal], stop doing [mistake] before your next attempt.",
    intent: "Make the risk concrete without manufacturing urgency.",
  },
  {
    id: "open-loop",
    name: "Open loop",
    pattern:
      "The last step is why [topic] finally worked, but the first two make it possible.",
    intent: "Promise a useful payoff and give the viewer a reason to stay.",
  },
  {
    id: "before-after",
    name: "Before / after",
    pattern: "This is [topic] before [change]. This is what happened after.",
    intent: "Build the opening around a visible transformation.",
  },
  {
    id: "fast-proof",
    name: "Proof first",
    pattern: "Here is the result. Now I will show you exactly how I made it.",
    intent: "Show evidence before explaining the process.",
  },
] as const;

type SaveState = "idle" | "saving" | "saved" | "error";

function composeFullScript(draft: ScriptDraft) {
  return [draft.hook, draft.body, draft.cta].filter(Boolean).join("\n\n");
}

function createEvent(
  type: WorkspaceEvent["type"],
  label: string,
  detail: string
): WorkspaceEvent {
  return {
    id: crypto.randomUUID(),
    type,
    label,
    detail,
    createdAt: new Date().toISOString(),
  };
}

function DirectScriptGenerator() {
  const { workspace, capabilities, loading, saving, updateWorkspace } =
    useWorkspace();
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [tone, setTone] = useState<(typeof TONES)[number]>("energetic");
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(30);
  const [language, setLanguage] = useState(
    workspace.profile.contentLanguage || "en"
  );
  const [hookDirection, setHookDirection] = useState("");
  const [generatedScript, setGeneratedScript] = useState<ScriptDraft | null>(
    null
  );
  const [generating, setGenerating] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [copied, setCopied] = useState(false);
  const [showHooks, setShowHooks] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const aiReady = capabilities.ai;

  const saveScript = async (script: ScriptDraft, activityLabel: string) => {
    setSaveState("saving");
    try {
      const savedWorkspace = await updateWorkspace(current => ({
        ...current,
        scripts: [
          script,
          ...current.scripts.filter(candidate => candidate.id !== script.id),
        ],
        activity: [
          createEvent(
            "script",
            activityLabel,
            `${script.title} · ${script.platform} · ${script.duration}s`
          ),
          ...current.activity,
        ].slice(0, 100),
      }));
      const canonical = savedWorkspace.scripts.find(
        candidate => candidate.id === script.id
      );
      if (canonical) setGeneratedScript(canonical);
      setSaveState("saved");
    } catch (cause) {
      setSaveState("error");
      throw cause;
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim() || !aiReady || generating) return;
    setGenerating(true);
    setSaveState("idle");
    setError(null);

    const resolvedHook = hookDirection.trim()
      ? hookDirection.replaceAll("[topic]", topic.trim())
      : "";
    const brandInstructions = [
      workspace.brandKit.voice
        ? `Brand voice: ${workspace.brandKit.voice}`
        : "",
      workspace.brandKit.audience
        ? `Audience: ${workspace.brandKit.audience}`
        : "",
      resolvedHook ? `Preferred opening direction: ${resolvedHook}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const { script } = await platformApi.generateScript({
        topic: topic.trim(),
        platform,
        tone,
        duration,
        language,
        brandVoice: brandInstructions || undefined,
      });
      setGeneratedScript(script);
      await saveScript(script, "Script generated");
      posthog?.capture("script_generated", {
        platform,
        tone,
        duration_seconds: duration,
        language,
        used_hook_direction: Boolean(hookDirection.trim()),
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The script could not be generated."
      );
    } finally {
      setGenerating(false);
    }
  };

  const updateDraft = (
    field: "title" | "hook" | "body" | "cta",
    value: string
  ) => {
    setGeneratedScript(current => {
      if (!current) return current;
      const next = { ...current, [field]: value };
      return {
        ...next,
        fullScript: composeFullScript(next),
        provenance: undefined,
      };
    });
    setSaveState("idle");
  };

  const saveEdits = async () => {
    if (!generatedScript || saving) return;
    setError(null);
    try {
      await saveScript(generatedScript, "Script updated");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The edits could not be saved."
      );
    }
  };

  const handleCopy = async () => {
    if (!generatedScript) return;
    setError(null);
    try {
      await copyTextWithProvenance(
        generatedScript.fullScript,
        generatedScript.provenance
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(
        "Clipboard access is blocked. Select the script text and copy it manually."
      );
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <p className="mono-eyebrow mb-2 text-primary">AI Script Engineering</p>
        <h1 className="text-3xl font-semibold">Script Generator</h1>
        <p className="mt-2 max-w-2xl text-foreground/60">
          Direct the hook, voice, pacing, and platform. Every generated draft is
          saved to your workspace automatically.
        </p>
      </div>

      {!loading && !aiReady ? (
        <div
          className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4"
          role="status"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-medium">
              Script generation needs AI setup
            </p>
            <p className="mt-1 text-xs text-foreground/55">
              Script generation is temporarily unavailable. Your prompts stay in
              the browser until you choose Generate.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-surface p-6">
            <label
              className="mb-2 block text-sm font-medium"
              htmlFor="script-topic"
            >
              Topic, product, or argument
            </label>
            <textarea
              id="script-topic"
              value={topic}
              onChange={event => setTopic(event.target.value)}
              placeholder="Example: Why creators should edit for retention before adding effects"
              rows={3}
              maxLength={1200}
              className="w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  className="mb-2 block text-sm font-medium"
                  htmlFor="script-platform"
                >
                  Platform
                </label>
                <select
                  id="script-platform"
                  value={platform}
                  onChange={event =>
                    setPlatform(event.target.value as Platform)
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                >
                  {PLATFORMS.map(item => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="mb-2 block text-sm font-medium"
                  htmlFor="script-tone"
                >
                  Tone
                </label>
                <select
                  id="script-tone"
                  value={tone}
                  onChange={event =>
                    setTone(event.target.value as (typeof TONES)[number])
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm capitalize"
                >
                  {TONES.map(item => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <fieldset>
                <legend className="mb-2 text-sm font-medium">
                  Target length
                </legend>
                <div className="flex gap-2">
                  {DURATIONS.map(seconds => (
                    <button
                      key={seconds}
                      type="button"
                      aria-pressed={duration === seconds}
                      onClick={() => setDuration(seconds)}
                      className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                        duration === seconds
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-background hover:border-primary/50"
                      }`}
                    >
                      {seconds}s
                    </button>
                  ))}
                </div>
              </fieldset>
              <div>
                <label
                  className="mb-2 block text-sm font-medium"
                  htmlFor="script-language"
                >
                  Language
                </label>
                <select
                  id="script-language"
                  value={language}
                  onChange={event => setLanguage(event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                >
                  {WRITING_LANGUAGES.map(item => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label
              className="mb-2 mt-4 block text-sm font-medium"
              htmlFor="hook-direction"
            >
              Hook direction{" "}
              <span className="font-normal text-foreground/40">(optional)</span>
            </label>
            <textarea
              id="hook-direction"
              value={hookDirection}
              onChange={event => setHookDirection(event.target.value)}
              placeholder="Choose a pattern below or write the opening logic yourself."
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />

            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={!topic.trim() || generating || loading || !aiReady}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
            >
              {generating ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Generating and saving
                </>
              ) : (
                <>
                  <WandSparkles className="h-4 w-4" />
                  Generate script
                </>
              )}
            </button>

            {error ? (
              <p className="mt-3 text-sm text-red-500" role="alert">
                {error}
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-surface p-6">
            <button
              type="button"
              onClick={() => setShowHooks(current => !current)}
              aria-expanded={showHooks}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="flex items-center gap-2 font-medium">
                <MessageSquareText className="h-4 w-4 text-primary" />
                Hook patterns
              </span>
              <span className="text-xs text-foreground/45">
                {showHooks ? "Hide" : "Show"}
              </span>
            </button>

            <AnimatePresence initial={false}>
              {showHooks ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 space-y-2">
                    {HOOK_PATTERNS.map(hook => (
                      <button
                        key={hook.id}
                        type="button"
                        onClick={() => setHookDirection(hook.pattern)}
                        className="w-full rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-primary/50"
                      >
                        <span className="text-sm font-medium">{hook.name}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-foreground/65">
                          {hook.pattern}
                        </span>
                        <span className="mt-2 block text-[11px] text-foreground/40">
                          {hook.intent}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-foreground/40">
                    These are writing structures, not performance guarantees.
                    Edit the wording to match your proof, audience, and offer.
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
        </div>

        <div className="space-y-5">
          <AnimatePresence mode="wait">
            {generatedScript ? (
              <motion.section
                key={generatedScript.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-surface p-6"
              >
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <PenLine className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <input
                        aria-label="Script title"
                        value={generatedScript.title}
                        onChange={event =>
                          updateDraft("title", event.target.value)
                        }
                        className="w-full border-0 bg-transparent p-0 font-medium outline-none"
                      />
                      <p className="mt-1 text-xs text-foreground/45">
                        {generatedScript.duration}s · {generatedScript.platform}{" "}
                        · {generatedScript.language.toUpperCase()}
                      </p>
                      <div className="mt-2">
                        <AiProvenanceBadge
                          provenance={generatedScript.provenance}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs ${
                        saveState === "error"
                          ? "text-red-500"
                          : saveState === "saved"
                            ? "text-emerald-500"
                            : "text-foreground/40"
                      }`}
                      aria-live="polite"
                    >
                      {saveState === "saving"
                        ? "Saving"
                        : saveState === "saved"
                          ? "Saved"
                          : saveState === "error"
                            ? "Save failed"
                            : "Edited"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopy()}
                      className="rounded-lg p-2 transition-colors hover:bg-background"
                      aria-label="Copy complete script"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <label
                      className="mb-2 block text-xs font-medium uppercase tracking-wider text-primary"
                      htmlFor="generated-hook"
                    >
                      Hook
                    </label>
                    <textarea
                      id="generated-hook"
                      value={generatedScript.hook}
                      onChange={event =>
                        updateDraft("hook", event.target.value)
                      }
                      rows={3}
                      className="w-full resize-none border-0 bg-transparent p-0 text-lg font-semibold outline-none"
                    />
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <label
                      className="mb-2 block text-xs font-medium uppercase tracking-wider text-foreground/45"
                      htmlFor="generated-body"
                    >
                      Body
                    </label>
                    <textarea
                      id="generated-body"
                      value={generatedScript.body}
                      onChange={event =>
                        updateDraft("body", event.target.value)
                      }
                      rows={10}
                      className="w-full resize-y border-0 bg-transparent p-0 text-sm leading-relaxed outline-none"
                    />
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <label
                      className="mb-2 block text-xs font-medium uppercase tracking-wider text-foreground/45"
                      htmlFor="generated-cta"
                    >
                      Call to action
                    </label>
                    <textarea
                      id="generated-cta"
                      value={generatedScript.cta}
                      onChange={event => updateDraft("cta", event.target.value)}
                      rows={2}
                      className="w-full resize-none border-0 bg-transparent p-0 text-sm font-medium outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void saveEdits()}
                  disabled={saveState === "saving" || saving}
                  className="mt-4 w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                >
                  {saveState === "saving" || saving
                    ? "Saving edits"
                    : "Save edits"}
                </button>
              </motion.section>
            ) : (
              <motion.section
                key="empty-script"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex min-h-[380px] flex-col items-center justify-center rounded-xl border border-border bg-surface p-12 text-center"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Sparkles className="h-8 w-8 text-primary/45" />
                </div>
                <h2 className="text-lg font-medium text-foreground/65">
                  Direct the opening. Generate the draft.
                </h2>
                <p className="mt-2 max-w-sm text-sm text-foreground/45">
                  The result stays editable and is stored in your content
                  workspace, ready for the editor or Prompt Director.
                </p>
              </motion.section>
            )}
          </AnimatePresence>

          {workspace.scripts.length > 0 ? (
            <section className="rounded-xl border border-border bg-surface p-5">
              <div className="mb-3 flex items-center gap-2">
                <Library className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-medium">Recent drafts</h2>
              </div>
              <div className="space-y-2">
                {workspace.scripts.slice(0, 4).map(script => (
                  <button
                    type="button"
                    key={script.id}
                    onClick={() => {
                      setGeneratedScript(script);
                      setSaveState("saved");
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-primary/40"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-foreground/35" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {script.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-foreground/40">
                        {script.platform} · {script.duration}s
                      </span>
                    </span>
                    <Clock3 className="h-3.5 w-3.5 text-foreground/30" />
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ScriptGenerator() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeMode =
    searchParams.get("mode") === "interview" ? "interview" : "generator";

  const selectMode = (mode: "generator" | "interview") => {
    const next = new URLSearchParams(searchParams);
    if (mode === "interview") next.set("mode", "interview");
    else next.delete("mode");
    setSearchParams(next, { replace: true });
  };

  return (
    <div>
      <div
        className="mx-auto mb-8 flex max-w-6xl rounded-xl border border-border bg-surface p-1.5"
        role="tablist"
        aria-label="Script creation mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeMode === "generator"}
          onClick={() => selectMode("generator")}
          className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
            activeMode === "generator"
              ? "bg-primary text-white shadow-sm"
              : "text-foreground/55 hover:bg-background hover:text-foreground"
          }`}
        >
          Write from a brief
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeMode === "interview"}
          onClick={() => selectMode("interview")}
          className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
            activeMode === "interview"
              ? "bg-primary text-white shadow-sm"
              : "text-foreground/55 hover:bg-background hover:text-foreground"
          }`}
        >
          Interview me
        </button>
      </div>

      {activeMode === "interview" ? (
        <InterviewMe embedded />
      ) : (
        <DirectScriptGenerator />
      )}
    </div>
  );
}
