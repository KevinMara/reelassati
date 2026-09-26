import { CompactSelect } from "@/components/ui/compact-select";
import {
  graphicFrame,
  graphicEasingProgress,
  type GraphicEasing,
  normalizeGraphic,
  type MotionGraphic,
  type GraphicKeyframe,
  MOTION_CHOREOGRAPHIES,
  choreographGraphic,
} from "@contracts/motion-graphics";

export function GraphicMotionEditor({
  graphic,
  duration,
  position,
  onPosition,
  onChange,
}: {
  graphic: MotionGraphic;
  duration: number;
  position: number;
  onPosition: (value: number) => void;
  onChange: (graphic: MotionGraphic) => void;
}) {
  const points = graphic.motion ?? [];
  const selected = points.find(p => Math.abs(p.at - position) < 0.00001);
  const next = selected && points.find(point => point.at > selected.at);
  const curve = Array.from({ length: 33 }, (_, index) => {
    const progress = index / 32;
    return `${index ? "L" : "M"}${progress * 72},${28 - graphicEasingProgress(progress, selected?.easing) * 24}`;
  }).join(" ");
  const frame = graphicFrame(
    { ...graphic, animation: "none" },
    position * Math.max(1 / 30, duration - 1 / 30),
    duration
  );
  function save(points: GraphicKeyframe[]) {
    onChange(normalizeGraphic({ ...graphic, motion: points })!);
  }
  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-3">
      <legend className="px-1 text-sm font-medium">Motion path</legend>
      <div className="grid grid-cols-2 gap-2">
        {MOTION_CHOREOGRAPHIES.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              onChange(choreographGraphic(graphic, p.id));
              onPosition(0.18);
            }}
            className="rounded-lg border border-border px-2 py-2 text-left text-xs hover:border-primary/60"
          >
            {p.name}
          </button>
        ))}
      </div>
      <label className="block text-xs">
        Preview · {(position * duration).toFixed(1)}s
        <input
          aria-label="Graphic preview time"
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={position}
          onChange={e => onPosition(Number(e.target.value))}
          className="block w-full accent-primary"
        />
      </label>
      <p className="text-xs text-foreground/70">
        Choose a time, add a keyframe, then set its position, scale and
        rotation. The graphic moves between your keyframes.
      </p>
      <div className="flex flex-wrap gap-2">
        {points.map(point => (
          <button
            key={point.at}
            type="button"
            aria-pressed={selected === point}
            onClick={() => onPosition(point.at)}
            className={`rounded border px-2 py-1 text-xs ${selected === point ? "border-primary bg-primary/10" : "border-border"}`}
          >
            {(point.at * duration).toFixed(1)}s
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={Boolean(selected) || points.length >= 120}
        className="rounded border border-primary/30 px-2 py-1 text-xs text-primary disabled:opacity-40"
        onClick={() => {
          const point = {
            at: position,
            x: frame.x,
            y: frame.y,
            scale: frame.scale,
            rotation: frame.rotation,
            opacity: frame.opacity,
          };
          // Preserve the initial pose when the first keyframe is inserted later in the clip.
          save(
            !points.length && position > 0
              ? [
                  {
                    at: 0,
                    x: graphic.x,
                    y: graphic.y,
                    scale: 1,
                    rotation: graphic.rotation ?? 0,
                  },
                  point,
                ]
              : [...points, point]
          );
        }}
      >
        Add keyframe here
      </button>
      {selected && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["x", "Horizontal %", 0, 100, 1],
                ["y", "Vertical %", 0, 100, 1],
                ["scale", "Scale", 0.1, 4, 0.1],
                ["rotation", "Rotation °", -720, 720, 1],
                ["opacity", "Opacity", 0, 1, 0.05],
              ] as const
            ).map(([key, label, min, max, step]) => (
              <label key={key} className="text-xs">
                {label}
                <input
                  aria-label={`Keyframe ${label}`}
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  value={selected[key] ?? 1}
                  className="mt-1 w-full rounded border border-border bg-background p-2"
                  onChange={e =>
                    save(
                      points.map(p =>
                        p === selected
                          ? { ...p, [key]: Number(e.target.value) }
                          : p
                      )
                    )
                  }
                />
              </label>
            ))}
          </div>
          {next && (
            <div className="space-y-2 rounded-lg bg-foreground/[0.03] p-2.5">
              <label className="block text-xs">
                Motion to next keyframe
                <CompactSelect
                  aria-label="Keyframe easing"
                  value={selected.easing ?? "linear"}
                  onValueChange={value =>
                    save(
                      points.map(point =>
                        point === selected
                          ? { ...point, easing: value as GraphicEasing }
                          : point
                      )
                    )
                  }
                  options={[
                    { value: "linear", label: "Steady speed" },
                    { value: "ease-in", label: "Start slowly" },
                    { value: "ease-out", label: "Land softly" },
                    { value: "ease-in-out", label: "Smooth start and finish" },
                    { value: "hold", label: "Hold, then jump" },
                  ]}
                />
              </label>
              <div className="flex items-center gap-3 text-[11px] text-foreground/60">
                <svg
                  viewBox="0 0 76 32"
                  className="h-8 w-[76px] shrink-0 text-primary"
                  aria-hidden="true"
                >
                  <path
                    d="M0 28 H72 M0 28 V4"
                    fill="none"
                    stroke="currentColor"
                    opacity="0.2"
                  />
                  <path
                    d={curve}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
                <span>
                  Applies until {(next.at * duration).toFixed(1)}s. Scrub the
                  preview to see the motion.
                </span>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => save(points.filter(p => p !== selected))}
            className="text-xs text-destructive"
          >
            Remove selected keyframe
          </button>
        </>
      )}
      {points.length > 0 && (
        <button
          type="button"
          onClick={() => save([])}
          className="ml-3 text-xs text-foreground/70"
        >
          Clear motion path
        </button>
      )}
    </fieldset>
  );
}
