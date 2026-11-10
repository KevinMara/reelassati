import { getCaptionPreset } from "@contracts/editor-presets";
import { captionRuns, captionMotion } from "@contracts/caption-runs";
import { captionMotionFrame } from "@contracts/caption-motion";
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
  const verticalAnchor =
    p.animation === "motion" &&
    p.motion?.verticalAnchor &&
    p.motion.verticalAnchor !== "auto"
      ? p.motion.verticalAnchor
      : p.position;
  const active = segments.filter(
    s => s.start <= time && s.end > time && s.text.trim()
  );
  if (!active.length) return null;
  return (
    <div
      className="pointer-events-none absolute inset-x-[8%] z-20 flex flex-col items-center text-center"
      style={{
        ...(verticalAnchor === "center"
          ? { top: "50%", transform: "translateY(-50%)" }
          : { [verticalAnchor]: `${p.margin}%` }),
        ...(p.animation === "motion"
          ? {
              alignItems:
                p.motion?.anchor === "left"
                  ? "flex-start"
                  : p.motion?.anchor === "right"
                    ? "flex-end"
                    : "center",
              textAlign: p.motion?.anchor ?? "center",
            }
          : {}),
      }}
    >
      {active.map(segment => {
        const frame = captionMotionFrame(segment, p, time, frameRate);
        if (frame)
          return (
            <div
              key={segment.id}
              style={{
                position: "relative",
                width: "100%",
                height: `${frame.height}cqw`,
              }}
            >
              {frame.units.map((unit, i) => (
                <span
                  key={i}
                  style={{
                    ...captionTextCss(p),
                    position: "absolute",
                    left: `calc(${frame.anchor === "left" ? 0 : frame.anchor === "right" ? 100 : 50}% + ${unit.x}cqw)`,
                    top: `${unit.y}cqw`,
                    color: unit.color,
                    direction: unit.direction,
                    transform: `translateY(-50%) scale(${unit.scale})`,
                    transformOrigin: "left center",
                    opacity: unit.opacity,
                    filter: unit.blur ? `blur(${unit.blur}cqw)` : undefined,
                    textShadow: unit.glow
                      ? `0 0 ${unit.glow}cqw ${p.activeColor}`
                      : undefined,
                  }}
                >
                  {unit.text}
                </span>
              ))}
            </div>
          );
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
