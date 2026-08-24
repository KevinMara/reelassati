import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Logo } from "@/components/Logo";
import {
  Link,
  Navigate,
  useNavigate,
  useLocation,
  Routes,
  Route,
} from "react-router-dom";
import {
  LayoutDashboard,
  Search,
  Bell,
  Sun,
  Moon,
  Globe,
  Users,
  FileText,
  BarChart3,
  Search as SearchIcon,
  PenLine,
  Scissors,
  Send,
  Library,
  Calendar,
  AtSign,
  Shield,
  Settings,
  LogOut,
  X,
  ChevronRight,
  ChevronDown,
  Flame,
  Film,
  Images,
  Mic,
  MessageSquareWarning,
  Mail,
  Gift,
  Menu,
  Database,
  HardDrive,
  BrainCircuit,
  Radio,
  Sparkles,
  CheckCircle2,
  Timer,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/providers/workspace";
import { platformApi } from "@/lib/platform-api";
import type { ComplianceStatus } from "@contracts/compliance";

function formatActivityTime(timestamp: string, now: number): string {
  const time = new Date(timestamp).getTime();
  if (!Number.isFinite(time)) return "Unknown time";
  const days = Math.round((time - now) / 86_400_000);
  if (Math.abs(days) <= 30) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
      days,
      "day"
    );
  }
  return new Date(time).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year:
      new Date(time).getFullYear() === new Date(now).getFullYear()
        ? undefined
        : "numeric",
  });
}

const ScriptGenerator = lazy(() => import("./dashboard/ScriptGenerator"));
const VideoAnalyzer = lazy(() => import("./dashboard/VideoAnalyzer"));
const EditorPage = lazy(() => import("./dashboard/EditorPage"));
const PublisherPage = lazy(() => import("./dashboard/PublisherPage"));
const AnalyticsPage = lazy(() => import("./dashboard/AnalyticsPage"));
const ContentLibrary = lazy(() => import("./dashboard/ContentLibrary"));
const ClientsPage = lazy(() => import("./dashboard/ClientsPage"));
const CalendarPage = lazy(() => import("./dashboard/CalendarPage"));
const SocialHub = lazy(() => import("./dashboard/SocialHub"));
const SettingsPage = lazy(() => import("./dashboard/SettingsPage"));
const TrendsPage = lazy(() => import("./dashboard/TrendsPage"));
const VideoGenerator = lazy(() => import("./dashboard/VideoGenerator"));
const ImageGenerator = lazy(() => import("./dashboard/ImageGenerator"));
const VoiceNotes = lazy(() => import("./dashboard/VoiceNotes"));
const GoalTracker = lazy(() => import("./dashboard/GoalTracker"));
const CoachingPage = lazy(() => import("./dashboard/CoachingPage"));
const ReferralPage = lazy(() => import("./dashboard/ReferralPage"));
const FeedbackPage = lazy(() => import("./dashboard/FeedbackPage"));

