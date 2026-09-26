import { useState } from "react";
import {
  getCaptionPreset,
  type CaptionAppearance,
} from "@contracts/editor-presets";
import { CaptionLayer } from "./CaptionLayer";
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
  const [draft, setDraft] = useState<CaptionAppearance>(appearance ?? {});
  const [busy, setBusy] = useState(false);
  const p = getCaptionPreset(presetId, draft);
  const patch = (value: CaptionAppearance) =>
    setDraft(d => ({ ...d, ...value }));
  return (
    <section
      className="space-y-3 rounded-xl border border-border p-3"
      aria-label="Customize captions"
    >
      <h3 className="flex items-center text-sm font-semibold">
        Customize captions
        <EditorInfo label="Caption safe area">
          Size is a percentage of video width. Safe margin keeps captions away
          from social-player controls. Preview and export use these same
          settings. Burned-in source captions cannot be restyled here.
        </EditorInfo>
      </h3>
      <div
        className="relative aspect-video overflow-hidden rounded-lg bg-[#252A32]"
        style={{ containerType: "inline-size" }}
      >
        <CaptionLayer
          presetId={presetId}
          appearance={draft}
          time={1}
          segments={[
            {
              id: "sample",
              start: 0,
              end: 3,
              text: sample || "Make every word count",
            },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ["color", "Text color"],
            ["outlineColor", "Outline color"],
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
        aria-label="Caption position"
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
          Label background
        </label>
      </div>
      {p.background && (
        <label className="flex items-center justify-between text-xs">
          Background color
          <input
            type="color"
            aria-label="Caption background"
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
          Reset preset
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
          Apply style
        </button>
      </div>
    </section>
  );
}
