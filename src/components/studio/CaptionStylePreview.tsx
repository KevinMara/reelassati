import { useUiText } from "@/lib/i18n/ui";
import { useEffect, useState } from "react";
import {
  captionLines,
  getCaptionPreset,
  type CaptionAppearance,
} from "@contracts/editor-presets";
import { CaptionLayer } from "./CaptionLayer";

const SAMPLE = {
  id: "style-demo",
  start: 0,
  end: 2.4,
  text: "Make every word count",
  words: [
    { text: "Make", start: 0.1, end: 0.4 },
    { text: "every", start: 0.5, end: 0.85 },
    { text: "word", start: 1, end: 1.35 },
    { text: "count", start: 1.5, end: 1.95 },
  ],
};

/** Authored style sample, never used as transcription evidence. */
export function CaptionStylePreview({
  presetId,
  appearance,
  animate = false,
  compact = false,
}: {
  presetId?: string;
  appearance?: CaptionAppearance;
  animate?: boolean;
  compact?: boolean;
}) {
  const ui = useUiText();
  const specimen = compact
    ? { ...appearance, size: 8, maxCharacters: 24 }
    : appearance;
  const preset = getCaptionPreset(presetId, specimen);
  const rows = captionLines(SAMPLE.text, preset).split("\n").length;
  // Reserve the full phrase throughout the animation, so word entrances never
  // make the controls below jump. Width-based units match the actual renderer.
  const textHeight = rows * preset.size * 1.2 + preset.outline * 2;
  const motionRoom =
    preset.animation === "motion"
      ? preset.size * (preset.motion?.amount ?? 0.6) * 2
      : preset.size * 0.6;
  const [time, setTime] = useState(1.15);
  useEffect(() => {
    if (
      !animate ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setTime(((now - start) / 1000) % 2.4);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, presetId, appearance]);
  return (
    <div
      className="relative overflow-hidden rounded-lg bg-[#252A32]"
      style={{ containerType: "inline-size" }}
      aria-label={ui("Caption style sample")}
    >
      <div
        aria-hidden="true"
        style={{
          height: `calc(${textHeight + motionRoom}cqw + ${compact ? 24 : 32}px)`,
        }}
      />
      <CaptionLayer
        presetId={presetId}
        appearance={specimen}
        sample
        time={time}
        segments={[SAMPLE]}
      />
    </div>
  );
}
