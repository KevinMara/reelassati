import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Check,
  Clock3,
  Copy,
  Download,
  Film,
  Image as ImageIcon,
  Loader2,
  MonitorUp,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  WandSparkles,
} from "lucide-react";
import type {
  Asset,
  GenerationJob,
  WorkspaceEvent,
} from "@contracts/workspace";
import { platformApi } from "@/lib/platform-api";
import {
  getTemplateById,
  VIDEO_PROMPT_TEMPLATES,
} from "@/lib/videoPromptTemplates";
import { useWorkspace } from "@/providers/workspace";
import { AiProvenanceBadge } from "@/components/compliance/AiProvenanceBadge";
import { writeClipboardText } from "@/lib/clipboard";
import posthog from "@/lib/posthog";

const RATIOS = [
  { id: "9:16" as const, name: "9:16", description: "Reels, TikTok, Shorts" },
  { id: "16:9" as const, name: "16:9", description: "Landscape video" },
  { id: "1:1" as const, name: "1:1", description: "Square feed" },
];

const DURATIONS = Array.from({ length: 13 }, (_, index) => index + 3);
const PUBLIC_STARTING_RATE_USD = 0.126;
const DURATION_PATTERN = /\b(\d{1,2})\s*(?:seconds?|secs?|s)\b/gi;

interface PromptDirection {
  subject: string;
  action: string;
  location: string;
  camera: string;
  mood: string;
  dialogue: string;
  sound: string;
  avoid: string;
}

const EMPTY_DIRECTION: PromptDirection = {
  subject: "",
  action: "",
  location: "",
  camera: "",
  mood: "",
  dialogue: "",
  sound: "",
  avoid: "",
};

function validatePublicHttpsUrl(value: string): string | null {
  if (!value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    const hostname = parsed.hostname.toLowerCase();
    const privateIpv4 =
      /^10\./.test(hostname) ||
      /^127\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
    if (parsed.protocol !== "https:") {
      return "Reference frames must use HTTPS.";
    }
    if (
      privateIpv4 ||
      hostname === "localhost" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.endsWith(".local") ||
      parsed.username ||
      parsed.password
    ) {
      return "Use a public HTTPS image URL, not a local or private address.";
    }
    return null;
  } catch {
    return "Enter a valid public HTTPS image URL.";
  }
}

