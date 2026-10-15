import { useUiText } from "@/lib/i18n/ui";
import { useState } from "react";
import type { EditProject, TimelineClip } from "@contracts/workspace";
import { nextRollingClip } from "@/lib/editor-trimming";

export function ClipTimingTools({
  project,
  clip,
  disabled,
  onApply,
}: {
  project: EditProject;
  clip: TimelineClip;
  disabled?: boolean;
  onApply(mode: "slip" | "roll" | "stretch", value: number): Promise<void>;
}) {
  const ui = useUiText();
  const [offset, setOffset] = useState("0"),
    [cut, setCut] = useState("0"),
    [duration, setDuration] = useState(String(clip.duration));
  const next = nextRollingClip(project, clip);
  return (
    <details className="mt-4 rounded-xl border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        {ui("Slip, rolling trim and rate stretch")}
      </summary>
      <div className="mt-3 space-y-3 text-sm">
        <p className="text-xs text-foreground/65">
          {ui(
            "Linked audio follows these edits. Source boundaries and measured captions are preserved."
          )}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-xs">
            {ui("Slip source by seconds")}
            <input
              aria-label={ui("Slip source offset in seconds")}
              type="number"
              step={1 / (project.frameRate ?? 30)}
              value={offset}
              onChange={e => setOffset(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2"
            />
          </label>
          <button
            type="button"
            disabled={
              disabled || !Number.isFinite(Number(offset)) || !offset.trim()
            }
            onClick={() => void onApply("slip", Number(offset))}
            className="rounded-lg border border-border px-3 py-2 disabled:opacity-40"
          >
            {ui("Slip source")}
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-xs">
            {ui("Move cut to")} {next?.label ?? "next clip"} {ui("by seconds")}
            <input
              aria-label={ui("Rolling cut offset in seconds")}
              type="number"
              step={1 / (project.frameRate ?? 30)}
              value={cut}
              onChange={e => setCut(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2"
            />
          </label>
          <button
            type="button"
            disabled={
              disabled || !next || !Number.isFinite(Number(cut)) || !cut.trim()
            }
            onClick={() => void onApply("roll", Number(cut))}
            className="rounded-lg border border-border px-3 py-2 disabled:opacity-40"
          >
            {ui("Roll cut")}
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-xs">
            {ui("Fit source span to seconds")}
            <input
              aria-label={ui("Rate stretch duration in seconds")}
              type="number"
              min={1 / (project.frameRate ?? 30)}
              step={1 / (project.frameRate ?? 30)}
              value={duration}
              onChange={e => setDuration(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2"
            />
          </label>
          <button
            type="button"
            disabled={
              disabled ||
              Boolean(clip.graphic) ||
              !Number.isFinite(Number(duration)) ||
              Number(duration) <= 0
            }
            onClick={() => void onApply("stretch", Number(duration))}
            className="rounded-lg border border-border px-3 py-2 disabled:opacity-40"
          >
            {ui("Rate stretch")}
          </button>
        </div>
      </div>
    </details>
  );
}
