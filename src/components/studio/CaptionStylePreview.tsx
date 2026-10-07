import { useEffect, useState } from "react";
import type { CaptionAppearance } from "@contracts/editor-presets";
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
  }, [animate]);
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-[#252A32] ${compact ? "aspect-[1.8]" : "aspect-video"}`}
      style={{ containerType: "inline-size" }}
      aria-label="Caption style sample"
    >
      <CaptionLayer
        presetId={presetId}
        appearance={
          compact
            ? { ...appearance, size: 8, margin: 26, maxCharacters: 24 }
            : appearance
        }
        time={time}
        segments={[SAMPLE]}
      />
    </div>
  );
}