function StudioPageFallback() {
  return (
    <div
      className="flex min-h-[55vh] items-center justify-center"
      role="status"
      aria-label="Loading Studio tool"
    >
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

// ── Dashboard Home ──
function DashboardHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { workspace, capabilities, loading, saving, error } = useWorkspace();
  const [now] = useState(() => Date.now());
  const [hour] = useState(() => new Date().getHours());
  const greetKey =
    hour < 12
      ? "dash.greet_morning"
      : hour < 18
        ? "dash.greet_afternoon"
        : "dash.greet_evening";

  const publishedThisWeek = workspace.posts.filter(post => {
    if (!post.publishedAt) return false;
    return (
      now - new Date(post.publishedAt).getTime() <= 7 * 24 * 60 * 60 * 1000
    );
  }).length;
  const weekActivity = workspace.activity.filter(item => {
    const createdAt = new Date(item.createdAt).getTime();
    return Number.isFinite(createdAt) && now - createdAt <= 7 * 86_400_000;
  });
  const activeDays = new Set(
    weekActivity.map(item =>
      new Date(item.createdAt).toISOString().slice(0, 10)
    )
  ).size;
  const estimatedMinutesSaved = weekActivity.reduce((total, item) => {
    const minutesByAction: Record<(typeof item)["type"], number> = {
      generation: 18,
      script: 12,
      project: 8,
      publish: 5,
      upload: 0,
      goal: 0,
    };
    return total + minutesByAction[item.type];
  }, 0);
  const formattedTimeSaved =
    estimatedMinutesSaved >= 60
      ? `${Math.floor(estimatedMinutesSaved / 60)}h ${estimatedMinutesSaved % 60 ? `${estimatedMinutesSaved % 60}m` : ""}`.trim()
      : `${estimatedMinutesSaved}m`;
  const stats = [
    {
      label: "Editing projects",
      value: workspace.projects.length,
      sub: `${workspace.projects.filter(project => project.status === "editing").length} currently in edit`,
      icon: Scissors,
      to: "/dashboard/edit",
    },
    {
      label: "Media assets",
      value: workspace.assets.length,
      sub: "Stored in your private library",
      icon: Library,
      to: "/dashboard/library",
    },
    {
      label: t("dash.post_settimana"),
      value: publishedThisWeek,
      sub: "Published in the last 7 days",
      icon: FileText,
      to: "/dashboard/analytics",
    },
    {
      label: "Connected accounts",
      value: workspace.accounts.filter(
        account => account.status === "connected"
      ).length,
      sub: capabilities.publishing
        ? "Publishing is connected"
        : "Publishing setup required",
      icon: AtSign,
      to: "/dashboard/social",
    },
  ];

  const quickStart = [
    {
      title: "Open editing studio",
      desc: "Upload, trim, split, caption, review AI changes, and version your short.",
      icon: Scissors,
      to: "/dashboard/edit",
    },
    {
      title: t("dash.analizza_video"),
      desc: t("dash.analizza_video_desc"),
      icon: SearchIcon,
      to: "/dashboard/analyze",
    },
    {
      title: t("dash.scrivi_script"),
      desc: t("dash.scrivi_script_desc"),
      icon: PenLine,
      to: "/dashboard/script",
    },
    {
      title: "Generate a controlled shot",
      desc: "Direct a new clip or continue a scene with timed beats and native audio.",
      icon: Film,
      to: "/dashboard/video",
    },
    {
      title: "Generate a campaign image",
      desc: "Create a named visual and send it straight to your Library or timeline.",
      icon: Images,
      to: "/dashboard/image",
    },
    {
      title: t("dash.pubblica_bozza"),
      desc: t("dash.pubblica_bozza_desc"),
      icon: Send,
      to: "/dashboard/publish",
    },
  ];

  const recentActivity = workspace.activity.slice(0, 6);
  const onboarding = [
    {
      done: Boolean(workspace.brandKit.voice && workspace.brandKit.audience),
      title: "Define Brand DNA",
      detail: "Add voice, audience, colors, and caption behavior in Settings.",
    },
    {
      done: workspace.assets.length > 0,
      title: "Upload real footage",
      detail: "Build a reusable, private media library.",
    },
    {
      done: workspace.projects.length > 0,
      title: "Create your first edit",
      detail: "Manual and AI changes share one reviewable timeline.",
    },
  ];
  const onboardingDone = onboarding.filter(item => item.done).length;
  const onboardingProgress = Math.round(
    (onboardingDone / onboarding.length) * 100
  );
  const momentumMessage =
    weekActivity.length === 0
      ? "Your first small win is one action away."
      : weekActivity.length < 3
        ? "Nice start. Keep the next action small."
        : weekActivity.length < 7
          ? "Momentum is building naturally."
          : "A strong week—keep the rhythm sustainable.";

  if (loading) {
    return (
      <div className="min-h-[55vh] flex items-center justify-center">
        <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="dashboard-hero mb-6 rounded-2xl border border-border px-5 py-5 md:px-6">
        <p className="mono-eyebrow text-primary mb-2">Dashboard</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold">
              {t(greetKey)}, {user?.name || "Creator"}.
            </h1>
            <p className="text-sm text-foreground/50 mt-2">
              What will you make impossible to scroll past today?
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1.5 text-xs text-foreground/50 shadow-sm backdrop-blur-sm">
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                saving
                  ? "save-status-dot bg-primary"
                  : error
                    ? "bg-destructive"
                    : "bg-emerald-500"
              )}
            />
            {saving
              ? "Saving workspace…"
              : error
                ? "Changes need attention"
                : "Everything saved"}
          </span>
        </div>
      </div>

      <section
        className="momentum-strip mb-6 rounded-xl border border-border bg-surface px-4 py-4 shadow-card sm:px-5"
        aria-label="Weekly momentum"
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="min-w-[180px] flex-1">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-xs font-medium">Weekly momentum</p>
                <p className="text-[11px] text-foreground/45">
                  {momentumMessage}
                </p>
              </div>
            </div>
          </div>
          <div className="flex min-w-[110px] items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <div>
              <p className="text-sm font-semibold tabular">
                {weekActivity.length}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-foreground/40">
                actions this week
              </p>
            </div>
          </div>
          <div
            className="flex min-w-[120px] items-center gap-2.5"
            title="Estimate based only on AI-assisted actions recorded in this workspace"
          >
            <Timer className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold tabular">
                {formattedTimeSaved}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-foreground/40">
                time reclaimed
              </p>
              <span className="sr-only">
                Estimated only from AI-assisted actions recorded in this
                workspace.
              </span>
            </div>
          </div>
          <div className="flex min-w-[105px] items-center gap-2.5">
            <Activity className="h-4 w-4 text-amber-500" />
            <div>
              <p className="text-sm font-semibold tabular">{activeDays}</p>
              <p className="text-[10px] uppercase tracking-wide text-foreground/40">
                active days
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map(s => (
          <Link
            key={s.label}
            to={s.to}
            data-reward-surface
            className="studio-stat-card group bg-surface border border-border rounded-xl p-5 shadow-card"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="mono-eyebrow text-foreground/50 text-[10px]">
                {s.label}
              </span>
              <s.icon className="h-4 w-4 text-foreground/40 transition-colors group-hover:text-primary" />
            </div>
            <div className="text-2xl font-semibold tabular">{s.value}</div>
            <p className="text-xs text-foreground/50 mt-1">{s.sub}</p>
          </Link>
        ))}
      </div>

      {/* Quick start */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">{t("dash.inizia_da_qui")}</h2>
        <Link
          to="/dashboard/edit"
          className="text-sm text-primary hover:text-primary-hover flex items-center gap-1"
        >
          Open Studio <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        {quickStart.map(qs => (
          <Link
            key={qs.title}
            to={qs.to}
            data-reward-surface
            className="studio-action-card bg-surface border border-border rounded-xl p-5 group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-lg bg-primary-wash flex items-center justify-center">
                <qs.icon className="h-4 w-4 text-primary" />
              </div>
              <ChevronRight className="studio-action-arrow h-4 w-4 text-foreground/30 group-hover:text-primary" />
            </div>
            <h3 className="font-semibold">{qs.title}</h3>
            <p className="text-sm text-foreground/60 mt-1">{qs.desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div
          id="recent-activity"
          className="scroll-mt-20 lg:col-span-2 bg-surface border border-border rounded-xl p-6"
        >
          <h2 className="font-medium mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {recentActivity.length ? (
              recentActivity.map(item => (
                <div
                  key={item.id}
                  className="studio-activity-row flex items-center gap-3 p-3 rounded-lg bg-background"
                >
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium bg-primary/10 text-primary">
                    {item.type.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-foreground/50 truncate">
                      {item.detail}
                    </p>
                  </div>
                  <span className="text-xs text-foreground/30">
                    {formatActivityTime(item.createdAt, now)}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="text-sm font-medium">
                  Your activity starts with a real action.
                </p>
                <p className="text-xs text-foreground/50 mt-1">
                  Upload footage or create an editing project—no fabricated demo
                  feed.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Onboarding */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="font-semibold">{t("dash.onboarding_title")}</h3>
            <span className="text-xs font-medium tabular text-primary">
              {onboardingProgress}%
            </span>
          </div>
          <p className="text-sm text-foreground/60 mb-4">
            {t("dash.onboarding_desc")}
          </p>
          <div
            className="mb-5 h-1.5 overflow-hidden rounded-full bg-primary/10"
            role="progressbar"
            aria-label="Studio setup progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={onboardingProgress}
          >
            <div
              className="momentum-progress-fill h-full rounded-full bg-primary"
              style={{ width: `${onboardingProgress}%` }}
            />
          </div>
          <div className="space-y-3">
            {onboarding.map((item, index) => (
              <div key={item.title} className="flex items-start gap-3">
                <div
                  className={cn(
                    "h-5 w-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center",
                    item.done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-primary bg-primary/10"
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] font-bold",
                      item.done ? "text-white" : "text-primary"
                    )}
                  >
                    {item.done ? "✓" : index + 1}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-foreground/50">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-border">
            <Link
              to="/dashboard/trends"
              className="flex items-center gap-2 text-sm text-primary hover:text-primary-hover"
            >
              <Flame className="h-4 w-4" /> Explore trending content
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudioStatus() {
  const { capabilities, workspace, error } = useWorkspace();
  const [compliance, setCompliance] = useState<ComplianceStatus | null>(null);
  const [legalName, setLegalName] = useState("");
  const [entityType, setEntityType] = useState<
    "individual" | "company" | "other"
  >("individual");
  const [firstEuAvailabilityDate, setFirstEuAvailabilityDate] = useState("");
  const [creativeScopeConfirmed, setCreativeScopeConfirmed] = useState(false);
  const [complianceNotice, setComplianceNotice] = useState("");
  const [complianceBusy, setComplianceBusy] = useState(false);
  useEffect(() => {
    let active = true;
    platformApi
      .complianceStatus()
      .then(({ status }) => {
        if (!active) return;
        setCompliance(status);
        setLegalName(status.operatorName || "");
        if (status.operatorEntityType) setEntityType(status.operatorEntityType);
        setFirstEuAvailabilityDate(status.firstEuAvailabilityDate || "");
        setCreativeScopeConfirmed(status.creativeScopeConfirmed);
      })
      .catch((cause: unknown) => {
        if (active) {
          setComplianceNotice(
            cause instanceof Error
              ? cause.message
              : "Compliance status could not load."
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const saveOperator = async () => {
    if (
      !legalName.trim() ||
      !firstEuAvailabilityDate ||
      !creativeScopeConfirmed
    )
      return;
    setComplianceBusy(true);
    setComplianceNotice("");
    try {
      const { status } = await platformApi.saveOperatorCompliance({
        legalName: legalName.trim(),
        entityType,
        releaseStatus: "public",
        firstEuAvailabilityDate,
        creativeScopeConfirmed: true,
      });
      setCompliance(status);
      setComplianceNotice("Operator facts and intended use saved.");
    } catch (cause) {
      setComplianceNotice(
        cause instanceof Error
          ? cause.message
          : "Operator facts could not be saved."
      );
    } finally {
      setComplianceBusy(false);
    }
  };

  const acknowledgeLiteracy = async () => {
    setComplianceBusy(true);
    setComplianceNotice("");
    try {
      const { status } = await platformApi.acknowledgeAiLiteracy();
      setCompliance(status);
      setComplianceNotice("Role-specific AI operations review recorded.");
    } catch (cause) {
      setComplianceNotice(
        cause instanceof Error
          ? cause.message
          : "The review could not be recorded."
      );
    } finally {
      setComplianceBusy(false);
    }
  };
  const rows = [
    {
      label: "Workspace database",
      detail: "Projects, edits, goals, and revisions",
      ready: capabilities.persistence,
      icon: Database,
    },
    {
      label: "Media storage",
      detail: "Private uploaded and generated assets",
      ready: capabilities.uploads,
      icon: HardDrive,
    },
    {
      label: "REELassati AI",
      detail: "Scripts, edit plans, analysis, voice, and video",
      ready: capabilities.ai && capabilities.analysis,
      icon: BrainCircuit,
    },
    {
      label: "Connected publishing",
      detail: "Account connection, scheduling, and posts",
      ready: capabilities.publishing,
      icon: Radio,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <p className="mono-eyebrow text-primary mb-2">Production readiness</p>
      <h1 className="text-3xl font-semibold">Studio status</h1>
      <p className="text-foreground/60 mt-2">
        Availability for storage, generation, and connected publishing.
      </p>
      {error ? <p className="mt-5 text-sm text-destructive">{error}</p> : null}
      <div className="grid sm:grid-cols-2 gap-4 mt-8">
        {rows.map(row => (
          <div
            key={row.label}
            className="bg-surface border border-border rounded-xl p-5"
          >
            <div className="flex items-center justify-between">
              <row.icon className="h-5 w-5 text-primary" />
              <span
                className={cn(
                  "text-[10px] font-mono tracking-wider uppercase px-2 py-1 rounded-full",
                  row.ready
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-amber-500/10 text-amber-500"
                )}
              >
                {row.ready ? "Configured" : "Setup needed"}
              </span>
            </div>
            <h2 className="font-semibold mt-5">{row.label}</h2>
            <p className="text-sm text-foreground/50 mt-1">{row.detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 bg-surface border border-border rounded-xl p-5">
        <h2 className="font-medium">Workspace footprint</h2>
        <p className="text-sm text-foreground/60 mt-2">
          {workspace.projects.length} projects · {workspace.assets.length}{" "}
          assets · {workspace.scripts.length} scripts · {workspace.posts.length}{" "}
          publications
        </p>
        {capabilities.missing.length ? (
          <p className="text-xs text-foreground/45 mt-3">
            Some managed services still need setup.
          </p>
        ) : null}
      </div>
      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mono-eyebrow text-primary">
              Compliance control plane
            </p>
            <h2 className="mt-2 text-lg font-semibold">
              EU public-release readiness
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-foreground/55">
              Versioned controls, machine provenance and publishing gates are
              structural. This status does not claim certification or replace
              legal review.
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide",
              compliance?.publicLaunchReady
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-amber-500/10 text-amber-600"
            )}
          >
            {compliance?.publicLaunchReady
              ? "Ready on recorded facts"
              : "Facts needed"}
          </span>
        </div>
        {complianceNotice ? (
          <p className="mt-4 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground/60">
            {complianceNotice}
          </p>
        ) : null}
        {compliance?.blockers.length ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {compliance.blockers.map(blocker => (
              <li
                key={blocker}
                className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2 text-xs"
              >
                {blocker}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-4">
            <h3 className="text-sm font-semibold">Operator and intended use</h3>
            <p className="mt-1 text-xs text-foreground/45">
              Record the exact operator facts; REELassati never invents an
              entity name or market date.
            </p>
            <input
              value={legalName}
              onChange={event => setLegalName(event.target.value)}
              placeholder="Full legal operator name"
              className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select
                value={entityType}
                onChange={event =>
                  setEntityType(event.target.value as typeof entityType)
                }
                className="rounded-lg border border-border bg-surface px-3 py-2 text-xs"
              >
                <option value="individual">Individual</option>
                <option value="company">Company</option>
                <option value="other">Other entity</option>
              </select>
              <div className="flex items-center rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs font-medium text-emerald-600">
                Public platform
              </div>
            </div>
            <label className="mt-3 block text-xs text-foreground/55">
              First EU availability or put-into-service date
              <input
                type="date"
                value={firstEuAvailabilityDate}
                onChange={event =>
                  setFirstEuAvailabilityDate(event.target.value)
                }
                className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
              />
            </label>
            <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-foreground/60">
              <input
                type="checkbox"
                checked={creativeScopeConfirmed}
                onChange={event =>
                  setCreativeScopeConfirmed(event.target.checked)
                }
                className="mt-0.5 accent-primary"
              />
              <span>
                Permanently limit REELassati to creative/marketing work—never
                biometric/emotion inference or high-impact decisions about
                people.
              </span>
            </label>
            <button
              type="button"
              onClick={() => void saveOperator()}
              disabled={
                complianceBusy ||
                !legalName.trim() ||
                !firstEuAvailabilityDate ||
                !creativeScopeConfirmed
              }
              className="mt-4 rounded-lg bg-primary px-4 py-2.5 text-xs font-medium text-white disabled:opacity-40"
            >
              Save operator record
            </button>
          </div>

          <div className="rounded-xl border border-border bg-background p-4">
            <h3 className="text-sm font-semibold">
              Role-specific AI operations review
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-foreground/45">
              Review intended use, model limitations, synthetic-media
              disclosure, rights/consent, human editorial control and incident
              escalation. This records the owner’s review only; staff and
              contractors need role-appropriate measures of their own.
            </p>
            <ul className="mt-3 space-y-2 text-xs text-foreground/65">
              <li>• Each AI task uses a recorded managed production route.</li>
              <li>
                • Generated output needs verified provenance before release.
              </li>
              <li>
                • Realistic synthetic media and public-interest text use
                conditional disclosures.
              </li>
              <li>
                • AI output can be wrong; final claims remain under human
                control.
              </li>
            </ul>
            <button
              type="button"
              onClick={() => void acknowledgeLiteracy()}
              disabled={
                complianceBusy || Boolean(compliance?.aiLiteracyAcknowledgedAt)
              }
              className="mt-4 rounded-lg border border-primary/30 px-4 py-2.5 text-xs font-medium text-primary disabled:opacity-45"
            >
              {compliance?.aiLiteracyAcknowledgedAt
                ? `Reviewed ${new Date(compliance.aiLiteracyAcknowledgedAt).toLocaleDateString()}`
                : "Record completed review"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
          {capabilities.modelRoutes.map(route => (
            <div
              key={route.purpose}
              className="rounded-lg border border-border bg-background p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{route.purpose}</p>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-foreground/45">
                Managed by REELassati
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Main Dashboard Component ──
export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user, logout, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(() =>
    ["/dashboard/video", "/dashboard/image", "/dashboard/voice"].some(route =>
      location.pathname.startsWith(route)
    )
  );

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth/login");
  }, [authLoading, user, navigate]);
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const toggleLang = () =>
    i18n.changeLanguage(i18n.language === "it" ? "en" : "it");
  const path = location.pathname;

  const navItems: Array<
    | { separator: true }
    | { group: "create"; separator?: false }
    | { icon: LucideIcon; label: string; to: string; separator?: false }
  > = [
    { icon: LayoutDashboard, label: t("nav.dashboard"), to: "/dashboard" },
    { icon: Flame, label: "Trends", to: "/dashboard/trends" },
    { icon: PenLine, label: t("nav.script"), to: "/dashboard/script" },
    { group: "create" },
    { icon: Scissors, label: t("nav.edit"), to: "/dashboard/edit" },
    { icon: Search, label: t("nav.analyze"), to: "/dashboard/analyze" },
    { icon: Send, label: t("nav.publish"), to: "/dashboard/publish" },
    { icon: BarChart3, label: t("nav.analytics"), to: "/dashboard/analytics" },
    { separator: true },
    { icon: Users, label: t("nav.clients"), to: "/dashboard/clients" },
    { icon: Calendar, label: t("nav.calendar"), to: "/dashboard/calendar" },
    { icon: Mail, label: "Weekly Coach", to: "/dashboard/coaching" },
    { separator: true },
    { icon: Library, label: t("nav.library"), to: "/dashboard/library" },
    { icon: AtSign, label: t("nav.social"), to: "/dashboard/social" },
    { icon: Gift, label: "Refer & Earn", to: "/dashboard/referral" },
    { separator: true },
    {
      icon: MessageSquareWarning,
      label: "Feedback & bugs",
      to: "/dashboard/feedback",
    },
    { icon: Settings, label: t("nav.settings"), to: "/dashboard/settings" },
    { icon: Shield, label: "Studio status", to: "/dashboard/status" },
  ];

  return (
    <div className="studio-shell min-h-screen bg-background text-foreground flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-50 h-screen bg-surface border-r border-border flex flex-col transition-all duration-300",
          collapsed ? "w-[68px]" : "w-56",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-14 flex items-center px-3 border-b border-border shrink-0">
          <Link to="/" className="flex-1">
            <Logo collapsed={collapsed} />
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-expanded={!collapsed}
            className="hidden lg:flex p-1.5 rounded-md text-foreground/40 hover:text-foreground"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="lg:hidden p-1.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map((item, i) =>
            item.separator ? (
              <div
                key={`sep-${i}`}
                role="separator"
                className="border-t border-border my-2"
              />
            ) : "group" in item ? (
              <div key={item.group}>
                <button
                  type="button"
                  aria-expanded={createOpen && !collapsed}
                  aria-controls="creator-tools-navigation"
                  onClick={() => {
                    if (collapsed) {
                      setCollapsed(false);
                      setCreateOpen(true);
                      return;
                    }
                    setCreateOpen(current => !current);
                  }}
                  className={cn(
                    "studio-nav-link flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                    path.startsWith("/dashboard/video") ||
                      path.startsWith("/dashboard/image") ||
                      path.startsWith("/dashboard/voice")
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground"
                  )}
                  title={collapsed ? "Create" : undefined}
                >
                  <Sparkles className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed ? (
                    <>
                      <span className="flex-1 text-left">Create</span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          createOpen && "rotate-180"
                        )}
                      />
                    </>
                  ) : null}
                </button>
                {createOpen && !collapsed ? (
                  <div
                    id="creator-tools-navigation"
                    className="ml-4 mt-1 space-y-0.5 border-l border-border pl-2"
                  >
                    <SidebarItem
                      icon={Film}
                      label="Video"
                      to="/dashboard/video"
                      active={path.startsWith("/dashboard/video")}
                    />
                    <SidebarItem
                      icon={Images}
                      label="Images"
                      to="/dashboard/image"
                      active={path.startsWith("/dashboard/image")}
                    />
                    <SidebarItem
                      icon={Mic}
                      label="Audio"
                      to="/dashboard/voice"
                      active={path.startsWith("/dashboard/voice")}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <SidebarItem
                key={item.to}
                icon={item.icon}
                label={item.label}
                to={item.to}
                active={
                  path === item.to ||
                  (item.to !== "/dashboard" && path.startsWith(item.to))
                }
                collapsed={collapsed}
              />
            )
          )}
        </div>

        <div className="shrink-0 border-t border-border p-3">
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors w-full"
          >
            <LogOut className="h-[18px] w-[18px]" />{" "}
            {!collapsed && <span>{t("nav.logout") || "Exit studio"}</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30 flex items-center px-4 gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="lg:hidden p-2 -ml-2"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="mono-eyebrow text-foreground/50 hidden sm:block">
            Dashboard
          </span>
          <div className="flex-1" />
          <Link
            to="/dashboard/library?focus=search"
            className="hidden sm:flex items-center gap-1 h-9 px-3 rounded-md border border-border bg-surface text-xs text-foreground/50 hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5 mr-1" /> Find assets
          </Link>
          <Link
            to="/dashboard#recent-activity"
            aria-label="Recent activity"
            className="p-2 text-foreground/70"
          >
            <Bell className="h-[18px] w-[18px]" />
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === "light" ? "Use dark theme" : "Use light theme"
            }
            className="p-2 text-foreground/70"
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={toggleLang}
            aria-label={
              i18n.language === "it"
                ? "Switch to English"
                : "Passa all’italiano"
            }
            className="flex items-center gap-1 text-xs text-foreground/50"
          >
            <Globe className="h-3.5 w-3.5" />{" "}
            {i18n.language === "it" ? "IT" : "EN"}
          </button>
        </header>

        <main className="flex-1 p-6 lg:p-10 w-full">
          <Suspense fallback={<StudioPageFallback />}>
            <div key={path} className="studio-route-enter">
              <Routes>
                <Route path="/" element={<DashboardHome />} />
                <Route path="/analyze" element={<VideoAnalyzer />} />
                <Route path="/script" element={<ScriptGenerator />} />
                <Route path="/video" element={<VideoGenerator />} />
                <Route path="/image" element={<ImageGenerator />} />
                <Route path="/edit" element={<EditorPage />} />
                <Route path="/publish" element={<PublisherPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/library" element={<ContentLibrary />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/social" element={<SocialHub />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/trends" element={<TrendsPage />} />
                <Route path="/voice" element={<VoiceNotes />} />
                <Route
                  path="/interview"
                  element={
                    <Navigate to="/dashboard/script?mode=interview" replace />
                  }
                />
                <Route path="/goals" element={<GoalTracker />} />
                <Route path="/coaching" element={<CoachingPage />} />
                <Route path="/referral" element={<ReferralPage />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/status" element={<StudioStatus />} />
                <Route
                  path="*"
                  element={<Navigate to="/dashboard" replace />}
                />
              </Routes>
            </div>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  to,
  active,
  collapsed,
}: {
  icon: LucideIcon;
  label: string;
  to: string;
  active?: boolean;
  collapsed?: boolean;
}) {
  return (
    <Link
      to={to}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "studio-nav-link flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-foreground/70 hover:text-foreground hover:bg-foreground/[0.04]"
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
