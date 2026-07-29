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
  const { workspace, updateWorkspace, loading, saving } = useWorkspace();
  const [edits, setEdits] = useState<Partial<BrandKit>>({});
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const draft = useMemo(
    () => ({ ...workspace.brandKit, ...edits }),
    [edits, workspace.brandKit],
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
    value: BrandKit[Key],
  ) => {
    setEdits((current) => ({ ...current, [key]: value }));
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
      await updateWorkspace((current) => ({ ...current, brandKit: next }));
      setEdits({});
      setNotice({
        tone: "success",
        message: "Brand DNA saved. New scripts and edits can now use it.",
      });
    } catch (cause) {
      setNotice({
        tone: "error",
        message: cause instanceof Error ? cause.message : "Brand DNA could not be saved.",
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
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono-eyebrow mb-2 text-primary">Reusable creative memory</p>
          <h1 className="text-3xl font-semibold">Brand DNA</h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/55">
            One truthful source of creative constraints for this workspace. Multi-brand
            client workspaces are not simulated here.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-right">
          <p className="mono-eyebrow text-[10px] text-foreground/45">Definition depth</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{readiness}%</p>
        </div>
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
        <form
          onSubmit={saveBrandKit}
          className="space-y-7 rounded-xl border border-border bg-surface p-6"
        >
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h2 className="font-medium">Positioning</h2>
            </div>
            <div className="grid gap-4">
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">Brand name</span>
                <input
                  value={draft.name}
                  onChange={(event) => updateDraft("name", event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Your public-facing brand"
                  required
                />
              </label>
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">Voice rules</span>
                <textarea
                  value={draft.voice}
                  onChange={(event) => updateDraft("voice", event.target.value)}
                  rows={4}
                  className="w-full resize-y rounded-lg border border-border bg-background px-4 py-2.5 leading-relaxed outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="How the brand speaks, phrases it avoids, energy level, point of view, and proof style"
                />
                <span className="mt-1.5 block text-xs text-foreground/45">
                  Be concrete enough that an editor can reject an off-brand line.
                </span>
              </label>
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">Audience tension</span>
                <textarea
                  value={draft.audience}
                  onChange={(event) => updateDraft("audience", event.target.value)}
                  rows={4}
                  className="w-full resize-y rounded-lg border border-border bg-background px-4 py-2.5 leading-relaxed outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Who this is for, what they already believe, and what problem creates urgency"
                />
              </label>
            </div>
          </section>

          <section className="border-t border-border pt-7">
            <div className="mb-4 flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <h2 className="font-medium">Visual system</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">Primary color</span>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={
                      COLOR_PATTERN.test(draft.primaryColor)
                        ? draft.primaryColor
                        : "#6F5AD8"
                    }
                    onChange={(event) =>
                      updateDraft("primaryColor", event.target.value.toUpperCase())
                    }
                    className="h-10 w-12 rounded-lg border border-border bg-background p-1"
                    aria-label="Choose primary color"
                  />
                  <input
                    value={draft.primaryColor}
                    onChange={(event) =>
                      updateDraft("primaryColor", event.target.value)
                    }
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs uppercase"
                    aria-label="Primary color hexadecimal value"
                  />
                </div>
              </label>
              <label className="text-sm">
                <span className="mb-1.5 block font-medium">Accent color</span>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={
                      COLOR_PATTERN.test(draft.accentColor)
                        ? draft.accentColor
                        : "#D8FF4F"
                    }
                    onChange={(event) =>
                      updateDraft("accentColor", event.target.value.toUpperCase())
                    }
                    className="h-10 w-12 rounded-lg border border-border bg-background p-1"
                    aria-label="Choose accent color"
                  />
                  <input
                    value={draft.accentColor}
                    onChange={(event) =>
                      updateDraft("accentColor", event.target.value)
                    }
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs uppercase"
                    aria-label="Accent color hexadecimal value"
                  />
                </div>
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1.5 flex items-center gap-1.5 font-medium">
                  <Type className="h-3.5 w-3.5" /> Brand typeface
                </span>
                <input
                  value={draft.font}
                  onChange={(event) => updateDraft("font", event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5"
                  placeholder="Geist"
                />
              </label>
            </div>
          </section>

          <section className="border-t border-border pt-7">
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <h2 className="font-medium">Editing defaults</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {CAPTION_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => updateDraft("captionPreset", preset.value)}
                  aria-pressed={draft.captionPreset === preset.value}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    draft.captionPreset === preset.value
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-primary/35"
                  }`}
                >
                  <Captions className="h-4 w-4 text-primary" />
                  <span className="mt-3 block text-sm font-medium">{preset.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-foreground/45">
                    {preset.detail}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-2 flex items-center justify-between">
                  <span className="font-medium">Safe-zone inset</span>
                  <span className="font-mono text-xs text-primary">{draft.safeZone}%</span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="25"
                  value={draft.safeZone}
                  onChange={(event) =>
                    updateDraft("safeZone", Number(event.target.value))
                  }
                  className="w-full accent-primary"
                />
              </label>
              <label className="text-sm">
                <span className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Volume2 className="h-3.5 w-3.5" /> Voice ducking
                  </span>
                  <span className="font-mono text-xs text-primary">
                    {draft.audioDucking}%
                  </span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={draft.audioDucking}
                  onChange={(event) =>
                    updateDraft("audioDucking", Number(event.target.value))
                  }
                  className="w-full accent-primary"
                />
              </label>
            </div>
          </section>

          <div className="flex items-center justify-between border-t border-border pt-5">
            <span className="text-xs text-foreground/45">
              {dirty ? "Unsaved Brand DNA changes" : "Brand DNA is saved"}
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
              Save Brand DNA
            </button>
          </div>
        </form>

        <aside className="space-y-5">
          <div className="sticky top-6 overflow-hidden rounded-xl border border-border bg-surface">
            <div
              className="relative aspect-[9/12] p-6"
              style={{
                background: `linear-gradient(145deg, ${draft.primaryColor} 0%, #15131c 68%)`,
              }}
            >
              <div
                className="absolute right-5 top-5 h-3 w-3 rounded-full"
                style={{ backgroundColor: draft.accentColor }}
              />
              <div className="flex h-full flex-col justify-end">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
                  Live constraint preview
                </p>
                <p
                  className={`mt-3 max-w-[15rem] text-white ${
                    draft.captionPreset === "kinetic"
                      ? "text-3xl font-black uppercase leading-[0.92]"
                      : draft.captionPreset === "editorial"
                        ? "text-3xl font-medium leading-tight"
                        : "text-2xl font-medium leading-snug"
                  }`}
                  style={{ fontFamily: draft.font || "Geist" }}
                >
                  Make every frame earn the next one.
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
            <div className="p-5">
              <h2 className="font-medium">{draft.name || "Unnamed brand"}</h2>
              <p className="mt-1 text-xs leading-relaxed text-foreground/50">
                {draft.audience ||
                  "Define the audience tension to make creative decisions more specific."}
              </p>
              <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-background p-3">
                  <dt className="text-[10px] uppercase tracking-wide text-foreground/40">
                    Projects
                  </dt>
                  <dd className="mt-1 font-semibold">{workspace.projects.length}</dd>
                </div>
                <div className="rounded-lg bg-background p-3">
                  <dt className="text-[10px] uppercase tracking-wide text-foreground/40">
                    Assets
                  </dt>
                  <dd className="mt-1 font-semibold">{workspace.assets.length}</dd>
                </div>
                <div className="rounded-lg bg-background p-3">
                  <dt className="text-[10px] uppercase tracking-wide text-foreground/40">
                    Scripts
                  </dt>
                  <dd className="mt-1 font-semibold">{workspace.scripts.length}</dd>
                </div>
              </dl>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