function buildScene(direction: PromptDirection) {
  return [
    direction.subject ? `Subject: ${direction.subject.trim()}.` : "",
    direction.action ? `Action: ${direction.action.trim()}.` : "",
    direction.location ? `Location: ${direction.location.trim()}.` : "",
    direction.camera ? `Camera direction: ${direction.camera.trim()}.` : "",
    direction.mood ? `Mood and lighting: ${direction.mood.trim()}.` : "",
    direction.dialogue
      ? `Spoken dialogue: "${direction.dialogue.trim()}".`
      : "",
    direction.sound ? `Sound direction: ${direction.sound.trim()}.` : "",
    direction.avoid ? `Avoid: ${direction.avoid.trim()}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function upsertJob(jobs: GenerationJob[], job: GenerationJob) {
  return [job, ...jobs.filter(candidate => candidate.id !== job.id)];
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

export default function VideoGenerator() {
  const { workspace, capabilities, loading, updateWorkspace } = useWorkspace();
  const [searchParams] = useSearchParams();
  const requestedTemplate = getTemplateById(
    searchParams.get("template")?.trim() ?? ""
  );
  const initialTemplate = requestedTemplate ?? VIDEO_PROMPT_TEMPLATES[0];
  const initialSubject =
    searchParams.get("subject")?.trim().slice(0, 1200) ?? "";
  const [selectedTemplate, setSelectedTemplate] = useState(
    initialTemplate?.id ?? ""
  );
  const [direction, setDirection] = useState<PromptDirection>(() => ({
    ...EMPTY_DIRECTION,
    subject: initialSubject,
  }));
  const [ratio, setRatio] = useState<"16:9" | "9:16" | "1:1">(
    initialTemplate?.defaultRatio ?? "9:16"
  );
  const [duration, setDuration] = useState(
    initialTemplate?.defaultDuration ?? 5
  );
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [generateAudio, setGenerateAudio] = useState(true);
  const [firstFrameUrl, setFirstFrameUrl] = useState("");
  const [lastFrameUrl, setLastFrameUrl] = useState("");
  const [showReferences, setShowReferences] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [referenceContainsRealPerson, setReferenceContainsRealPerson] =
    useState(false);
  const [realPersonConsentConfirmed, setRealPersonConsentConfirmed] =
    useState(false);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [resultAsset, setResultAsset] = useState<Asset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const template = getTemplateById(selectedTemplate);
  const scene = useMemo(() => buildScene(direction), [direction]);
  const enhancedPrompt = useMemo(() => {
    if (!scene) return "";
    const styled =
      template?.buildPrompt(scene, {
        characterDesc: direction.subject || undefined,
        location: direction.location || undefined,
        cameraStyle: direction.camera || undefined,
        dialogue: direction.dialogue || undefined,
        mood: direction.mood || undefined,
      }) ?? scene;
    return `${styled} Deliver one coherent ${duration}-second video in ${ratio}.`;
  }, [
    direction.camera,
    direction.dialogue,
    direction.location,
    direction.mood,
    direction.subject,
    duration,
    ratio,
    scene,
    template,
  ]);

  const mentionedDurations = useMemo(() => {
    const values = new Set<number>();
    const userText = Object.values(direction).join(" ");
    for (const match of userText.matchAll(DURATION_PATTERN)) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) values.add(parsed);
    }
    return Array.from(values);
  }, [direction]);

  const durationConflict = mentionedDurations.some(
    mentioned => mentioned !== duration
  );
  const firstFrameError = validatePublicHttpsUrl(firstFrameUrl);
  const lastFrameError = validatePublicHttpsUrl(lastFrameUrl);
  const videoReady = capabilities.videoGeneration;
  const videoMissing = capabilities.missing.filter(item =>
    item.includes("OPENROUTER")
  );
  const estimatedCost = duration * PUBLIC_STARTING_RATE_USD;

  useEffect(() => {
    if (loading || activeJobId || job) return;
    const resumable = workspace.jobs.find(
      candidate =>
        candidate.type === "video" &&
        (candidate.status === "pending" || candidate.status === "in_progress")
    );
    if (!resumable) return;
    const timer = window.setTimeout(() => {
      setJob(resumable);
      setActiveJobId(resumable.id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeJobId, job, loading, workspace.jobs]);

  useEffect(() => {
    if (!activeJobId) return;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const result = await platformApi.videoJob(activeJobId);
        if (cancelled) return;
        setJob(result.job);

        if (
          result.job.status === "completed" ||
          result.job.status === "failed"
        ) {
          setActiveJobId(null);
          if (result.asset) setResultAsset(result.asset);
          await updateWorkspace(current => ({
            ...current,
            jobs: upsertJob(current.jobs, result.job),
            assets: result.asset
              ? [
                  result.asset,
                  ...current.assets.filter(
                    candidate => candidate.id !== result.asset?.id
                  ),
                ]
              : current.assets,
            activity: [
              createEvent(
                "generation",
                result.job.status === "completed"
                  ? "Video generated"
                  : "Video generation failed",
                result.asset?.name ??
                  result.job.error ??
                  template?.name ??
                  "Video generation"
              ),
              ...current.activity,
            ].slice(0, 100),
          }));
          return;
        }

        timer = window.setTimeout(() => void poll(), 15_000);
      } catch (cause) {
        if (cancelled) return;
        setActiveJobId(null);
        setError(
          cause instanceof Error
            ? cause.message
            : "The video job status could not be checked."
        );
      }
    };

    timer = window.setTimeout(() => void poll(), 4_000);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [activeJobId, template?.name, updateWorkspace]);

  const invalidateRightsAttestations = () => {
    setRightsConfirmed(false);
    setRealPersonConsentConfirmed(false);
    requestIdRef.current = null;
  };

  const updateDirection = (field: keyof PromptDirection, value: string) => {
    if (direction[field] === value) return;
    setDirection(current => ({ ...current, [field]: value }));
    invalidateRightsAttestations();
  };

  const selectTemplate = (id: string) => {
    if (id === selectedTemplate) return;
    const next = getTemplateById(id);
    setSelectedTemplate(id);
    invalidateRightsAttestations();
    if (next) {
      setRatio(next.defaultRatio);
      setDuration(next.defaultDuration);
    }
  };

  const handleGenerate = async () => {
    if (
      !scene ||
      !videoReady ||
      submitting ||
      firstFrameError ||
      lastFrameError ||
      !rightsConfirmed ||
      (referenceContainsRealPerson && !realPersonConsentConfirmed)
    ) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setJob(null);
    setResultAsset(null);

    try {
      const requestId = requestIdRef.current || crypto.randomUUID();
      requestIdRef.current = requestId;
      const result = await platformApi.createVideo({
        requestId,
        prompt: enhancedPrompt,
        duration,
        aspectRatio: ratio,
        resolution,
        generateAudio,
        firstFrameUrl: firstFrameUrl.trim() || undefined,
        lastFrameUrl: lastFrameUrl.trim() || undefined,
        projectId: workspace.projects[0]?.id,
        rightsConfirmed,
        referenceContainsRealPerson,
        realPersonConsentConfirmed,
      });
      setJob(result.job);
      setActiveJobId(result.job.id);
      requestIdRef.current = null;
      posthog?.capture("video_generation_started", {
        template_id: selectedTemplate || "custom",
        aspect_ratio: ratio,
        duration_seconds: duration,
        resolution,
        generate_audio: generateAudio,
        has_reference_frames: Boolean(firstFrameUrl.trim() || lastFrameUrl.trim()),
      });
      await updateWorkspace(current => ({
        ...current,
        jobs: upsertJob(current.jobs, result.job),
        activity: [
          createEvent(
            "generation",
            "Video generation started",
            `${template?.name ?? "Custom style"} · ${duration}s · ${ratio}`
          ),
          ...current.activity,
        ].slice(0, 100),
      }));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Video generation could not start."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const copyPrompt = async () => {
    if (!enhancedPrompt) return;
    try {
      await writeClipboardText(enhancedPrompt);
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 1800);
    } catch {
      setError(
        "Clipboard access is blocked. Select the prompt preview and copy it manually."
      );
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <p className="mono-eyebrow mb-2 text-primary">AI Video Studio</p>
        <h1 className="text-3xl font-semibold">Prompt Director</h1>
        <p className="mt-2 max-w-3xl text-foreground/60">
          Turn a loose idea into a production-ready Kling prompt, then follow
          the real generation job from request to saved asset.
        </p>
      </div>

      {!loading && !videoReady ? (
        <div
          className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4"
          role="status"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-medium">
              Video generation is not configured
            </p>
            <p className="mt-1 text-xs leading-relaxed text-foreground/55">
              Add the server-side video provider credential to enable
              generation. Prompt design remains available while setup is
              incomplete.
            </p>
            {videoMissing.length > 0 ? (
              <p className="mt-2 font-mono text-[11px] text-amber-600 dark:text-amber-400">
                Missing: {videoMissing.join(", ")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.35fr)_minmax(290px,0.83fr)]">
        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-center gap-2">
              <Film className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium">Visual style</h2>
              <span className="ml-auto text-[10px] uppercase tracking-wider text-foreground/35">
                {VIDEO_PROMPT_TEMPLATES.length} templates
              </span>
            </div>
            <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
              {VIDEO_PROMPT_TEMPLATES.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTemplate(item.id)}
                  aria-pressed={selectedTemplate === item.id}
                  className={`w-full rounded-lg border p-3 text-left transition-all ${
                    selectedTemplate === item.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-primary/35"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[9px] uppercase tracking-wider text-foreground/45">
                      {item.category}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-foreground/45">
                    {item.description}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium">Output controls</h2>
            </div>

            <fieldset>
              <legend className="mb-2 text-xs font-medium text-foreground/55">
                Aspect ratio
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {RATIOS.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.id === ratio) return;
                      setRatio(item.id);
                      invalidateRightsAttestations();
                    }}
                    aria-pressed={ratio === item.id}
                    title={item.description}
                    className={`rounded-lg border px-2 py-2.5 text-center transition-colors ${
                      ratio === item.id
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-background hover:border-primary/35"
                    }`}
                  >
                    <span className="block text-sm font-medium">
                      {item.name}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-4">
              <label
                className="mb-2 block text-xs font-medium text-foreground/55"
                htmlFor="video-duration"
              >
                Duration
              </label>
              <select
                id="video-duration"
                value={duration}
                onChange={event => {
                  const nextDuration = Number(event.target.value);
                  if (nextDuration === duration) return;
                  setDuration(nextDuration);
                  invalidateRightsAttestations();
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              >
                {DURATIONS.map(seconds => (
                  <option key={seconds} value={seconds}>
                    {seconds} seconds
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {(["720p", "1080p"] as const).map(value => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setResolution(value)}
                  aria-pressed={resolution === value}
                  className={`rounded-lg border py-2 text-xs font-medium ${
                    resolution === value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-background"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>

            <button
              type="button"
              aria-pressed={generateAudio}
              onClick={() => {
                setGenerateAudio(current => !current);
                invalidateRightsAttestations();
              }}
              className="mt-4 flex w-full items-center gap-3 rounded-lg border border-border bg-background p-3 text-left"
            >
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  generateAudio ? "bg-primary" : "bg-foreground/20"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    generateAudio ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </span>
              <span>
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Volume2 className="h-3.5 w-3.5" />
                  Native audio
                </span>
                <span className="mt-0.5 block text-[11px] text-foreground/40">
                  {generateAudio
                    ? "Requested with the video"
                    : "Silent output requested"}
                </span>
              </span>
            </button>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-surface p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Scene direction</p>
                <p className="mt-1 text-xs text-foreground/45">
                  Be concrete. The selected style adds camera and production
                  language.
                </p>
              </div>
              <WandSparkles className="h-5 w-5 text-primary" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  className="mb-2 block text-xs font-medium"
                  htmlFor="director-subject"
                >
                  Subject
                </label>
                <input
                  id="director-subject"
                  value={direction.subject}
                  onChange={event =>
                    updateDirection("subject", event.target.value)
                  }
                  placeholder="A ceramic artist in her late twenties"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label
                  className="mb-2 block text-xs font-medium"
                  htmlFor="director-action"
                >
                  Action
                </label>
                <input
                  id="director-action"
                  value={direction.action}
                  onChange={event =>
                    updateDirection("action", event.target.value)
                  }
                  placeholder="Glazes a finished cup, then reveals it"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label
                  className="mb-2 block text-xs font-medium"
                  htmlFor="director-location"
                >
                  Location
                </label>
                <input
                  id="director-location"
                  value={direction.location}
                  onChange={event =>
                    updateDirection("location", event.target.value)
                  }
                  placeholder="A sunlit working studio"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label
                  className="mb-2 block text-xs font-medium"
                  htmlFor="director-camera"
                >
                  Camera movement
                </label>
                <input
                  id="director-camera"
                  value={direction.camera}
                  onChange={event =>
                    updateDirection("camera", event.target.value)
                  }
                  placeholder="Slow push-in, then a macro detail"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label
                  className="mb-2 block text-xs font-medium"
                  htmlFor="director-mood"
                >
                  Mood and light
                </label>
                <input
                  id="director-mood"
                  value={direction.mood}
                  onChange={event =>
                    updateDirection("mood", event.target.value)
                  }
                  placeholder="Warm morning light, tactile and calm"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label
                  className="mb-2 block text-xs font-medium"
                  htmlFor="director-dialogue"
                >
                  Dialogue
                </label>
                <input
                  id="director-dialogue"
                  value={direction.dialogue}
                  onChange={event =>
                    updateDirection("dialogue", event.target.value)
                  }
                  placeholder="The detail that makes every cup different."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label
                  className="mb-2 block text-xs font-medium"
                  htmlFor="director-sound"
                >
                  Sound
                </label>
                <input
                  id="director-sound"
                  value={direction.sound}
                  onChange={event =>
                    updateDirection("sound", event.target.value)
                  }
                  placeholder="Brush on clay, room tone, no music"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label
                  className="mb-2 block text-xs font-medium"
                  htmlFor="director-avoid"
                >
                  Avoid
                </label>
                <input
                  id="director-avoid"
                  value={direction.avoid}
                  onChange={event =>
                    updateDirection("avoid", event.target.value)
                  }
                  placeholder="Extra fingers, warped cup, logos"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            {durationConflict ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p>
                  Your direction mentions {mentionedDurations.join(", ")}{" "}
                  seconds, but output is set to {duration} seconds. The output
                  control is sent to the provider; align the wording to avoid
                  contradictory motion.
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setShowReferences(current => !current)}
              aria-expanded={showReferences}
              className="mt-5 flex items-center gap-2 text-xs font-medium text-primary"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              {showReferences
                ? "Hide reference frames"
                : "Add reference frames"}
            </button>

            {showReferences ? (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    className="mb-2 block text-xs font-medium"
                    htmlFor="first-frame-url"
                  >
                    First frame URL
                  </label>
                  <input
                    id="first-frame-url"
                    type="url"
                    inputMode="url"
                    value={firstFrameUrl}
                    onChange={event => {
                      if (event.target.value === firstFrameUrl) return;
                      setFirstFrameUrl(event.target.value);
                      invalidateRightsAttestations();
                    }}
                    placeholder="https://cdn.example.com/frame.jpg"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  />
                  {firstFrameError ? (
                    <p className="mt-1 text-[11px] text-red-500">
                      {firstFrameError}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label
                    className="mb-2 block text-xs font-medium"
                    htmlFor="last-frame-url"
                  >
                    Last frame URL
                  </label>
                  <input
                    id="last-frame-url"
                    type="url"
                    inputMode="url"
                    value={lastFrameUrl}
                    onChange={event => {
                      if (event.target.value === lastFrameUrl) return;
                      setLastFrameUrl(event.target.value);
                      invalidateRightsAttestations();
                    }}
                    placeholder="https://cdn.example.com/frame.jpg"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  />
                  {lastFrameError ? (
                    <p className="mt-1 text-[11px] text-red-500">
                      {lastFrameError}
                    </p>
                  ) : null}
                </div>
                <p className="sm:col-span-2 text-[11px] text-foreground/40">
                  Only public HTTPS image URLs are accepted. Browser blob URLs
                  and local network addresses cannot be reached by the video
                  provider.
                </p>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Compiled prompt</p>
                <p className="mt-0.5 text-[11px] text-foreground/40">
                  {template?.name ?? "Custom"} · provider-ready
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyPrompt()}
                disabled={!enhancedPrompt}
                className="rounded-lg p-2 hover:bg-background disabled:opacity-35"
                aria-label="Copy compiled prompt"
              >
                {promptCopied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="max-h-44 overflow-y-auto rounded-lg border border-border bg-background p-4">
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/65">
                {enhancedPrompt ||
                  "Complete the subject and action fields to compile the final prompt."}
              </p>
            </div>
            {template?.finishingNote ? (
              <p className="mt-3 rounded-lg border border-primary/15 bg-primary/5 p-3 text-[11px] leading-relaxed text-foreground/55">
                Finishing workflow: {template.finishingNote}
              </p>
            ) : null}
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-foreground/45">
                  Cost estimate
                </p>
                <p className="mt-1 text-3xl font-semibold text-primary">
                  from ${estimatedCost.toFixed(2)}
                </p>
              </div>
              <Clock3 className="h-5 w-5 text-primary/60" />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-foreground/45">
              Estimate uses the public starting rate of $
              {PUBLIC_STARTING_RATE_USD.toFixed(3)} per second. The provider
              invoice is authoritative and can vary by output settings.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-primary/10 bg-background/70 p-2.5">
                <span className="block text-foreground/40">Output</span>
                <span className="mt-1 block font-medium">
                  {duration}s · {resolution}
                </span>
              </div>
              <div className="rounded-lg border border-primary/10 bg-background/70 p-2.5">
                <span className="block text-foreground/40">Format</span>
                <span className="mt-1 block font-medium">
                  {ratio} · {generateAudio ? "audio" : "silent"}
                </span>
              </div>
            </div>
            <div className="mt-4 space-y-2 rounded-lg border border-primary/15 bg-background/70 p-3 text-xs leading-relaxed">
              <label className="flex items-start gap-2 text-foreground/65">
                <input
                  type="checkbox"
                  checked={rightsConfirmed}
                  onChange={event => setRightsConfirmed(event.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  I may use the prompt, brands, references, faces and voices in
                  this generation.
                </span>
              </label>
              <label className="flex items-start gap-2 text-foreground/65">
                <input
                  type="checkbox"
                  checked={referenceContainsRealPerson}
                  onChange={event => {
                    setReferenceContainsRealPerson(event.target.checked);
                    invalidateRightsAttestations();
                  }}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  The prompt or a reference depicts an identifiable real person
                  or imitates their voice.
                </span>
              </label>
              {referenceContainsRealPerson ? (
                <label className="flex items-start gap-2 text-foreground/65">
                  <input
                    type="checkbox"
                    checked={realPersonConsentConfirmed}
                    onChange={event =>
                      setRealPersonConsentConfirmed(event.target.checked)
                    }
                    className="mt-0.5 accent-primary"
                  />
                  <span>
                    I hold documented consent or another verified legal basis.
                  </span>
                </label>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={
                !scene ||
                !videoReady ||
                submitting ||
                Boolean(activeJobId) ||
                Boolean(firstFrameError) ||
                Boolean(lastFrameError) ||
                !rightsConfirmed ||
                (referenceContainsRealPerson && !realPersonConsentConfirmed)
              }
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting job
                </>
              ) : activeJobId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generation in progress
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate video
                </>
              )}
            </button>
          </section>

          {job ? (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-surface p-5"
              aria-live="polite"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Generation job</p>
                  <p className="mt-1 font-mono text-[10px] text-foreground/35">
                    {job.id}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${
                    job.status === "completed"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : job.status === "failed"
                        ? "bg-red-500/10 text-red-500"
                        : "bg-primary/10 text-primary"
                  }`}
                >
                  {job.status.replace("_", " ")}
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-background">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${
                    job.status === "failed" ? "bg-red-500" : "bg-primary"
                  }`}
                  style={{
                    width: `${Math.max(4, Math.min(100, job.progress))}%`,
                  }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-foreground/40">
                <span>Provider status</span>
                <span>{Math.round(job.progress)}%</span>
              </div>
              {job.error ? (
                <p className="mt-3 text-xs text-red-500">{job.error}</p>
              ) : null}
            </motion.section>
          ) : (
            <section className="rounded-xl border border-border bg-surface p-5">
              <MonitorUp className="h-6 w-6 text-primary/45" />
              <p className="mt-3 text-sm font-medium">Real job tracking</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground/45">
                After submission, this panel polls the provider-backed job and
                shows its returned progress. No simulated completion state.
              </p>
            </section>
          )}

          {resultAsset ? (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Generated asset</p>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase text-emerald-500">
                  Saved
                </span>
              </div>
              <AiProvenanceBadge provenance={resultAsset.provenance} />
              <div
                className={`overflow-hidden rounded-lg bg-black ${
                  ratio === "9:16"
                    ? "aspect-[9/16]"
                    : ratio === "1:1"
                      ? "aspect-square"
                      : "aspect-video"
                }`}
              >
                <video
                  src={resultAsset.url}
                  controls
                  preload="metadata"
                  aria-label={`Generated video preview: ${resultAsset.name}`}
                  aria-describedby="generated-video-caption-status"
                  className="h-full w-full object-contain"
                />
              </div>
              <p
                id="generated-video-caption-status"
                className="mt-2 text-[11px] leading-relaxed text-foreground/45"
              >
                Caption track not added yet. Open the asset in Edit to create
                and review captions before delivery.
              </p>
              <a
                href={resultAsset.url}
                download={resultAsset.name}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-2.5 text-sm font-medium transition-colors hover:border-primary/45"
              >
                <Download className="h-4 w-4" />
                Download video
              </a>
            </motion.section>
          ) : null}

          {error ? (
            <div
              className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-500"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
