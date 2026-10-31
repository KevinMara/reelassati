import { useEffect, useMemo, useState } from "react";
import { Play, Pause } from "lucide-react";
import { useUiText } from "@/lib/i18n/ui";
import type { EditTemplateBlueprint } from "@contracts/edit-template-blueprint";
import type { Asset, EditProject } from "@contracts/workspace";
import { TimelinePreview } from "./TimelinePreview";

/** A saved style's complete composition plays directly from its durable archive.
 * It does not require an MP4 render, a surviving source project, or inference. */
export function SavedStylePreview({
  blueprint,
  assets,
}: {
  blueprint: EditTemplateBlueprint;
  assets: Asset[];
}) {
  const ui = useUiText();
  const [{ time, playing }, setPlayback] = useState({
    time: 0,
    playing: false,
  });
  const project = useMemo<EditProject>(
    () => ({
      ...blueprint,
      id: "saved-style-preview",
      title: "Preview",
      template: "blank",
      status: "editing",
      platform: "instagram",
      playhead: 0,
      createdAt: "",
      updatedAt: "",
      proposedChanges: [],
      qualitySignals: [],
      revisions: [],
    }),
    [blueprint]
  );
  useEffect(() => {
    if (!playing) return;
    let frame = 0,
      previous: number | undefined;
    const tick = (now: number) => {
      if (previous !== undefined) {
        const elapsed = (now - previous) / 1000;
        setPlayback(state => {
          const time = Math.min(project.duration, state.time + elapsed);
          return { time, playing: time < project.duration };
        });
      }
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, project.duration]);
  const missing = project.clips.some(
    c => c.assetId && !assets.some(a => a.id === c.assetId && a.url)
  );
  return (
    <section
      aria-label={ui("Preview")}
      className="my-3 overflow-hidden rounded-lg border border-border bg-black"
    >
      <div className="flex h-56 items-center justify-center p-2">
        <TimelinePreview
          project={project}
          assets={assets}
          time={time}
          playing={playing}
        />
      </div>
      <div className="flex items-center gap-2 border-t border-border bg-surface p-2">
        <button
          type="button"
          className="rounded p-1.5"
          aria-label={ui(playing ? "Pause preview" : "Play preview")}
          onClick={() => {
            setPlayback(state => ({
              time: state.time >= project.duration ? 0 : state.time,
              playing: !state.playing,
            }));
          }}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <input
          type="range"
          className="min-w-0 flex-1"
          min={0}
          max={project.duration}
          step={0.01}
          value={time}
          aria-label={ui("Playhead")}
          onChange={e => {
            setPlayback({ playing: false, time: Number(e.target.value) });
          }}
        />
        <span className="text-[10px] tabular-nums">
          {time.toFixed(1)} / {project.duration.toFixed(1)}s
        </span>
      </div>
      {missing && (
        <p className="p-2 text-xs text-muted-foreground">
          {ui(
            "Some source media is unavailable. The saved design is preserved."
          )}
        </p>
      )}
    </section>
  );
}
