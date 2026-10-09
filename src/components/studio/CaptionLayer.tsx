import { getCaptionPreset } from "@contracts/editor-presets";
import { captionRuns, captionMotion } from "@contracts/caption-runs";
import type { TranscriptSegment } from "@contracts/workspace";
import { captionTextCss } from "@/lib/caption-rendering";

export function CaptionLayer({
  segments,
  presetId,
  time,
  appearance,
  frameRate = 30,
}: {
  segments: readonly TranscriptSegment[];
  presetId?: string;
  time: number;
  frameRate?: number;
  appearance?: import("@contracts/editor-presets").CaptionAppearance;
}) {
  const p = getCaptionPreset(presetId, appearance);
  const active = segments.filter(
    s => s.start <= time && s.end > time && s.text.trim()
  );
  if (!active.length) return null;
  return (
    <div
      className="pointer-events-none absolute inset-x-[8%] z-20 flex flex-col items-center text-center"
      style={{ [p.position]: `${p.margin}%` }}
    >
      {active.map(segment => {
        const runs = captionRuns(segment, p, time);
        if (!runs.length) return null;
        const motion = captionMotion(segment, p, time, frameRate);
        return (
          <span
            key={segment.id}
            style={{
              ...captionTextCss(p),
              transform: `translateY(${motion.y}cqw) scale(${motion.scale})`,
              opacity: motion.opacity,
              transformOrigin:
                p.position === "top" ? "center top" : "center bottom",
            }}
          >
            {runs.map((run, i) => (
              <span
                key={i}
                style={{
                  ...(run.active ? { color: p.activeColor } : {}),
                  ...(run.hidden ? { visibility: "hidden" } : {}),
                }}
              >
                {run.text}
              </span>
            ))}
          </span>
        );
      })}
    </div>
  );
}
