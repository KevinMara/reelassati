import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Beaker,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  Eye,
  FileText,
  FlaskConical,
  Heart,
  MessageCircle,
  Play,
  Plus,
  RefreshCw,
  Scissors,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import type { Platform, ScriptDraft } from "@contracts/workspace";
import type {
  TrendEvidenceItem,
  TrendFeedResponse,
  TrendContentType,
  TrendLifecycle,
  TrendObjective,
  TrendPlatform,
  TrendScope,
} from "@contracts/trends";
import { customTrendResearchCreditCost } from "@contracts/pricing";
import { platformApi } from "@/lib/platform-api";
import { useWorkspace } from "@/providers/workspace";

const HYPOTHESIS_TONE = "format-hypothesis";

const PLATFORMS: Array<{ value: Platform; label: string }> = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube Shorts" },
  { value: "twitter", label: "X / Twitter" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "pinterest", label: "Pinterest" },
  { value: "threads", label: "Threads" },
];

const TREND_RESEARCH_PLATFORM_OPTIONS: Array<{
  value: "all" | TrendPlatform;
  label: string;
}> = [
  { value: "all", label: "TikTok + Instagram Reels" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram Reels" },
  { value: "youtube", label: "YouTube Shorts" },
];

const TREND_FILTER_PLATFORM_OPTIONS = TREND_RESEARCH_PLATFORM_OPTIONS.map(
  option =>
    option.value === "all"
      ? { ...option, label: "All short-form sources" }
      : option
);

const CONTENT_TYPE_OPTIONS: Array<{
  value: TrendContentType;
  label: string;
}> = [
  { value: "overall", label: "All short-form styles" },
  { value: "creator-led", label: "Creator-led" },
  { value: "product-demo", label: "Product / demo" },
  { value: "educational", label: "Educational" },
  { value: "faceless", label: "Faceless" },
  { value: "ugc", label: "UGC" },
  { value: "storytelling", label: "Storytelling" },
];

const OBJECTIVE_OPTIONS: Array<{ value: TrendObjective; label: string }> = [
  { value: "overall", label: "Overall performance" },
  { value: "reach", label: "Reach" },
  { value: "engagement", label: "Engagement" },
  { value: "retention", label: "Retention" },
  { value: "conversion", label: "Conversion" },
];

const LIFECYCLE_LABELS: Record<TrendLifecycle, string> = {
  seed: "Seed",
  emerging: "Emerging",
  breakout: "Breakout",
  mainstream: "Mainstream",
  saturated: "Saturated",
  decaying: "Decaying",
};

const LIFECYCLE_STYLES: Record<TrendLifecycle, string> = {
  seed: "border-sky-400/25 bg-sky-400/10 text-sky-400",
  emerging: "border-emerald-400/25 bg-emerald-400/10 text-emerald-400",
  breakout: "border-primary/30 bg-primary/10 text-primary",
  mainstream: "border-amber-400/25 bg-amber-400/10 text-amber-400",
  saturated: "border-orange-400/25 bg-orange-400/10 text-orange-400",
  decaying: "border-foreground/15 bg-foreground/5 text-foreground/45",
};

function createId() {
  return `hypothesis_${
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }`;
}

function compactNumber(value: number | null): string | null {
  if (value === null) return null;
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function relativeTime(value: string | null): string {
  if (!value) return "Date unavailable";
  const difference = Date.now() - Date.parse(value);
  if (!Number.isFinite(difference)) return "Date unavailable";
  const days = Math.max(0, Math.floor(difference / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(value).toLocaleDateString();
}

function platformLabel(platform: TrendPlatform): string {
  if (platform === "youtube") return "YouTube Shorts";
  if (platform === "instagram") return "Instagram Reels";
  return "TikTok";
}

function videoEmbedUrl(trend: TrendEvidenceItem): string | null {
  try {
    const url = new URL(trend.sourceUrl);
    if (trend.platform === "youtube") {
      const id = url.hostname.endsWith("youtu.be")
        ? url.pathname.split("/").filter(Boolean)[0]
        : url.pathname.match(/^\/shorts\/([A-Za-z0-9_-]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (trend.platform === "instagram") {
      const code = url.pathname.match(/^\/reel\/([A-Za-z0-9_-]+)/)?.[1];
      return code ? `https://www.instagram.com/reel/${code}/embed/` : null;
    }
    const id = url.pathname.match(/\/video\/(\d+)/)?.[1];
    return id
      ? `https://www.tiktok.com/player/v1/${id}?autoplay=0&loop=0&music_info=1&description=1`
      : null;
  } catch {
    return null;
  }
}

function TrendVideo({ trend }: { trend: TrendEvidenceItem }) {
  const embedUrl = videoEmbedUrl(trend);
  if (embedUrl) {
    return (
      <div className="aspect-[9/12] overflow-hidden bg-black">
        <iframe
          src={embedUrl}
          title={`${trend.title} on ${platformLabel(trend.platform)}`}
          loading="lazy"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>
    );
  }
  return (
    <a
      href={trend.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className="group relative flex aspect-[9/12] items-center justify-center overflow-hidden bg-background"
    >
      {trend.thumbnailUrl ? (
        <img
          src={trend.thumbnailUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-75 transition group-hover:scale-[1.02]"
        />
      ) : null}
      <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur">
        <Play className="ml-1 h-5 w-5" />
      </span>
    </a>
  );
}

function Metric({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: number | null;
  label: string;
}) {
  const formatted = compactNumber(value);
  if (!formatted) return null;
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      {icon}
      {formatted}
    </span>
  );
}

export default function TrendsPage() {
  const { workspace, updateWorkspace, saving } = useWorkspace();
  const [weeklyFeed, setWeeklyFeed] = useState<TrendFeedResponse | null>(null);
  const [customFeed, setCustomFeed] = useState<TrendFeedResponse | null>(null);
  const [activeFeedKind, setActiveFeedKind] = useState<"weekly" | "custom">(
    "weekly"
  );
  const [feedLoading, setFeedLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [researchPlatform, setResearchPlatform] = useState<
    "all" | TrendPlatform
  >("all");
  const [contentType, setContentType] = useState<TrendContentType>("overall");
  const [objective, setObjective] = useState<TrendObjective>("overall");
  const [region, setRegion] = useState("Global");
  const [researchLanguage, setResearchLanguage] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"all" | TrendPlatform>(
    "all"
  );
  const [lifecycleFilter, setLifecycleFilter] = useState<
    "all" | TrendLifecycle
  >("all");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [hook, setHook] = useState("");
  const [evidence, setEvidence] = useState("");
  const [successSignal, setSuccessSignal] = useState("");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [duration, setDuration] = useState(30);
  const [filter, setFilter] = useState<"all" | Platform>("all");
  const [notice, setNotice] = useState<string | null>(null);

  const loadWeeklyFeed = async () => {
    setFeedLoading(true);
    setWeeklyError(null);
    try {
      setWeeklyFeed(await platformApi.trendFeed());
    } catch (cause) {
      setWeeklyError(
        cause instanceof Error
          ? cause.message
          : "The weekly trend update could not be loaded."
      );
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    platformApi
      .trendFeed()
      .then(result => {
        if (!active) return;
        setWeeklyFeed(result);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setWeeklyError(
          cause instanceof Error
            ? cause.message
            : "The weekly trend update could not be loaded."
        );
      })
      .finally(() => {
        if (active) setFeedLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeFeed =
    activeFeedKind === "custom" && customFeed ? customFeed : weeklyFeed;
  const availableCredits =
    customFeed?.availableCredits ?? weeklyFeed?.availableCredits;
  const researchCreditCost = customTrendResearchCreditCost(researchPlatform);

  const visibleTrends = useMemo(
    () =>
      (activeFeed?.trends || []).filter(
        trend =>
          (platformFilter === "all" || trend.platform === platformFilter) &&
          (lifecycleFilter === "all" || trend.lifecycle === lifecycleFilter)
      ),
    [activeFeed?.trends, lifecycleFilter, platformFilter]
  );

  const hypotheses = useMemo(
    () =>
      workspace.scripts
        .filter(script => script.tone === HYPOTHESIS_TONE)
        .filter(script => filter === "all" || script.platform === filter)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [filter, workspace.scripts]
  );

  const sourceMaterials = useMemo(() => {
    const scripts = workspace.scripts
      .filter(script => script.tone !== HYPOTHESIS_TONE)
      .map(script => ({
        id: `script-${script.id}`,
        type: "Script",
        title: script.title,
        platform: script.platform,
        hook: script.hook,
        evidence: `Workspace script created ${new Date(
          script.createdAt
        ).toLocaleDateString()}.`,
      }));
    const projects = workspace.projects.map(project => ({
      id: `project-${project.id}`,
      type: "Edit project",
      title: project.title,
      platform: project.platform,
      hook: project.transcript[0]?.text || "",
      evidence: `Workspace project using the “${project.template}” format; current status: ${project.status}.`,
    }));
    return [...projects, ...scripts]
      .sort((left, right) => left.title.localeCompare(right.title))
      .slice(0, 8);
  }, [workspace.projects, workspace.scripts]);

  const resetForm = () => {
    setTitle("");
    setHook("");
    setEvidence("");
    setSuccessSignal("");
    setPlatform("tiktok");
    setDuration(30);
    setShowForm(false);
  };

  const saveHypothesis = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !title.trim() ||
      !hook.trim() ||
      !evidence.trim() ||
      !successSignal.trim()
    ) {
      setNotice(
        "Define the idea, opening, evidence, and pass signal before saving."
      );
      return;
    }
    const now = new Date().toISOString();
    const hypothesis: ScriptDraft = {
      id: createId(),
      title: title.trim(),
      hook: hook.trim(),
      body: evidence.trim(),
      cta: successSignal.trim(),
      fullScript: [
        `Format hypothesis: ${title.trim()}`,
        `Opening: ${hook.trim()}`,
        `Evidence: ${evidence.trim()}`,
        `Pass signal: ${successSignal.trim()}`,
      ].join("\n\n"),
      platform,
      tone: HYPOTHESIS_TONE,
      duration,
      language: workspace.profile.contentLanguage,
      createdAt: now,
    };
    try {
      await updateWorkspace(current => ({
        ...current,
        scripts: [hypothesis, ...current.scripts],
        activity: [
          {
            id: `event_${hypothesis.id}`,
            type: "script" as const,
            label: "Format hypothesis saved",
            detail: hypothesis.title,
            createdAt: now,
          },
          ...current.activity,
        ].slice(0, 100),
      }));
      resetForm();
      setNotice("Hypothesis saved to this workspace.");
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "The hypothesis could not be saved."
      );
    }
  };

  const prefillFromSource = (source: (typeof sourceMaterials)[number]) => {
    setTitle(source.title);
    setHook(source.hook);
    setEvidence(source.evidence);
    setPlatform(source.platform);
    setShowForm(true);
    setNotice(null);
  };

  const prefillFromTrend = (trend: TrendEvidenceItem) => {
    setTitle(trend.pattern);
    setHook(trend.hook);
    setEvidence(
      [
        ...trend.evidence,
        `Source: ${trend.sourceUrl}`,
        `AI hypothesis (${Math.round(trend.confidence * 100)}% confidence): ${trend.hypothesis}`,
      ].join("\n")
    );
    setSuccessSignal(trend.passSignal);
    setPlatform(trend.platform);
    setShowForm(true);
    setNotice(
      "Evidence copied into a testable hypothesis. Review before saving."
    );
    window.requestAnimationFrame(() =>
      document
        .getElementById("trend-hypothesis-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  const deleteHypothesis = async (hypothesis: ScriptDraft) => {
    if (!window.confirm(`Delete the hypothesis “${hypothesis.title}”?`)) return;
    setNotice(null);
    try {
      await updateWorkspace(current => ({
        ...current,
        scripts: current.scripts.filter(script => script.id !== hypothesis.id),
      }));
      setNotice("Hypothesis deleted.");
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "The hypothesis could not be deleted."
      );
    }
  };

  const runResearch = async (event: FormEvent) => {
    event.preventDefault();
    const scope: TrendScope = {
      query: query.trim() || "hyperviral organic brand promotion",
      platform: researchPlatform,
      contentType,
      objective,
      region: region.trim() || "Global",
      language:
        researchLanguage.trim() || workspace.profile.contentLanguage || "en",
    };
    setResearching(true);
    setResearchError(null);
    try {
      const result = await platformApi.researchTrends(scope);
      setCustomFeed(result);
      setActiveFeedKind("custom");
      setPlatformFilter("all");
      setLifecycleFilter("all");
    } catch (cause) {
      setResearchError(
        cause instanceof Error
          ? cause.message
          : "The custom trend research could not be completed. No credits were used."
      );
    } finally {
      setResearching(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="mono-eyebrow text-primary">
              Weekly viral intelligence
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Source-linked videos
            </span>
          </div>
          <h1 className="text-3xl font-semibold">Trends</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground/55">
            Every weekly pick is a recent, hyperviral organic brand-promotion
            short from TikTok or Instagram Reels—not a paid ad or a generic
            trend idea. Watch the source or research your exact brief.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm(current => !current);
            setNotice(null);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Close" : "New hypothesis"}
        </button>
      </div>

      <button
        type="button"
        aria-expanded={showResearch}
        aria-controls="custom-trend-research"
        onClick={() => {
          setShowResearch(current => !current);
          setResearchError(null);
        }}
        className="mb-3 flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 text-left transition-colors hover:border-primary/25"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Search className="h-4 w-4" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-medium">Custom research</span>
          <span className="block text-xs text-foreground/45">
            Find verified viral organic brand shorts for your exact brief · 8–15
            credits
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-foreground/40 transition-transform ${showResearch ? "rotate-180" : ""}`}
        />
      </button>

      {showResearch ? (
        <form
          id="custom-trend-research"
          onSubmit={runResearch}
          className="mb-6 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.09] via-surface to-surface"
        >
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-medium">Custom trend research</h2>
                <span className="rounded-full bg-background px-2 py-1 text-[10px] text-foreground/50">
                  {researchCreditCost} credits when completed
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <label className="text-xs">
                  <span className="mb-1.5 block text-foreground/50">
                    Topic, niche, product, or audience
                  </span>
                  <input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Leave blank for an overall scan"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1.5 block text-foreground/50">
                    Platform
                  </span>
                  <select
                    value={researchPlatform}
                    onChange={event =>
                      setResearchPlatform(
                        event.target.value as "all" | TrendPlatform
                      )
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  >
                    {TREND_RESEARCH_PLATFORM_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  <span className="mb-1.5 block text-foreground/50">
                    Content type
                  </span>
                  <select
                    value={contentType}
                    onChange={event =>
                      setContentType(event.target.value as TrendContentType)
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  >
                    {CONTENT_TYPE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  <span className="mb-1.5 block text-foreground/50">
                    Performance objective
                  </span>
                  <select
                    value={objective}
                    onChange={event =>
                      setObjective(event.target.value as TrendObjective)
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  >
                    {OBJECTIVE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  <span className="mb-1.5 block text-foreground/50">
                    Region
                  </span>
                  <input
                    value={region}
                    onChange={event => setRegion(event.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1.5 block text-foreground/50">
                    Language
                  </span>
                  <input
                    value={
                      researchLanguage ||
                      workspace.profile.contentLanguage ||
                      "en"
                    }
                    onChange={event => setResearchLanguage(event.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
              </div>
            </div>
            <button
              type="submit"
              disabled={researching}
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-wait disabled:opacity-55"
            >
              {researching ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {researching
                ? "Researching sources…"
                : `Research with ${researchCreditCost} credits`}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-background/35 px-5 py-3 text-[11px] text-foreground/45">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              {researchCreditCost} credits are used only after verified results
              succeed.
            </span>
            <span className="font-medium text-foreground/65">
              {availableCredits ?? "—"} credits available
            </span>
          </div>
        </form>
      ) : null}

      {researchError ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-400"
        >
          {researchError}
        </div>
      ) : null}

      {weeklyError ? (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-500"
        >
          <span>{weeklyError}</span>
          <button
            type="button"
            onClick={() => void loadWeeklyFeed()}
            className="inline-flex items-center gap-1.5 font-medium text-foreground/70 hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry weekly update
          </button>
        </div>
      ) : null}

      <section className="mb-12" aria-labelledby="trend-evidence-heading">
        <div className="mb-4 inline-flex rounded-lg border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setActiveFeedKind("weekly")}
            className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${
              activeFeedKind === "weekly"
                ? "bg-primary text-white shadow-sm"
                : "text-foreground/55 hover:text-foreground"
            }`}
          >
            Weekly viral shorts
          </button>
          {customFeed ? (
            <button
              type="button"
              onClick={() => setActiveFeedKind("custom")}
              className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                activeFeedKind === "custom"
                  ? "bg-primary text-white shadow-sm"
                  : "text-foreground/55 hover:text-foreground"
              }`}
            >
              Your latest research
            </button>
          ) : null}
        </div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="mono-eyebrow text-[10px] text-foreground/45">
                Organic brand posts · current-week evidence · no paid ads
              </p>
              {activeFeed ? (
                <span className="rounded-full border border-border bg-surface px-2 py-1 text-[10px] text-foreground/45">
                  {activeFeed.kind === "weekly"
                    ? activeFeed.status === "preparing"
                      ? "Preparing"
                      : "Updated weekly"
                    : "Credit research"}
                </span>
              ) : null}
            </div>
            <h2 id="trend-evidence-heading" className="mt-1 font-medium">
              {activeFeed?.kind === "custom"
                ? `Research for “${activeFeed.scope.query}”`
                : "This week’s hyperviral brand shorts"}
            </h2>
            {activeFeed?.status === "ready" ? (
              <p className="mt-1 text-xs text-foreground/40">
                Updated {new Date(activeFeed.generatedAt).toLocaleString()} ·{" "}
                {activeFeed.cacheNote}
              </p>
            ) : activeFeed?.status === "preparing" ? (
              <p className="mt-1 text-xs text-foreground/40">
                The first weekly format update is being prepared automatically.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={platformFilter}
              onChange={event =>
                setPlatformFilter(event.target.value as "all" | TrendPlatform)
              }
              className="rounded-lg border border-border bg-surface px-3 py-2 text-xs"
              aria-label="Filter trend evidence by platform"
            >
              {TREND_FILTER_PLATFORM_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={lifecycleFilter}
              onChange={event =>
                setLifecycleFilter(event.target.value as "all" | TrendLifecycle)
              }
              className="rounded-lg border border-border bg-surface px-3 py-2 text-xs"
              aria-label="Filter trend evidence by lifecycle"
            >
              <option value="all">All lifecycle stages</option>
              {Object.entries(LIFECYCLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {feedLoading && activeFeedKind === "weekly" ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map(index => (
              <div
                key={index}
                className="overflow-hidden rounded-2xl border border-border bg-surface"
              >
                <div className="aspect-[9/8] animate-pulse bg-foreground/[0.05]" />
                <div className="space-y-3 p-5">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-foreground/[0.06]" />
                  <div className="h-14 animate-pulse rounded bg-foreground/[0.04]" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleTrends.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleTrends.map(trend => (
              <article
                key={trend.id}
                className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition hover:border-primary/25"
              >
                <div className="relative">
                  <TrendVideo trend={trend} />
                  <div className="pointer-events-none absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
                    <span className="rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
                      {platformLabel(trend.platform)}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-medium backdrop-blur ${LIFECYCLE_STYLES[trend.lifecycle]}`}
                    >
                      {LIFECYCLE_LABELS[trend.lifecycle]}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-primary">
                        {trend.creator}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-foreground/40">
                        Organic promotion · {trend.brandName}
                      </p>
                      <h3 className="mt-1 line-clamp-2 text-sm font-medium leading-snug">
                        {trend.title}
                      </h3>
                    </div>
                    <a
                      href={trend.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-lg border border-border p-2 text-foreground/45 hover:border-primary/30 hover:text-primary"
                      aria-label="Open original video"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-foreground/45">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3 w-3" />{" "}
                      {relativeTime(trend.publishedAt)}
                    </span>
                    <Metric
                      icon={<Eye className="h-3 w-3" />}
                      value={trend.metrics.views}
                      label="Views reported by source"
                    />
                    <Metric
                      icon={<Heart className="h-3 w-3" />}
                      value={trend.metrics.likes}
                      label="Likes reported by source"
                    />
                    <Metric
                      icon={<MessageCircle className="h-3 w-3" />}
                      value={trend.metrics.comments}
                      label="Comments reported by source"
                    />
                    <Metric
                      icon={<Share2 className="h-3 w-3" />}
                      value={trend.metrics.shares}
                      label="Shares reported by source"
                    />
                  </div>

                  <div className="mt-4 rounded-xl bg-background p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-400">
                      Observed evidence
                    </p>
                    <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-foreground/60">
                      <li className="flex gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                        <span>{trend.viralityEvidence}</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                        <span>{trend.organicEvidence}</span>
                      </li>
                      {trend.evidence.slice(0, 3).map(item => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3 rounded-xl border border-primary/15 bg-primary/[0.05] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-primary">
                        AI hypothesis
                      </p>
                      <span className="text-[10px] text-foreground/40">
                        {Math.round(trend.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-foreground/65">
                      {trend.hypothesis}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-foreground/45">
                      <span className="font-medium text-foreground/65">
                        Test:
                      </span>{" "}
                      {trend.adaptation}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => prefillFromTrend(trend)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-medium text-white hover:bg-primary-hover"
                  >
                    <FlaskConical className="h-3.5 w-3.5" /> Turn into
                    hypothesis
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
            <Search className="mx-auto h-7 w-7 text-primary" />
            <h3 className="mt-3 text-sm font-medium">
              {activeFeed?.status === "preparing"
                ? "Weekly update in preparation"
                : "No matching evidence"}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-foreground/45">
              {activeFeed?.status === "preparing"
                ? "REELassati updates this feed internally; no action or credits are required from you."
                : "Change the filters or run custom research. REELassati will show fewer results rather than fill the feed with stale, paid, generic, or unverified content."}
            </p>
          </div>
        )}
      </section>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          ["01", "Observe", "Use the exact source and measurable signal."],
          ["02", "Isolate", "Change one creative variable at a time."],
          ["03", "Define", "Choose what would count as a real win."],
          ["04", "Produce", "Build controlled variants in the Studio."],
        ].map(([step, label, detail]) => (
          <div
            key={step}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <p className="font-mono text-[10px] text-primary">{step}</p>
            <p className="mt-2 text-sm font-medium">{label}</p>
            <p className="mt-1 text-xs leading-relaxed text-foreground/45">
              {detail}
            </p>
          </div>
        ))}
      </div>

      {notice ? (
        <div
          role="status"
          className="mb-5 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary"
        >
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      ) : null}

      {showForm ? (
        <form
          id="trend-hypothesis-form"
          onSubmit={saveHypothesis}
          className="mb-8 scroll-mt-6 rounded-xl border border-primary/25 bg-surface p-6"
        >
          <div className="mb-5 flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            <h2 className="font-medium">Define a controlled test</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="mb-1.5 block font-medium">Format idea</span>
              <input
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="Example: Result first, process second"
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1.5 block font-medium">
                Opening line or first frame
              </span>
              <textarea
                value={hook}
                onChange={event => setHook(event.target.value)}
                rows={2}
                placeholder="Write the concrete opening you will test"
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1.5 block font-medium">
                Observed evidence
              </span>
              <textarea
                value={evidence}
                onChange={event => setEvidence(event.target.value)}
                rows={5}
                placeholder="Source, repeated pattern, audience comment, or result you personally observed"
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1.5 block font-medium">Pass signal</span>
              <textarea
                value={successSignal}
                onChange={event => setSuccessSignal(event.target.value)}
                rows={5}
                placeholder="Example: Higher 3-second hold than the current baseline"
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1.5 block font-medium">Platform</span>
              <select
                value={platform}
                onChange={event => setPlatform(event.target.value as Platform)}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5"
              >
                {PLATFORMS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1.5 block font-medium">Target duration</span>
              <select
                value={duration}
                onChange={event => setDuration(Number(event.target.value))}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5"
              >
                {[15, 20, 30, 45, 60].map(seconds => (
                  <option key={seconds} value={seconds}>
                    {seconds} seconds
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white disabled:opacity-45"
            >
              <Beaker className="h-4 w-4" /> Save hypothesis
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mono-eyebrow text-[10px] text-foreground/45">
                Saved experiments
              </p>
              <h2 className="mt-1 font-medium">Format hypotheses</h2>
            </div>
            <select
              value={filter}
              onChange={event =>
                setFilter(event.target.value as "all" | Platform)
              }
              className="rounded-lg border border-border bg-surface px-3 py-2 text-xs"
              aria-label="Filter hypotheses by platform"
            >
              <option value="all">All platforms</option>
              {PLATFORMS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {hypotheses.length ? (
            <div className="space-y-4">
              {hypotheses.map(hypothesis => (
                <article
                  key={hypothesis.id}
                  className="rounded-xl border border-border bg-surface p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-primary">
                        {PLATFORMS.find(
                          option => option.value === hypothesis.platform
                        )?.label || hypothesis.platform}
                      </span>
                      <h3 className="mt-3 font-medium">{hypothesis.title}</h3>
                      <p className="mt-2 text-sm font-medium text-foreground/75">
                        “{hypothesis.hook}”
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteHypothesis(hypothesis)}
                      disabled={saving}
                      className="rounded-md p-2 text-foreground/35 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40"
                      aria-label={`Delete ${hypothesis.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-background p-3">
                      <dt className="text-[10px] uppercase tracking-wide text-foreground/40">
                        Evidence
                      </dt>
                      <dd className="mt-1 whitespace-pre-line text-xs leading-relaxed text-foreground/60">
                        {hypothesis.body}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-background p-3">
                      <dt className="text-[10px] uppercase tracking-wide text-foreground/40">
                        Pass signal
                      </dt>
                      <dd className="mt-1 text-xs leading-relaxed text-foreground/60">
                        {hypothesis.cta}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      to="/dashboard/edit"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary"
                    >
                      <Scissors className="h-3.5 w-3.5" /> Build the variant
                    </Link>
                    <Link
                      to="/dashboard/script"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/55 hover:text-primary"
                    >
                      <FileText className="h-3.5 w-3.5" /> Write the script
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
              <Beaker className="mx-auto h-7 w-7 text-primary" />
              <h3 className="mt-3 text-sm font-medium">No saved hypotheses</h3>
              <p className="mt-1 text-xs text-foreground/45">
                Use a source-linked trend above or add your own observation.
              </p>
            </div>
          )}
        </section>

        <aside>
          <div className="mb-4">
            <p className="mono-eyebrow text-[10px] text-foreground/45">
              Your evidence base
            </p>
            <h2 className="mt-1 font-medium">Workspace source material</h2>
          </div>
          {sourceMaterials.length ? (
            <div className="space-y-3">
              {sourceMaterials.map(source => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => prefillFromSource(source)}
                  className="group w-full rounded-xl border border-border bg-surface p-4 text-left hover:border-primary/35"
                >
                  <span className="text-[10px] uppercase tracking-wide text-foreground/40">
                    {source.type}
                  </span>
                  <span className="mt-1 block text-sm font-medium">
                    {source.title}
                  </span>
                  <span className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">
                    Use as starting point
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface p-6">
              <Sparkles className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm font-medium">No source material yet</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground/45">
                Scripts and edit projects will appear here as additional inputs
                for future tests.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
