import { getUiLocale, translateUi, useUiText } from "@/lib/i18n/ui";
import { formatMinutesDuration } from "@/lib/format-duration";
import { isWorkspaceInterfaceActivity } from "@contracts/workspace-activity-ui";
import { OwnerOperations } from "@/components/studio/OwnerOperations";
import { CreationStart } from "@/components/studio/CreationStart";
import { BrandSwitcher } from "@/components/studio/BrandSwitcher";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Logo } from "@/components/Logo";
import { LanguagePicker } from "@/components/LanguagePicker";
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
  Building2,
  Bell,
  Sun,
  Moon,
  Users,
  FileText,
  BarChart3,
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
  Palette,
  Lock,
  Unlock,
  Film,
  Images,
  Mic,
  MessageSquareWarning,
  Mail,
  Gift,
  WalletCards,
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
import { CreditBalanceChip } from "@/components/studio/CreditBalanceChip";
import { StudioMediaTray } from "@/components/studio/StudioMediaTray";
import { FirstVisitTour } from "@/components/help/FirstVisitTour";
import { PageGuideButton } from "@/components/help/PageGuide";

function formatActivityTime(timestamp: string, now: number): string {
  const time = new Date(timestamp).getTime();
  if (!Number.isFinite(time)) return translateUi("Unknown time");
  const days = Math.round((time - now) / 86_400_000);
  if (Math.abs(days) <= 30) {
    return new Intl.RelativeTimeFormat(getUiLocale(), {
      numeric: "auto",
    }).format(days, "day");
  }
  return new Date(time).toLocaleDateString(getUiLocale(), {
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
const StylesPage = lazy(() => import("./dashboard/StylesPage"));
const VideoGenerator = lazy(() => import("./dashboard/VideoGenerator"));
const ImageGenerator = lazy(() => import("./dashboard/ImageGenerator"));
const VoiceNotes = lazy(() => import("./dashboard/VoiceNotes"));
const GoalTracker = lazy(() => import("./dashboard/GoalTracker"));
const CoachingPage = lazy(() => import("./dashboard/CoachingPage"));
const ReferralPage = lazy(() => import("./dashboard/ReferralPage"));
const FeedbackPage = lazy(() => import("./dashboard/FeedbackPage"));
const BillingPage = lazy(() => import("./dashboard/BillingPage"));

function StudioPageFallback() {
  const ui = useUiText();
  return (
    <div
      className="flex min-h-[55vh] items-center justify-center"
      role="status"
      aria-label={ui("Loading Studio tool")}
    >
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

// ── Dashboard Home ──
function DashboardHome() {
  const ui = useUiText();
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
      calendar: 0,
    };
    return total + minutesByAction[item.type];
  }, 0);
  const formattedTimeSaved = formatMinutesDuration(
    estimatedMinutesSaved,
    getUiLocale()
  );
  const stats = [
    {
      label: "Editing projects",
      value: workspace.projects.length,
      sub: ui("Edits in progress: {{count}}", {
        count: workspace.projects.filter(
          project => project.status === "editing"
        ).length,
      }),
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
        ? ui("Publishing connection is ready")
        : ui("Publishing setup is incomplete"),
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
      icon: BrainCircuit,
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
      to: "/dashboard/clients",
      title: "Define Brand DNA",
      detail: "Save your voice, audience, colors, and caption style.",
    },
    {
      done: workspace.assets.length > 0,
      to: "/dashboard/library",
      title: "Upload real footage",
      detail: "Build a reusable, private media library.",
    },
    {
      done: workspace.projects.length > 0,
      to: "/dashboard/edit",
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
      ? ui("Your next idea can start here")
      : weekActivity.length < 3
        ? ui("Finish one useful step")
        : weekActivity.length < 7
          ? ui("Keep progress current")
          : ui("Refine, review, and export");

  if (loading) {
    return (
      <div className="min-h-[55vh] flex items-center justify-center">
        <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold">
              {t(greetKey)}
              {user?.name ? `, ${user.name}` : ""}.
            </h1>
            <p className="text-sm text-foreground/70 mt-2">
              {ui("What will you make impossible to scroll past today?")}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
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
              ? ui("Saving workspace…")
              : error
                ? ui("Changes need attention")
                : ui("Everything saved")}
          </span>
        </div>
      </div>
      <CreationStart />

      <section
        className="mb-6 border-y border-border py-4"
        aria-label={ui("Weekly momentum")}
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="min-w-[180px] flex-1">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-xs font-medium">{ui("Weekly momentum")}</p>
                <p className="text-xs text-foreground/70">{momentumMessage}</p>
              </div>
            </div>
          </div>
          <div className="flex min-w-[110px] items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <div>
              <p className="text-sm font-semibold tabular">
                {weekActivity.length}
              </p>
              <p className="text-xs uppercase tracking-wide text-foreground/70">
                {ui("actions this week")}
              </p>
            </div>
          </div>
          <div
            className="flex min-w-[120px] items-center gap-2.5"
            title={ui(
              "Estimate based only on AI-assisted actions recorded in this workspace"
            )}
          >
            <Timer className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold tabular">
                {formattedTimeSaved}
              </p>
              <p className="text-xs uppercase tracking-wide text-foreground/70">
                {ui("time reclaimed")}
              </p>
              <span className="sr-only">
                {ui(
                  "Estimated only from AI-assisted actions recorded in this workspace."
                )}
              </span>
            </div>
          </div>
          <div className="flex min-w-[105px] items-center gap-2.5">
            <Activity className="h-4 w-4 text-amber-500" />
            <div>
              <p className="text-sm font-semibold tabular">{activeDays}</p>
              <p className="text-xs uppercase tracking-wide text-foreground/70">
                {ui("active days")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map(s => (
          <Link
            key={s.to}
            to={s.to}
            data-reward-surface
            className="studio-stat-card group bg-surface border border-border rounded-xl p-5 shadow-card"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="mono-eyebrow text-foreground/70 text-xs">
                {ui(s.label)}
              </span>
              <s.icon className="h-4 w-4 text-foreground/70 transition-colors group-hover:text-primary" />
            </div>
            <div className="text-2xl font-semibold tabular">{s.value}</div>
            <p className="text-xs text-foreground/70 mt-1">{ui(s.sub)}</p>
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
          {ui("Open Studio")} <ChevronRight className="h-3.5 w-3.5" />
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
              <ChevronRight className="studio-action-arrow h-4 w-4 text-foreground/70 group-hover:text-primary" />
            </div>
            <h3 className="font-semibold">{ui(qs.title)}</h3>
            <p className="text-sm text-foreground/60 mt-1">{ui(qs.desc)}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div
          id="recent-activity"
          className="scroll-mt-20 lg:col-span-2 bg-surface border border-border rounded-xl p-6"
        >
          <h2 className="font-medium mb-4">{ui("Recent Activity")}</h2>
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
                    <p className="text-sm font-medium">
                      {isWorkspaceInterfaceActivity(item.type, item.label)
                        ? ui(item.label)
                        : item.label}
                    </p>
                    <p className="text-xs text-foreground/70 truncate">
                      {item.type === "generation" &&
                      item.label === "Voice note transcribed"
                        ? item.detail.replace(
                            / · (\d+) timestamped segments$/,
                            (_suffix, count: string) =>
                              ` · ${ui("timestamped segments")}: ${Number(count).toLocaleString(getUiLocale())}`
                          )
                        : item.detail}
                    </p>
                  </div>
                  <span className="text-xs text-foreground/70">
                    {formatActivityTime(item.createdAt, now)}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="text-sm font-medium">
                  {ui("Your activity starts with a real action.")}
                </p>
                <p className="text-xs text-foreground/70 mt-1">
                  {ui(
                    "Upload footage or create a project to start your activity history."
                  )}
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
            aria-label={ui("Studio setup progress")}
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
              <Link
                to={item.to}
                key={item.title}
                className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
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
                      "text-xs font-bold",
                      item.done ? "text-white" : "text-primary"
                    )}
                  >
                    {item.done ? "✓" : index + 1}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium">{ui(item.title)}</p>
                  <p className="text-xs text-foreground/70">
                    {ui(item.detail)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-border">
            <Link
              to="/dashboard/styles"
              className="flex items-center gap-2 text-sm text-primary hover:text-primary-hover"
            >
              <Palette className="h-4 w-4" /> {ui("Styles")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudioStatus() {
  const ui = useUiText();
  const { capabilities, workspace, error } = useWorkspace();
  const rows = [
    {
      label: "Workspace database",
      detail: "Projects, edits, goals, and revisions",
      ready: capabilities.persistence,
      icon: Database,
      to: "/dashboard/settings",
    },
    {
      label: "Media storage",
      detail: "Private uploaded and generated assets",
      ready: capabilities.uploads,
      icon: HardDrive,
      to: "/dashboard/library",
    },
    {
      label: "REELassati AI",
      detail: "Scripts, edit plans, analysis, voice, and video",
      ready: capabilities.ai && capabilities.analysis,
      icon: BrainCircuit,
      to: "/dashboard/script",
    },
    {
      label: "Connected publishing",
      detail: "Account connection, scheduling, and posts",
      ready: capabilities.publishing,
      icon: Radio,
      to: "/dashboard/social",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {capabilities.operations && <OwnerOperations />}
      <p className="mono-eyebrow text-primary mb-2">
        {ui("Production readiness")}
      </p>
      <h1 className="text-3xl font-semibold">{ui("Studio status")}</h1>
      <p className="text-foreground/60 mt-2">
        {ui("Availability for storage, generation, and connected publishing.")}
      </p>
      {error ? <p className="mt-5 text-sm text-destructive">{error}</p> : null}
      <div className="grid sm:grid-cols-2 gap-4 mt-8">
        {rows.map(row => (
          <Link
            key={row.to}
            to={row.to}
            aria-label={ui("{{service}}: {{action}}", {
              service: ui(row.label),
              action: row.ready ? ui("Open workspace") : ui("Resolve setup"),
            })}
            className="group block bg-surface border border-border rounded-xl p-5 transition duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transform-none"
          >
            <div className="flex items-center justify-between">
              <row.icon className="h-5 w-5 text-primary" />
              <span
                className={cn(
                  "text-xs font-mono tracking-wider uppercase px-2 py-1 rounded-full",
                  row.ready
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-amber-500/10 text-amber-500"
                )}
              >
                {row.ready ? ui("Configured") : ui("Setup needed")}
              </span>
            </div>
            <h2 className="font-semibold mt-5">{ui(row.label)}</h2>
            <p className="text-sm text-foreground/70 mt-1">{ui(row.detail)}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary">
              {row.ready ? ui("Open workspace") : ui("Resolve setup")}
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
      <div className="mt-6 bg-surface border border-border rounded-xl p-5">
        <h2 className="font-medium">{ui("Workspace footprint")}</h2>
        <p className="text-sm text-foreground/60 mt-2">
          {workspace.projects.length} {ui("projects ·")}{" "}
          {workspace.assets.length} {ui("assets ·")} {workspace.scripts.length}{" "}
          {ui("scripts ·")} {workspace.posts.length} {ui("publications")}
        </p>
        {capabilities.missing.length ? (
          <p className="text-xs text-foreground/70 mt-3">
            {ui("Some managed services still need setup.")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ── Main Dashboard Component ──
export default function Dashboard() {
  const ui = useUiText();
  const { t } = useTranslation();
  const { user, logout, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { loading: workspaceLoading } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [pinned, setPinned] = useState(
    () => localStorage.getItem("reelassati:sidebar-pinned") === "true"
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobilePath, setMobilePath] = useState(location.pathname);
  if (mobilePath !== location.pathname) {
    setMobilePath(location.pathname);
    setMobileOpen(false);
  }
  const [expandedPath, setExpandedPath] = useState("");
  const collapsed =
    !mobileOpen &&
    !pinned &&
    location.pathname !== "/dashboard" &&
    expandedPath !== location.pathname;
  const setCollapsed = (value: boolean) =>
    setExpandedPath(value ? "" : location.pathname);
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

  const path = location.pathname;

  const navItems: Array<
    | { separator: true; label: string; compact?: boolean }
    | { group: "create"; separator?: false }
    | { icon: LucideIcon; label: string; to: string; separator?: false }
  > = [
    { icon: LayoutDashboard, label: t("nav.dashboard"), to: "/dashboard" },
    { separator: true, label: "", compact: true },
    { icon: Palette, label: ui("Styles"), to: "/dashboard/styles" },
    { icon: PenLine, label: t("nav.script"), to: "/dashboard/script" },
    { group: "create" },
    { icon: Scissors, label: t("nav.edit"), to: "/dashboard/edit" },
    { icon: BrainCircuit, label: t("nav.analyze"), to: "/dashboard/analyze" },
    { icon: Send, label: t("nav.publish"), to: "/dashboard/publish" },
    { icon: BarChart3, label: t("nav.analytics"), to: "/dashboard/analytics" },
    { separator: true, label: ui("Workspace") },
    { icon: Library, label: t("nav.library"), to: "/dashboard/library" },
    { icon: Users, label: t("nav.clients"), to: "/dashboard/clients" },
    { icon: Calendar, label: t("nav.calendar"), to: "/dashboard/calendar" },
    {
      icon: Mail,
      label: ui("Weekly Coach"),
      to: "/dashboard/coaching",
    },
    { separator: true, label: ui("Account") },
    { icon: AtSign, label: t("nav.social"), to: "/dashboard/social" },
    {
      icon: Gift,
      label: ui("Refer & Earn"),
      to: "/dashboard/referral",
    },
    {
      icon: WalletCards,
      label: ui("Plan & credits"),
      to: "/dashboard/billing",
    },
    {
      separator: true,
      label: ui("Support"),
    },
    {
      icon: MessageSquareWarning,
      label: ui("Feedback & bugs"),
      to: "/dashboard/feedback",
    },
    { icon: Settings, label: t("nav.settings"), to: "/dashboard/settings" },
    {
      icon: Shield,
      label: ui("Studio status"),
      to: "/dashboard/status",
    },
  ];

  return (
    <div
      className="studio-shell min-h-screen bg-background text-foreground flex"
      data-page={path.split("/")[2] || "dashboard"}
    >
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label={ui("Close navigation")}
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => {
          if (!pinned && path !== "/dashboard") {
            setCollapsed(true);
            setCreateOpen(false);
          }
        }}
        onFocusCapture={() => setCollapsed(false)}
        onBlurCapture={event => {
          if (
            !event.currentTarget.contains(event.relatedTarget as Node) &&
            !pinned &&
            path !== "/dashboard"
          )
            setCollapsed(true);
        }}
        className={cn(
          "fixed lg:sticky top-0 left-0 z-50 h-screen bg-surface border-r border-border flex flex-col transition-all duration-300",
          collapsed ? "w-[56px]" : "w-56",
          mobileOpen
            ? "visible translate-x-0"
            : "invisible -translate-x-full lg:visible lg:translate-x-0"
        )}
      >
        <div className="h-14 flex items-center px-3 border-b border-border shrink-0">
          <Link to="/" className="flex-1">
            <Logo size="sm" collapsed={collapsed} />
          </Link>
          <button
            type="button"
            onClick={() => {
              const next = !pinned;
              setPinned(next);
              localStorage.setItem("reelassati:sidebar-pinned", String(next));
            }}
            aria-label={
              pinned ? ui("Unpin navigation") : ui("Keep navigation open")
            }
            aria-pressed={pinned}
            title={ui(
              "Pin to keep the sidebar open. Unpin to expand it on hover."
            )}
            className={cn(
              "studio-help-anchor p-1.5 rounded-md text-foreground/70 hover:text-primary",
              collapsed ? "hidden" : "hidden lg:flex"
            )}
            data-help={ui(
              "Pin to keep the sidebar open. Unpin to expand it on hover."
            )}
          >
            {pinned ? (
              <Lock className="h-4 w-4 text-primary" />
            ) : (
              <Unlock className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label={ui("Close navigation")}
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
                className={cn(
                  "border-t border-border",
                  item.compact
                    ? "mx-1 my-1"
                    : "mt-2 h-7 px-3 pt-2 text-[11px] font-medium text-foreground/70"
                )}
              >
                {!collapsed && item.label}
              </div>
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
                  title={collapsed ? ui("Create") : undefined}
                >
                  <Sparkles className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed ? (
                    <>
                      <span className="flex-1 text-left">
                        {ui("Generate media")}
                      </span>
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
                      label={ui("Video")}
                      to="/dashboard/video"
                      active={path.startsWith("/dashboard/video")}
                    />
                    <SidebarItem
                      icon={Images}
                      label={ui("Images")}
                      to="/dashboard/image"
                      active={path.startsWith("/dashboard/image")}
                    />
                    <SidebarItem
                      icon={Mic}
                      label={ui("Audio")}
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
                label={ui(item.label)}
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

        <div className="relative h-[78px] shrink-0 border-t border-border px-3 py-2">
          <div className={collapsed ? "invisible" : "visible"}>
            <BrandSwitcher />
          </div>
          {collapsed && (
            <Building2
              aria-hidden
              className="absolute left-5 top-7 size-4 text-muted-foreground"
            />
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
            aria-label={ui("Open navigation")}
            className="lg:hidden p-2 -ml-2"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="mono-eyebrow text-foreground/70 hidden sm:block">
            {ui(
              path === "/dashboard"
                ? "Dashboard"
                : path.split("/")[2]?.replaceAll("-", " ") || "Studio"
            )}
          </span>
          <div className="flex-1" />
          <FirstVisitTour />
          <PageGuideButton compact />
          <CreditBalanceChip refreshKey={path} />
          <StudioMediaTray key={path} />
          <Link
            to="/dashboard#recent-activity"
            aria-label={ui("Recent activity")}
            className="p-2 text-foreground/70"
          >
            <Bell className="h-[18px] w-[18px]" />
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            data-theme-control
            aria-label={
              theme === "light" ? ui("Use dark theme") : ui("Use light theme")
            }
            className="p-2 text-foreground/70"
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>
          <LanguagePicker compact />
        </header>

        <main className="studio-main flex-1 min-w-0 w-full">
          <Suspense fallback={<StudioPageFallback />}>
            {workspaceLoading ? (
              <StudioPageFallback />
            ) : (
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
                  <Route path="/styles" element={<StylesPage />} />
                  <Route
                    path="/trends"
                    element={<Navigate to="/dashboard/styles" replace />}
                  />
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
                  <Route path="/billing" element={<BillingPage />} />
                  <Route path="/feedback" element={<FeedbackPage />} />
                  <Route path="/status" element={<StudioStatus />} />
                  <Route
                    path="*"
                    element={<Navigate to="/dashboard" replace />}
                  />
                </Routes>
              </div>
            )}
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
