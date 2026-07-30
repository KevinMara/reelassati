import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Bot,
  Captions,
  CheckCircle2,
  CloudUpload,
  Database,
  Globe2,
  Loader2,
  Moon,
  Palette,
  Radio,
  Save,
  Settings2,
  Sun,
  User,
  Video,
  Volume2,
} from "lucide-react";
import type { BrandKit, WorkspaceProfile } from "@contracts/workspace";
import { useTheme } from "@/hooks/useTheme";
import { useWorkspace } from "@/providers/workspace";
import { WRITING_LANGUAGES } from "@/lib/languages";

type Tab = "profile" | "brand" | "appearance" | "integrations";

const TABS: Array<{ id: Tab; label: string; icon: typeof User }> = [
  { id: "profile", label: "Studio profile", icon: User },
  { id: "brand", label: "Brand DNA", icon: Palette },
  { id: "appearance", label: "Appearance", icon: Sun },
  { id: "integrations", label: "Capabilities", icon: Settings2 },
];

const COMMON_TIMEZONES = [
  "Europe/Rome",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

export default function SettingsPage() {
  const { i18n } = useTranslation();
  const {
    workspace,
    capabilities,
    updateWorkspace,
    loading,
    saving,
  } = useWorkspace();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [profileEdits, setProfileEdits] = useState<Partial<WorkspaceProfile>>({});
  const [brandEdits, setBrandEdits] = useState<Partial<BrandKit>>({});
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const profileDraft = useMemo(
    () => ({ ...workspace.profile, ...profileEdits }),
    [profileEdits, workspace.profile],
  );
  const brandDraft = useMemo(
    () => ({ ...workspace.brandKit, ...brandEdits }),
    [brandEdits, workspace.brandKit],
  );
  const profileDirty = Object.keys(profileEdits).length > 0;
  const brandDirty = Object.keys(brandEdits).length > 0;

  const timezones = useMemo(
    () => Array.from(new Set([profileDraft.timezone, ...COMMON_TIMEZONES])).filter(Boolean),
    [profileDraft.timezone],
  );

  const setProfileField = <Key extends keyof WorkspaceProfile>(
    key: Key,
    value: WorkspaceProfile[Key],
  ) => {
    setProfileEdits((current) => ({ ...current, [key]: value }));
    setNotice(null);
  };

  const setBrandField = <Key extends keyof BrandKit>(
    key: Key,
    value: BrandKit[Key],
  ) => {
    setBrandEdits((current) => ({ ...current, [key]: value }));
    setNotice(null);
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!profileDraft.name.trim() || !profileDraft.workspaceName.trim()) {
      setNotice({
        tone: "error",
        message: "Name and studio name are required.",
      });
      return;
    }
    try {
      const next: WorkspaceProfile = {
        ...profileDraft,
        name: profileDraft.name.trim(),
        workspaceName: profileDraft.workspaceName.trim(),
        email: workspace.profile.email,
      };
      await updateWorkspace((current) => ({ ...current, profile: next }));
      await i18n.changeLanguage(next.language);
      setProfileEdits({});
      setNotice({ tone: "success", message: "Studio profile saved." });
    } catch (cause) {
      setNotice({
        tone: "error",
        message: cause instanceof Error ? cause.message : "Profile could not be saved.",
      });
    }
  };

  const saveBrand = async (event: FormEvent) => {
    event.preventDefault();
    if (!brandDraft.name.trim()) {
      setNotice({ tone: "error", message: "Brand name is required." });
      return;
    }
    try {
      const next: BrandKit = {
        ...brandDraft,
        name: brandDraft.name.trim(),
        voice: brandDraft.voice.trim(),
        audience: brandDraft.audience.trim(),
        font: brandDraft.font.trim() || "Geist",
        safeZone: Math.max(0, Math.min(25, brandDraft.safeZone)),
        audioDucking: Math.max(0, Math.min(100, brandDraft.audioDucking)),
      };
      await updateWorkspace((current) => ({ ...current, brandKit: next }));
      setBrandEdits({});
      setNotice({ tone: "success", message: "Brand defaults saved." });
    } catch (cause) {
      setNotice({
        tone: "error",
        message:
          cause instanceof Error ? cause.message : "Brand defaults could not be saved.",
      });
    }
  };

  const capabilityRows = [
    {
      label: "Workspace database",
      detail: "Projects, scripts, revisions, goals, and settings",
      ready: capabilities.persistence,
      icon: Database,
    },
    {
      label: "Private media storage",
      detail: "Uploaded and generated video, image, and audio",
      ready: capabilities.uploads,
      icon: CloudUpload,
    },
    {
      label: "Writing and edit intelligence",
      detail: "Kimi and OpenRouter-assisted creative workflows",
      ready: capabilities.ai,
      icon: Bot,
    },
    {
      label: "Transcription",
      detail: "Speech-to-text for footage and voice notes",
      ready: capabilities.transcription,
      icon: Captions,
    },
    {
      label: "Voice generation",
      detail: "Generated narration assets",
      ready: capabilities.speech,
      icon: Volume2,
    },
    {
      label: "Video generation",
      detail: "Controlled Kling video jobs",
      ready: capabilities.videoGeneration,
      icon: Video,
    },
    {
      label: "Publishing",
      detail: "Zernio account connection and distribution",
      ready: capabilities.publishing,
      icon: Radio,
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <p className="mono-eyebrow mb-2 text-primary">Workspace control</p>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-foreground/55">
          Saved studio preferences and live capability checks.
        </p>
      </div>

      {notice ? (
        <div
          role="status"
          className={`mb-5 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            notice.tone === "error"
              ? "border-red-500/20 bg-red-500/5 text-red-600"
              : "border-emerald-500/20 bg-emerald-500/5 text-emerald-600"
          }`}
        >
          {notice.tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : null}
          {notice.message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Settings">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setNotice(null);
              }}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors lg:w-full ${
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/60 hover:bg-surface hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>

        <div>
          {activeTab === "profile" ? (
            <form
              onSubmit={saveProfile}
              className="space-y-5 rounded-xl border border-border bg-surface p-6"
            >
              <div>
                <h2 className="text-lg font-medium">Studio profile</h2>
                <p className="mt-1 text-sm text-foreground/50">
                  The owner email comes from the authenticated private site session.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1.5 block font-medium">Your name</span>
                  <input
                    value={profileDraft.name}
                    onChange={(event) => setProfileField("name", event.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5"
                    required
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1.5 block font-medium">Studio name</span>
                  <input
                    value={profileDraft.workspaceName}
                    onChange={(event) =>
                      setProfileField("workspaceName", event.target.value)
                    }
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5"
                    required
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1.5 block font-medium">Owner email</span>
                  <input
                    value={workspace.profile.email}
                    readOnly
                    className="w-full cursor-not-allowed rounded-lg border border-border bg-foreground/[0.03] px-4 py-2.5 text-foreground/50"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1.5 block font-medium">Interface language</span>
                  <select
                    value={profileDraft.language}
                    onChange={(event) =>
                      setProfileField(
                        "language",
                        event.target.value as WorkspaceProfile["language"],
                      )
                    }
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5"
                  >
                    <option value="en">English</option>
                    <option value="it">Italiano</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1.5 block font-medium">
                    Default creation language
                  </span>
                  <select
                    value={profileDraft.contentLanguage}
                    onChange={(event) =>
                      setProfileField("contentLanguage", event.target.value)
                    }
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5"
                  >
                    {WRITING_LANGUAGES.map((language) => (
                      <option key={language.code} value={language.code}>
                        {language.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1.5 block font-medium">Publishing timezone</span>
                  <select
                    value={profileDraft.timezone}
                    onChange={(event) =>
                      setProfileField("timezone", event.target.value)
                    }
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5"
                  >
                    {timezones.map((timezone) => (
                      <option key={timezone} value={timezone}>
                        {timezone}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-5">
                <span className="text-xs text-foreground/45">
                  {profileDirty ? "Unsaved profile changes" : "Profile is saved"}
                </span>
                <button
                  type="submit"
                  disabled={!profileDirty || saving}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white disabled:opacity-45"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save profile
                </button>
              </div>
            </form>
          ) : null}

          {activeTab === "brand" ? (
            <form
              onSubmit={saveBrand}
              className="space-y-5 rounded-xl border border-border bg-surface p-6"
            >
              <div>
                <h2 className="text-lg font-medium">Brand defaults</h2>
                <p className="mt-1 text-sm text-foreground/50">
                  These constraints are reusable across scripts, AI plans, and edits.
                </p>
              </div>
              <div className="grid gap-4">
                <label className="text-sm">
                  <span className="mb-1.5 block font-medium">Brand name</span>
                  <input
                    value={brandDraft.name}
                    onChange={(event) => setBrandField("name", event.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5"
                    required
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1.5 block font-medium">Voice rules</span>
                  <textarea
                    value={brandDraft.voice}
                    onChange={(event) => setBrandField("voice", event.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5"
                    placeholder="Specific language, energy, point of view, and phrases to avoid"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1.5 block font-medium">Audience</span>
                  <textarea
                    value={brandDraft.audience}
                    onChange={(event) =>
                      setBrandField("audience", event.target.value)
                    }
                    rows={4}
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5"
                    placeholder="Who they are, what they believe, and what creates urgency"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1.5 block font-medium">Typeface</span>
                    <input
                      value={brandDraft.font}
                      onChange={(event) => setBrandField("font", event.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1.5 block font-medium">Caption preset</span>
                    <select
                      value={brandDraft.captionPreset}
                      onChange={(event) =>
                        setBrandField(
                          "captionPreset",
                          event.target.value as BrandKit["captionPreset"],
                        )
                      }
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5"
                    >
                      <option value="kinetic">Kinetic</option>
                      <option value="editorial">Editorial</option>
                      <option value="minimal">Minimal</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1.5 block font-medium">Primary color</span>
                    <input
                      type="color"
                      value={brandDraft.primaryColor}
                      onChange={(event) =>
                        setBrandField("primaryColor", event.target.value)
                      }
                      className="h-11 w-full rounded-lg border border-border bg-background p-1"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1.5 block font-medium">Accent color</span>
                    <input
                      type="color"
                      value={brandDraft.accentColor}
                      onChange={(event) =>
                        setBrandField("accentColor", event.target.value)
                      }
                      className="h-11 w-full rounded-lg border border-border bg-background p-1"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1.5 flex justify-between font-medium">
                      Safe zone <span>{brandDraft.safeZone}%</span>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="25"
                      value={brandDraft.safeZone}
                      onChange={(event) =>
                        setBrandField("safeZone", Number(event.target.value))
                      }
                      className="w-full accent-primary"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1.5 flex justify-between font-medium">
                      Audio ducking <span>{brandDraft.audioDucking}%</span>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={brandDraft.audioDucking}
                      onChange={(event) =>
                        setBrandField("audioDucking", Number(event.target.value))
                      }
                      className="w-full accent-primary"
                    />
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-5">
                <Link
                  to="/dashboard/clients"
                  className="text-xs font-medium text-primary"
                >
                  Open the full Brand DNA editor
                </Link>
                <button
                  type="submit"
                  disabled={!brandDirty || saving}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white disabled:opacity-45"
                >
                  <Save className="h-4 w-4" /> Save defaults
                </button>
              </div>
            </form>
          ) : null}

          {activeTab === "appearance" ? (
            <section className="space-y-6 rounded-xl border border-border bg-surface p-6">
              <div>
                <h2 className="text-lg font-medium">Appearance</h2>
                <p className="mt-1 text-sm text-foreground/50">
                  Theme preference is kept in this browser.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    if (theme === "dark") toggleTheme();
                  }}
                  aria-pressed={theme === "light"}
                  className={`rounded-xl border p-5 text-left ${
                    theme === "light"
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background"
                  }`}
                >
                  <Sun className="h-5 w-5 text-primary" />
                  <span className="mt-3 block text-sm font-medium">Light</span>
                  <span className="mt-1 block text-xs text-foreground/45">
                    Warm paper surfaces and high-contrast controls.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (theme === "light") toggleTheme();
                  }}
                  aria-pressed={theme === "dark"}
                  className={`rounded-xl border p-5 text-left ${
                    theme === "dark"
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background"
                  }`}
                >
                  <Moon className="h-5 w-5 text-primary" />
                  <span className="mt-3 block text-sm font-medium">Dark</span>
                  <span className="mt-1 block text-xs text-foreground/45">
                    Low-glare editing surfaces for longer sessions.
                  </span>
                </button>
              </div>
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Language and timezone</p>
                </div>
                <p className="mt-1 text-xs text-foreground/45">
                  Edit these under Studio profile so interface and publishing settings
                  stay in one saved record.
                </p>
              </div>
            </section>
          ) : null}

          {activeTab === "integrations" ? (
            <section className="rounded-xl border border-border bg-surface p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">Configured capabilities</h2>
                  <p className="mt-1 text-sm text-foreground/50">
                    These checks confirm deployed bindings and keys are present.
                    The first real request verifies each external service.
                  </p>
                </div>
                <Link
                  to="/dashboard/status"
                  className="text-sm font-medium text-primary"
                >
                  Open studio status
                </Link>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {capabilityRows.map((row) => (
                  <article
                    key={row.label}
                    className="rounded-xl border border-border bg-background p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <row.icon className="h-5 w-5 text-primary" />
                      <span
                        className={`rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-wide ${
                          row.ready
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {row.ready ? "Configured" : "Setup needed"}
                      </span>
                    </div>
                    <h3 className="mt-4 text-sm font-medium">{row.label}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-foreground/45">
                      {row.detail}
                    </p>
                  </article>
                ))}
              </div>
              {capabilities.missing.length ? (
                <div className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                  <p className="text-xs font-medium text-amber-700">
                    Missing environment configuration
                  </p>
                  <p className="mt-1 break-words font-mono text-[11px] text-foreground/55">
                    {capabilities.missing.join(", ")}
                  </p>
                </div>
              ) : null}
              <div className="mt-5 border-t border-border pt-5">
                <Link
                  to="/dashboard/social"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary"
                >
                  <Radio className="h-4 w-4" /> Manage publishing accounts
                </Link>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
