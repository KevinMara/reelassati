import { captionLines, getCaptionPreset } from "@contracts/editor-presets";
import type { TranscriptSegment } from "@contracts/workspace";
import { captionTextCss } from "@/lib/caption-rendering";

export function CaptionLayer({
  segments,
  presetId,
  time,
  appearance,
}: {
  segments: readonly TranscriptSegment[];
  presetId?: string;
  time: number;
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
      {active.map(segment => (
        <span key={segment.id} style={captionTextCss(p)}>
          {captionLines(segment.text, p)}
        </span>
      ))}
    </div>
  );
}
