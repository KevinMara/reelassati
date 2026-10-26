import { useUiText } from "@/lib/i18n/ui";
import { BrandSwitcher } from "@/components/studio/BrandSwitcher";
import { useMemo, useState, type FormEvent } from "react";
import {
  Captions,
  CheckCircle2,
  Loader2,
  Palette,
  Save,
  SlidersHorizontal,
  Target,
  Type,
  Volume2,
} from "lucide-react";
import type { BrandKit } from "@contracts/workspace";
import { useWorkspace } from "@/providers/workspace";

const CAPTION_PRESETS: Array<{
  value: BrandKit["captionPreset"];
  label: string;
  detail: string;
}> = [
  {
    value: "kinetic",
    label: "Kinetic",
    detail: "Fast emphasis for high-energy cuts",
  },
  {
    value: "editorial",
    label: "Editorial",
    detail: "Structured, premium hierarchy",
  },
  {
    value: "minimal",
    label: "Minimal",
    detail: "Quiet typography with fewer distractions",
  },
];

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export default function ClientsPage() {
  const ui = useUiText();
  const { workspace, updateWorkspace, loading, saving } = useWorkspace();
  const [edits, setEdits] = useState<Partial<BrandKit>>({});
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const draft = useMemo(
    () => ({ ...workspace.brandKit, ...edits }),
    [edits, workspace.brandKit]
  );
  const dirty = Object.keys(edits).length > 0;

  const readiness = useMemo(() => {
    const checks = [
      Boolean(draft.name.trim()),
      draft.voice.trim().length >= 20,
      draft.audience.trim().length >= 20,
      COLOR_PATTERN.test(draft.primaryColor),
      COLOR_PATTERN.test(draft.accentColor),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [draft]);

  const updateDraft = <Key extends keyof BrandKit>(
    key: Key,
    value: BrandKit[Key]
  ) => {
    setEdits(current => ({ ...current, [key]: value }));
    setNotice(null);
  };

  const saveBrandKit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !COLOR_PATTERN.test(draft.primaryColor)) {
      setNotice({
        tone: "error",
        message: "Add a brand name and use six-digit hexadecimal colors.",
      });
      return;
    }
    if (!COLOR_PATTERN.test(draft.accentColor)) {
      setNotice({
        tone: "error",
        message: "The accent color must use a six-digit hexadecimal value.",
      });
      return;
    }

    try {
      const next: BrandKit = {
        ...draft,
        name: draft.name.trim(),
        voice: draft.voice.trim(),
        audience: draft.audience.trim(),
        font: draft.font.trim() || "Geist",
        safeZone: Math.min(25, Math.max(0, draft.safeZone)),
        audioDucking: Math.min(100, Math.max(0, draft.audioDucking)),
      };
      await updateWorkspace(current => ({ ...current, brandKit: next }));
      setEdits({});
      setNotice({
        tone: "success",
        message: "Brand DNA saved. New scripts and edits can now use it.",
      });
    } catch (cause) {
      setNotice({
        tone: "error",
        message:
          cause instanceof Error
            ? cause.message
            : "Brand DNA could not be saved.",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {ui("Brand DNA")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/70">
            {ui("Save your voice, audience, colors, and caption style.")}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <p className="text-muted-foreground">{ui("Definition depth")}</p>
          <p className="font-semibold tabular-nums text-primary">
            {readiness}%
          </p>
        </div>
      </div>
      <BrandSwitcher manage compact />

      {notice ? (
        <div
          role="status"
          className={`mb-5 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            notice.tone === "error"
              ? "border-red-500/20 bg-red-500/5 text-red-600"
              : "border-emerald-500/20 bg-emerald-500/5 text-emerald-600"
          }`}
        >
          {notice.tone === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : null}
          {notice.message}
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <form
          onSubmit={saveBrandKit}
          className="space-y-5 rounded-lg border border-border bg-surface p-4 sm:p-5"
        >
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h2 className="font-medium">{ui("Positioning")}</h2>
            </div>
            <div className="grid gap-4">
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">
                  {ui("Brand name")}
                </span>
                <input
                  value={draft.name}
                  onChange={event => updateDraft("name", event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={ui("Your public-facing brand")}
                  required
                />
              </label>
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">
                  {ui("Voice rules")}
                </span>
                <textarea
                  value={draft.voice}
                  onChange={event => updateDraft("voice", event.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-lg border border-border bg-background px-4 py-2.5 leading-relaxed outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={ui(
                    "How the brand speaks, phrases it avoids, energy level, point of view, and proof style"
                  )}
                />
                <span className="mt-1.5 block text-xs text-foreground/70">
                  {ui(
                    "Be concrete enough that an editor can reject an off-brand line."
                  )}
                </span>
              </label>
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">
                  {ui("Audience tension")}
                </span>
                <textarea
                  value={draft.audience}
                  onChange={event =>
                    updateDraft("audience", event.target.value)
                  }
                  rows={3}
                  className="w-full resize-y rounded-lg border border-border bg-background px-4 py-2.5 leading-relaxed outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={ui(
                    "Who this is for, what they already believe, and what problem creates urgency"
                  )}
                />
              </label>
            </div>
          </section>

          <section className="border-t border-border pt-5">
            <div className="mb-4 flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <h2 className="font-medium">{ui("Visual system")}</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">
                  {ui("Primary color")}
                </span>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={
                      COLOR_PATTERN.test(draft.primaryColor)
                        ? draft.primaryColor
                        : "#6F5AD8"
                    }
                    onChange={event =>
                      updateDraft(
                        "primaryColor",
                        event.target.value.toUpperCase()
                      )
                    }
                    className="h-10 w-12 rounded-lg border border-border bg-background p-1"
                    aria-label={ui("Choose primary color")}
                  />
                  <input
                    value={draft.primaryColor}
                    onChange={event =>
                      updateDraft("primaryColor", event.target.value)
                    }
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs uppercase"
                    aria-label={ui("Primary color hexadecimal value")}
                  />
                </div>
              </label>
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">
                  {ui("Accent color")}
                </span>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={
                      COLOR_PATTERN.test(draft.accentColor)
                        ? draft.accentColor
                        : "#D8FF4F"
                    }
                    onChange={event =>
                      updateDraft(
                        "accentColor",
                        event.target.value.toUpperCase()
                      )
                    }
                    className="h-10 w-12 rounded-lg border border-border bg-background p-1"
                    aria-label={ui("Choose accent color")}
                  />
                  <input
                    value={draft.accentColor}
                    onChange={event =>
                      updateDraft("accentColor", event.target.value)
                    }
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs uppercase"
                    aria-label={ui("Accent color hexadecimal value")}
                  />
                </div>
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1.5 flex items-center gap-1.5 font-medium">
                  <Type className="h-3.5 w-3.5" /> {ui("Brand typeface")}
                </span>
                <input
                  value={draft.font}
                  onChange={event => updateDraft("font", event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5"
                  placeholder="Geist"
                />
              </label>
            </div>
          </section>

          <section className="border-t border-border pt-5">
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <h2 className="font-medium">{ui("Editing defaults")}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {CAPTION_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => updateDraft("captionPreset", preset.value)}
                  aria-pressed={draft.captionPreset === preset.value}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    draft.captionPreset === preset.value
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-primary/35"
                  }`}
                >
                  <Captions className="h-4 w-4 text-primary" />
                  <span className="mt-2 block text-sm font-medium">
                    {ui(preset.label)}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-foreground/70">
                    {preset.detail}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label
                htmlFor="client-safe-zone"
                aria-label={ui("Safe-zone inset")}
                className="text-sm"
              >
                <span className="mb-2 flex items-center justify-between">
                  <span className="font-medium">{ui("Safe-zone inset")}</span>
                  <span className="font-mono text-xs text-primary">
                    {draft.safeZone}%
                  </span>
                </span>
                <input
                  id="client-safe-zone"
                  type="range"
                  min="0"
                  max="25"
                  value={draft.safeZone}
                  onChange={event =>
                    updateDraft("safeZone", Number(event.target.value))
                  }
                  className="w-full accent-primary"
                />
              </label>
              <label
                htmlFor="client-audio-ducking"
                aria-label={ui("Voice ducking")}
                className="text-sm"
              >
                <span className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Volume2 className="h-3.5 w-3.5" /> {ui("Voice ducking")}
                  </span>
                  <span className="font-mono text-xs text-primary">
                    {draft.audioDucking}%
                  </span>
                </span>
                <input
                  id="client-audio-ducking"
                  type="range"
                  min="0"
                  max="100"
                  value={draft.audioDucking}
                  onChange={event =>
                    updateDraft("audioDucking", Number(event.target.value))
                  }
                  className="w-full accent-primary"
                />
              </label>
            </div>
          </section>

          <div className="flex items-center justify-between border-t border-border pt-5">
            <span className="text-xs text-foreground/70">
              {dirty
                ? ui("Unsaved Brand DNA changes")
                : ui("Brand DNA is saved")}
            </span>
            <button
              type="submit"
              disabled={!dirty || saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {ui("Save Brand DNA")}
            </button>
          </div>
        </form>

        <aside className="space-y-5">
          <div className="overflow-hidden rounded-lg border border-border bg-surface lg:sticky lg:top-5">
            <div
              className="relative aspect-[4/3] p-5"
              style={{
                background: `linear-gradient(145deg, ${draft.primaryColor} 0%, #15131c 68%)`,
              }}
            >
              <div
                className="absolute right-5 top-5 h-3 w-3 rounded-full"
                style={{ backgroundColor: draft.accentColor }}
              />
              <div className="flex h-full flex-col justify-end">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/55">
                  {ui("Live constraint preview")}
                </p>
                <p
                  className={`mt-3 max-w-[15rem] text-white ${
                    draft.captionPreset === "kinetic"
                      ? "text-2xl font-bold uppercase leading-tight"
                      : draft.captionPreset === "editorial"
                        ? "text-2xl font-medium leading-tight"
                        : "text-xl font-medium leading-snug"
                  }`}
                  style={{ fontFamily: draft.font || "Geist" }}
                >
                  {ui("Make every frame earn the next one.")}
                </p>
                <div
                  className="mt-4 h-1 rounded-full"
                  style={{
                    width: `${100 - draft.safeZone * 2}%`,
                    backgroundColor: draft.accentColor,
                  }}
                />
              </div>
            </div>
            <div className="p-4">
              <h2 className="font-medium">{draft.name || "Unnamed brand"}</h2>
              <p className="mt-1 text-xs leading-relaxed text-foreground/70">
                {draft.audience ||
                  "Define the audience tension to make creative decisions more specific."}
              </p>
              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {ui("Projects")}
                  </dt>
                  <dd className="mt-1 font-semibold">
                    {workspace.projects.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {ui("Assets")}
                  </dt>
                  <dd className="mt-1 font-semibold">
                    {workspace.assets.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {ui("Scripts")}
                  </dt>
                  <dd className="mt-1 font-semibold">
                    {workspace.scripts.length}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
