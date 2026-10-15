import { useUiText } from "@/lib/i18n/ui";
import { useState } from "react";
import { CompactSelect } from "@/components/ui/compact-select";
import {
  visualTransitions,
  type VisualTransition,
} from "@contracts/clip-visual";
import type { EditProject, TimelineClip } from "@contracts/workspace";

export function ShotTransitionPanel({
  clip,
  project,
  disabled,
  onApply,
  onRemove,
}: {
  clip?: TimelineClip;
  project: EditProject;
  disabled: boolean;
  onApply: (
    incomingId: string,
    kind: Exclude<VisualTransition, "none">,
    duration: number
  ) => Promise<void>;
  onRemove: (outgoingId: string, incomingId: string) => Promise<void>;
}) {
  const ui = useUiText();
  const [kind, setKind] =
    useState<Exclude<VisualTransition, "none">>("dissolve");
  const [seconds, setSeconds] = useState(0.4),
    [error, setError] = useState("");
  const pair = project.clips.find(
    c =>
      c.shotTransition &&
      (c.shotTransition.outgoingId === clip?.id ||
        c.shotTransition.incomingId === clip?.id)
  )?.shotTransition;
  const next =
    clip &&
    !clip.graphic &&
    project.clips.find(
      c =>
        c.id !== clip.id &&
        !c.transitionHandle &&
        !c.graphic &&
        c.assetId &&
        c.track !== "audio" &&
        Math.abs(c.start - clip.start - clip.duration) < 0.001
    );
  return (
    <fieldset className="space-y-3 rounded-xl border border-border p-3">
      <legend className="px-1 text-sm font-medium">
        {ui("Transition to next shot")}
      </legend>
      <p className="text-xs text-foreground/65">
        {next
          ? `${clip?.label} → ${next.label}`
          : ui(
              "Select an outgoing video shot that meets another video at its end."
            )}
      </p>
      <CompactSelect
        aria-label={ui("Transition between shots")}
        value={kind}
        onValueChange={v => setKind(v as typeof kind)}
        options={visualTransitions.filter(v => v.value !== "none")}
        disabled={disabled || !next}
      />
      <label className="block text-xs">
        {ui("Duration")}{" "}
        <input
          type="number"
          aria-label={ui("Shot transition duration")}
          min={0.05}
          max={5}
          step={0.05}
          value={seconds}
          disabled={disabled || !next}
          onChange={e => setSeconds(Number(e.target.value))}
          className="ml-2 w-20 rounded border border-border bg-background p-2"
        />{" "}
        s
      </label>
      <p className="text-xs text-foreground/55">
        {ui(
          "Uses unused footage around the cut. Speech timing and total edit length stay fixed. Other overlapping video layers must be resolved first."
        )}
      </p>
      <button
        type="button"
        disabled={disabled || !next}
        className="rounded-lg border border-primary/40 px-3 py-2 text-xs text-primary disabled:opacity-40"
        onClick={() => {
          if (!next) return;
          setError("");
          void onApply(next.id, kind, seconds).catch(e =>
            setError(
              e instanceof Error ? e.message : "Could not apply transition."
            )
          );
        }}
      >
        {ui("Apply between shots")}
      </button>
      {pair && (
        <div className="space-y-2">
          <p className="text-xs text-foreground/65">
            {ui(
              "Remove this transition before moving, trimming, splitting or deleting its shots."
            )}
          </p>
          <button
            type="button"
            disabled={disabled}
            className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40"
            onClick={() => {
              setError("");
              void onRemove(pair.outgoingId, pair.incomingId).catch(e =>
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not remove transition."
                )
              );
            }}
          >
            {ui("Remove transition")}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
