import { useState } from "react";
import { Play, Pause } from "lucide-react";
import {
  CAPTION_ANIMATIONS,
  CAPTION_PRESETS,
  getCaptionPreset,
  type CaptionAppearance,
  type CaptionAnimation,
} from "@contracts/editor-presets";
import { CaptionStylePreview } from "@/components/studio/CaptionStylePreview";
import { useUiText } from "@/lib/i18n/ui";
import {
  StyleColor,
  StyleRange,
  StyleSelect,
  StyleToggle,
} from "./StyleFields";

const animationLabels = [
  "None",
  "Word focus",
  "Spoken reveal",
  "Word spotlight",
  "Speech pulse",
  "Word pop",
  "Word rise",
  "Word fade",
  "Word type",
];

export function CaptionStyleFields({
  preset,
  appearance,
  onChange,
}: {
  preset: string;
  appearance: CaptionAppearance;
  onChange(preset: string, appearance: CaptionAppearance): void;
}) {
  const ui = useUiText();
  const [playing, setPlaying] = useState(false);
  const resolved = getCaptionPreset(preset, appearance);
  const patch = (value: CaptionAppearance) =>
    onChange(preset, { ...appearance, ...value });
  return (
    <div className="space-y-4">
      <CaptionStylePreview
        presetId={preset}
        appearance={appearance}
        animate={playing}
      />
      <button
        type="button"
        aria-pressed={playing}
        onClick={() => setPlaying(value => !value)}
        className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs"
      >
        {playing ? <Pause size={13} /> : <Play size={13} />}
        {playing ? ui("Pause style sample") : ui("Play style sample")}
      </button>
      <StyleSelect
        label={ui("Caption preset")}
        value={preset}
        options={CAPTION_PRESETS.map(value => ({
          value: value.id,
          label: value.name,
        }))}
        onChange={value => onChange(value, {})}
      />
      <div className="grid grid-cols-2 gap-4">
        <StyleSelect
          label={ui("Caption animation")}
          value={resolved.animation}
          options={CAPTION_ANIMATIONS.map((value, index) => ({
            value,
            label: animationLabels[index],
          }))}
          onChange={value => patch({ animation: value as CaptionAnimation })}
        />
        <StyleSelect
          label={ui("Caption position")}
          value={resolved.position}
          options={[
            { value: "bottom", label: "Bottom" },
            { value: "top", label: "Top" },
          ]}
          onChange={value => patch({ position: value as "bottom" | "top" })}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ["color", "Text color"],
            ["activeColor", "Active word color"],
            ["outlineColor", "Outline color"],
          ] as const
        ).map(([key, label]) => (
          <StyleColor
            key={key}
            label={ui(label)}
            value={resolved[key]}
            onChange={value => patch({ [key]: value })}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {(
          [
            ["size", "Text size", 2, 12, 0.1],
            ["margin", "Safe-zone inset", 2, 40, 1],
            ["outline", "Outline / label padding", 0, 2, 0.05],
            ["maxCharacters", "Characters per line", 12, 64, 1],
          ] as const
        ).map(([key, label, min, max, step]) => (
          <StyleRange
            key={key}
            label={ui(label)}
            value={resolved[key]}
            min={min}
            max={max}
            step={step}
            onChange={value => patch({ [key]: value })}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        <StyleToggle
          label={ui("Bold")}
          checked={resolved.bold}
          onChange={value => patch({ bold: value })}
        />
        <StyleToggle
          label={ui("Uppercase")}
          checked={resolved.uppercase}
          onChange={value => patch({ uppercase: value })}
        />
        <StyleToggle
          label={ui("Label background")}
          checked={Boolean(resolved.background)}
          onChange={value => patch({ background: value ? "#141414" : null })}
        />
      </div>
      {resolved.background && (
        <StyleColor
          label={ui("Background color")}
          value={resolved.background}
          onChange={value => patch({ background: value })}
        />
      )}
    </div>
  );
}
