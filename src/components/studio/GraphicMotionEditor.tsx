import {
  graphicFrame,
  normalizeGraphic,
  type MotionGraphic,
  type GraphicKeyframe,
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
                  value={selected[key]}
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
