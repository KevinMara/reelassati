import { useUiText } from "@/lib/i18n/ui";
import { useState } from "react";
import {
  getCaptionPreset,
  type CaptionAppearance,
  type CaptionAnimation,
} from "@contracts/editor-presets";
import { CaptionStylePreview } from "./CaptionStylePreview";
import { CompactSelect } from "@/components/ui/compact-select";
import { EditorInfo } from "./EditorInfo";

export function CaptionAppearanceEditor({
  presetId,
  appearance,
  sample,
  onApply,
}: {
  presetId?: string;
  appearance?: CaptionAppearance;
  sample: string;
  onApply: (appearance: CaptionAppearance) => Promise<void>;
}) {
  const ui = useUiText();
  const [draft, setDraft] = useState<CaptionAppearance>(appearance ?? {});
  const [busy, setBusy] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const p = getCaptionPreset(presetId, draft);
  const patch = (value: CaptionAppearance) =>
    setDraft(d => ({ ...d, ...value }));
  return (
    <section
      className="space-y-3 rounded-xl border border-border p-3"
      aria-label={ui("Customize captions")}
    >
      <h3 className="flex items-center text-sm font-semibold">
        {ui("Customize captions")}
        <EditorInfo label={ui("Caption safe area")}>
          {ui(
            "Size is a percentage of video width. Safe margin keeps captions away from social-player controls. Preview and export use these same settings. Burned-in source captions cannot be restyled here."
          )}
        </EditorInfo>
      </h3>
      <CaptionStylePreview
        presetId={presetId}
        appearance={draft}
        animate={previewPlaying}
      />
      <button
        type="button"
        aria-pressed={previewPlaying}
        onClick={() => setPreviewPlaying(v => !v)}
        className="rounded-lg border border-border px-3 py-2 text-xs"
      >
        {previewPlaying ? ui("Pause style sample") : ui("Play style sample")}
      </button>
      {sample && (
        <p className="truncate text-xs text-foreground/60">
          {ui("Current text:")} {sample}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ["color", "Text color"],
            ["outlineColor", "Outline color"],
            ["activeColor", "Active word color"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-xs text-foreground/70">
            {label}
            <input
              type="color"
              value={p[key]}
              onChange={e => patch({ [key]: e.target.value })}
              className="mt-1 block h-8 w-full rounded-md border border-border"
            />
          </label>
        ))}
      </div>
      <CompactSelect
        aria-label={ui("Caption animation")}
        value={p.animation}
        onValueChange={animation =>
          patch({ animation: animation as CaptionAnimation })
        }
        options={[
          { value: "none", label: "Whole phrase" },
          { value: "active-word", label: "Highlight spoken word" },
          { value: "word-reveal", label: "Reveal words as spoken" },
          { value: "word-only", label: "One word at a time" },
          { value: "word-pulse", label: "Pulse with speech" },
          { value: "word-pop", label: "Pop each spoken word" },
          { value: "word-slide", label: "Raise each spoken word" },
          { value: "word-fade", label: "Fade each spoken word" },
          { value: "word-type", label: "Type each spoken word" },
        ]}
      />
      {p.animation !== "none" && (
        <p className="text-sm text-foreground/65">
          {ui(
            "Uses measured word timings from transcription. Imported subtitles or edited lines without word timings display the whole phrase."
          )}
        </p>
      )}
      <CompactSelect
        aria-label={ui("Caption position")}
        value={p.position}
        onValueChange={position =>
          patch({ position: position as "top" | "bottom" })
        }
        options={[
          { value: "bottom", label: "Lower frame" },
          { value: "top", label: "Upper frame" },
        ]}
      />
      {(
        [
          ["size", "Text size", 2, 12, 0.1],
          ["margin", "Safe margin", 2, 40, 1],
          ["outline", "Outline / label padding", 0, 2, 0.05],
          ["maxCharacters", "Characters per line", 12, 64, 1],
        ] as const
      ).map(([key, label, min, max, step]) => (
        <label key={key} className="block text-xs">
          <span className="flex justify-between">
            <span>{label}</span>
            <span className="font-mono text-foreground/60">
              {Number(p[key].toFixed(2))}
              {key === "size" || key === "margin" ? "%" : ""}
            </span>
          </span>
          <input
            type="range"
            aria-label={label}
            value={p[key]}
            min={min}
            max={max}
            step={step}
            onChange={e => patch({ [key]: Number(e.target.value) })}
            className="mt-2 w-full accent-primary"
          />
        </label>
      ))}
      <div className="flex flex-wrap gap-3 text-xs">
        {(
          [
            ["bold", "Bold"],
            ["uppercase", "Uppercase"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={p[key]}
              onChange={e => patch({ [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={Boolean(p.background)}
            onChange={e =>
              patch({ background: e.target.checked ? "#141414" : null })
            }
          />
          {ui("Label background")}
        </label>
      </div>
      {p.background && (
        <label className="flex items-center justify-between text-xs">
          {ui("Background color")}
          <input
            type="color"
            aria-label={ui("Caption background")}
            value={p.background}
            onChange={e => patch({ background: e.target.value })}
            className="h-8 w-14 rounded border border-border"
          />
        </label>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setDraft({})}
          className="rounded-lg border border-border px-3 py-2 text-xs"
        >
          {ui("Reset preset")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onApply(draft).finally(() => setBusy(false));
          }}
          className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          {ui("Apply style")}
        </button>
      </div>
    </section>
  );
}
