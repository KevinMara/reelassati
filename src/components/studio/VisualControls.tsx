import { useUiText } from "@/lib/i18n/ui";
import {
  Diamond,
  FlipHorizontal2,
  FlipVertical2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  normalizeVisual,
  visualPose,
  visualProgress,
  visualClock,
  visualTransitions,
  type ClipVisual,
  type VisualPose,
  type VisualEasing,
} from "@contracts/clip-visual";
import type { TimelineClip } from "@contracts/workspace";
import { CompactSelect } from "@/components/ui/compact-select";
import { EditorInfo } from "./EditorInfo";

export function VisualControls({
  clip,
  time,
  onChange,
  onSeek,
}: {
  clip: TimelineClip;
  time: number;
  onChange: (clip: TimelineClip) => void;
  onSeek: (time: number) => void;
}) {
  const ui = useUiText();
  const v = normalizeVisual(clip.visual),
    p = visualProgress(clip, time),
    clock = visualClock(clip);
  const active = v.keyframes.findIndex(k => Math.abs(k.at - p) < 0.002);
  const pose = visualPose(v, p);
  const keyframeLimit = v.keyframes.length >= 24 && active < 0;
  const update = (patch: Partial<ClipVisual>) =>
    onChange({
      ...clip,
      visual: normalizeVisual({ ...v, ...patch }),
      visualStart: clock.start,
      visualDuration: clock.duration,
    });
  const changePose = (key: keyof VisualPose, value: number) => {
    if (v.keyframes.length) {
      const keys = [...v.keyframes];
      const entry = {
        ...pose,
        at: p,
        easing:
          active >= 0 ? keys[active].easing : ("ease-in-out" as VisualEasing),
        [key]: value,
      };
      if (active >= 0) keys[active] = entry;
      else keys.push(entry);
      update({ keyframes: keys });
    } else update({ [key]: value });
  };
  const field =
    "w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-sm tabular-nums";
  const disabled = !!clip.locked;
  return (
    <fieldset disabled={disabled} className="space-y-5 disabled:opacity-50">
      <div className="flex items-center justify-between">
        <span className="flex items-center text-sm font-medium">
          {ui("Transform")}
          <EditorInfo label={ui("Transform animation")}>
            {ui(
              "Position is a percentage of the canvas. Once keyframes exist, changing a value adds or updates a keyframe at the playhead. Trimming and splitting preserve the animation's source timing."
            )}
          </EditorInfo>
        </span>
        <button
          type="button"
          onClick={() =>
            update({
              x: 0,
              y: 0,
              scale: 1,
              rotation: 0,
              opacity: 1,
              keyframes: [],
            })
          }
          className="inline-flex items-center gap-1.5 text-sm text-foreground/65"
        >
          <RotateCcw size={14} />
          {ui("Reset")}
        </button>
      </div>
      {(
        [
          ["x", "Horizontal position", -100, 100, 1, "%"],
          ["y", "Vertical position", -100, 100, 1, "%"],
          ["scale", "Scale", 0.1, 4, 0.01, "×"],
          ["rotation", "Rotation", -360, 360, 1, "°"],
          ["opacity", "Opacity", 0, 1, 0.01, ""],
        ] as const
      ).map(([key, label, min, max, step, unit]) => (
        <label
          key={key}
          className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 text-sm"
        >
          <span>{label}</span>
          <span className="flex items-center gap-1">
            <input
              className={field}
              aria-label={`${label} value`}
              disabled={keyframeLimit}
              type="number"
              min={min}
              max={max}
              step={step}
              value={Number(pose[key].toFixed(3))}
              onChange={e => changePose(key, Number(e.target.value))}
            />
            {unit}
          </span>
          <input
            className="col-span-2 w-full accent-primary"
            aria-label={label}
            disabled={keyframeLimit}
            type="range"
            min={min}
            max={max}
            step={step}
            value={pose[key]}
            onChange={e => changePose(key, Number(e.target.value))}
          />
        </label>
      ))}
      {keyframeLimit && (
        <p className="text-sm text-foreground/65">
          {ui(
            "This clip has 24 keyframes. Select an existing keyframe to adjust its pose, or remove one before adding another."
          )}
        </p>
      )}
      <div className="flex gap-2">
        {(
          [
            ["flipX", "Flip horizontally", FlipHorizontal2],
            ["flipY", "Flip vertically", FlipVertical2],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            type="button"
            key={key}
            aria-pressed={v[key]}
            onClick={() => update({ [key]: !v[key] })}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-2 text-sm ${v[key] ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      <CompactSelect
        aria-label={ui("Blend mode")}
        value={v.blendMode}
        onValueChange={blendMode =>
          update({ blendMode: blendMode as ClipVisual["blendMode"] })
        }
        options={[
          "normal",
          "multiply",
          "screen",
          "overlay",
          "darken",
          "lighten",
          "difference",
        ].map(value => ({
          value,
          label: value[0].toUpperCase() + value.slice(1),
        }))}
      />
      <section className="space-y-3 rounded-xl border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">
            {ui("Keyframes ·")} {v.keyframes.length}/24
          </span>
          <button
            type="button"
            disabled={v.keyframes.length >= 24 && active < 0}
            className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-2 text-sm text-primary"
            onClick={() =>
              update({
                keyframes:
                  active >= 0
                    ? v.keyframes.filter((_, i) => i !== active)
                    : [
                        ...v.keyframes,
                        { ...pose, at: p, easing: "ease-in-out" },
                      ],
              })
            }
          >
            <Diamond size={14} fill={active >= 0 ? "currentColor" : "none"} />
            {active >= 0 ? ui("Remove keyframe") : ui("Add at playhead")}
          </button>
        </div>
        {!!v.keyframes.length && (
          <>
            <div className="flex flex-wrap gap-2">
              {v.keyframes.map((k, i) => (
                <button
                  type="button"
                  key={k.at}
                  onClick={() =>
                    onSeek(
                      clip.start +
                        (clock.start + k.at * clock.duration - clip.inPoint) /
                          (clip.speed ?? 1)
                    )
                  }
                  className={`rounded-md border px-2 py-1 text-sm tabular-nums ${active === i ? "border-primary text-primary" : "border-border"}`}
                >
                  {(
                    (clock.start + k.at * clock.duration - clip.inPoint) /
                    (clip.speed ?? 1)
                  ).toFixed(1)}
                  s
                </button>
              ))}
            </div>
            {active >= 0 && (
              <CompactSelect
                aria-label={ui("Keyframe easing")}
                value={v.keyframes[active].easing}
                onValueChange={easing =>
                  update({
                    keyframes: v.keyframes.map((k, i) =>
                      i === active
                        ? { ...k, easing: easing as VisualEasing }
                        : k
                    ),
                  })
                }
                options={[
                  { value: "linear", label: "Linear" },
                  { value: "ease-in-out", label: "Smooth in and out" },
                  { value: "ease-in", label: "Accelerate" },
                  { value: "ease-out", label: "Decelerate" },
                  { value: "hold", label: "Hold until next keyframe" },
                ]}
              />
            )}
          </>
        )}
        <div className="flex gap-2">
          {(
            [
              ["Slow push", 1, 1.15],
              ["Slow pull", 1.15, 1],
            ] as const
          ).map(([label, from, to]) => (
            <button
              type="button"
              key={label}
              className="rounded-lg border border-border px-2.5 py-1.5 text-sm"
              onClick={() =>
                update({
                  keyframes: [
                    { ...v, at: 0, scale: from, easing: "ease-in-out" },
                    { ...v, at: 1, scale: to, easing: "linear" },
                  ],
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      <details className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          {ui("Frame crop & mask")}
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm text-foreground/65">
            {ui(
              "Crop hides canvas edges before the transform; media underneath stays visible."
            )}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(["top", "right", "bottom", "left"] as const).map(edge => (
              <label
                key={edge}
                className="flex items-center justify-between gap-2 text-sm capitalize"
              >
                {edge}
                <input
                  aria-label={`Crop ${edge}`}
                  className={field}
                  type="number"
                  min={0}
                  max={45}
                  value={v.crop[edge]}
                  onChange={e =>
                    update({
                      crop: { ...v.crop, [edge]: Number(e.target.value) },
                    })
                  }
                />
              </label>
            ))}
          </div>
          <CompactSelect
            aria-label={ui("Mask shape")}
            value={v.mask}
            onValueChange={mask => update({ mask: mask as ClipVisual["mask"] })}
            options={[
              { value: "none", label: "No mask" },
              { value: "ellipse", label: "Ellipse" },
              { value: "rounded", label: "Rounded frame" },
              { value: "polygon", label: "Editable polygon" },
            ]}
          />
          {v.mask === "polygon" ? (
            <section
              className="space-y-2"
              aria-label={ui("Polygon mask points")}
            >
              <p className="text-xs text-foreground/65">
                {ui(
                  "Canvas percentages before transforms. Three to twelve points. Intersections use the even-odd fill rule."
                )}
              </p>
              {v.polygon.map((point, index) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                  <span>
                    {ui("Point")} {index + 1}
                  </span>
                  {(["x", "y"] as const).map(axis => (
                    <label key={axis}>
                      {axis.toUpperCase()}
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={point[axis]}
                        aria-label={`Mask point ${index + 1} ${axis}`}
                        className="ml-1 w-16 rounded border border-border bg-background p-1"
                        onChange={e =>
                          update({
                            polygon: v.polygon.map((p, i) =>
                              i === index
                                ? { ...p, [axis]: Number(e.target.value) }
                                : p
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    disabled={v.polygon.length <= 3}
                    aria-label={`Remove mask point ${index + 1}`}
                    onClick={() =>
                      update({
                        polygon: v.polygon.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={v.polygon.length >= 12}
                className="rounded-lg border border-border px-2 py-1 text-sm"
                onClick={() =>
                  update({
                    polygon: [
                      ...v.polygon,
                      {
                        x:
                          (v.polygon[0].x + v.polygon[v.polygon.length - 1].x) /
                          2,
                        y:
                          (v.polygon[0].y + v.polygon[v.polygon.length - 1].y) /
                          2,
                      },
                    ],
                  })
                }
              >
                {ui("Add mask point")}
              </button>
              <button
                type="button"
                className="ml-2 rounded-lg border border-border px-2 py-1 text-sm"
                onClick={() =>
                  update({
                    polygon: [
                      { x: 50, y: 5 },
                      { x: 95, y: 95 },
                      { x: 5, y: 95 },
                    ],
                  })
                }
              >
                {ui("Triangle")}
              </button>
            </section>
          ) : null}
          {v.mask === "rounded" && (
            <label className="flex items-center justify-between text-sm">
              {ui("Corner radius %")}
              <input
                className={field}
                type="number"
                min={0}
                max={50}
                value={v.radius}
                onChange={e => update({ radius: Number(e.target.value) })}
              />
            </label>
          )}
        </div>
      </details>
      <section className="space-y-3 rounded-xl border border-border p-3">
        <p className="flex items-center text-sm font-medium">
          {ui("Visual transitions")}
          <EditorInfo label={ui("Visual transitions")}>
            {ui(
              "These affect the picture only. To transition between two shots, overlap them on separate video lanes and apply an entrance to the upper clip. Keep the outgoing shot fully visible for a clean dissolve."
            )}
          </EditorInfo>
        </p>
        {(["entrance", "exit"] as const).map(key => (
          <div key={key} className="space-y-2">
            <label className="text-sm capitalize">{key}</label>
            <div className="flex items-center gap-2">
              <CompactSelect
                aria-label={`${key} transition`}
                className="flex-1"
                value={v[key].kind}
                options={visualTransitions}
                onValueChange={kind =>
                  update({
                    [key]: {
                      ...v[key],
                      kind: kind as ClipVisual["entrance"]["kind"],
                      at: key === "entrance" ? clip.inPoint : clip.outPoint,
                    },
                  })
                }
              />
              {v[key].kind !== "none" && (
                <label className="flex items-center gap-1 text-sm">
                  <input
                    aria-label={`${key} duration`}
                    className={field}
                    type="number"
                    min={0.05}
                    max={5}
                    step={0.05}
                    value={v[key].duration}
                    onChange={e =>
                      update({
                        [key]: { ...v[key], duration: Number(e.target.value) },
                      })
                    }
                  />
                  s
                </label>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm text-foreground/65"
          onClick={() =>
            update({
              entrance: { kind: "none", duration: 0.5 },
              exit: { kind: "none", duration: 0.5 },
            })
          }
        >
          <Trash2 size={14} />
          {ui("Clear transitions")}
        </button>
      </section>
    </fieldset>
  );
}
