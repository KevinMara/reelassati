import type { EditProject } from "@contracts/workspace";
import {
  timelineTrackSettings,
  type TimelineTrack,
  type TimelineTrackSettings,
} from "@contracts/timeline-mixer";
import {
  clipLaneKind,
  clipLaneNumber,
  timelineLanes,
} from "@/lib/timeline-lanes";

export function TimelineMixer({
  project,
  disabled,
  onUpdate,
  onReorder,
}: {
  project: EditProject;
  disabled?: boolean;
  onUpdate(
    lane: TimelineTrack,
    patch: Omit<Partial<TimelineTrackSettings>, "kind" | "number">
  ): Promise<void>;
  onReorder(lane: TimelineTrack, direction: "up" | "down"): Promise<void>;
}) {
  const lanes = timelineLanes(project.clips).filter(
    lane =>
      project.clips.some(
        clip =>
          clipLaneKind(clip) === lane.kind &&
          clipLaneNumber(clip) === lane.number
      ) ||
      (lane.kind === "captions" &&
        lane.number === 1 &&
        project.transcript.length)
  );
  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground/65">
        Track names and mix settings are saved with the project. Solo sound
        isolates source audio; solo picture isolates visual layers. Reordering
        changes layer order within the same track family.
      </p>
      {lanes.map(lane => {
        const row = timelineTrackSettings(project, lane);
        const name =
          row?.name ??
          `${lane.kind[0].toUpperCase()}${lane.kind.slice(1)} ${lane.number}`;
        const family = lanes.filter(other => other.kind === lane.kind);
        const index = family.findIndex(other => other.number === lane.number);
        const sound = ["audio", "video"].includes(lane.kind);
        const picture = ["video", "text", "graphics"].includes(lane.kind);
        return (
          <section
            key={`${lane.kind}:${lane.number}`}
            className="rounded-xl border border-border p-3"
          >
            <div className="flex items-center gap-2">
              <input
                key={name}
                aria-label={`Name of ${lane.kind} track ${lane.number}`}
                defaultValue={name}
                maxLength={60}
                disabled={disabled}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-2 text-sm"
                onBlur={e => {
                  if (e.target.value.trim() !== name)
                    void onUpdate(lane, { name: e.target.value });
                }}
                onKeyDown={e => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
              <button
                type="button"
                disabled={disabled || index <= 0}
                aria-label={`Move ${name} up`}
                onClick={() => void onReorder(lane, "up")}
                className="rounded-lg border border-border px-2 py-2 text-sm disabled:opacity-40"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={disabled || index >= family.length - 1}
                aria-label={`Move ${name} down`}
                onClick={() => void onReorder(lane, "down")}
                className="rounded-lg border border-border px-2 py-2 text-sm disabled:opacity-40"
              >
                ↓
              </button>
            </div>
            {(sound || picture) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {sound && (
                  <>
                    <label className="flex min-w-[180px] flex-1 items-center gap-2 text-xs">
                      Gain{" "}
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.01}
                        aria-label={`Gain for ${name}`}
                        disabled={disabled}
                        defaultValue={row?.gain ?? 1}
                        key={`${name}:${row?.gain}`}
                        onPointerUp={e =>
                          void onUpdate(lane, {
                            gain: Number(e.currentTarget.value),
                          })
                        }
                        onKeyUp={e => {
                          if (
                            ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                              e.key
                            )
                          )
                            void onUpdate(lane, {
                              gain: Number(e.currentTarget.value),
                            });
                        }}
                        className="min-w-0 flex-1 accent-primary"
                      />
                      <span className="w-10 text-right tabular-nums">
                        {Math.round((row?.gain ?? 1) * 100)}%
                      </span>
                    </label>
                    <button
                      type="button"
                      aria-pressed={Boolean(row?.soloSound)}
                      disabled={disabled}
                      onClick={() =>
                        void onUpdate(lane, { soloSound: !row?.soloSound })
                      }
                      className={`rounded-lg border px-3 py-2 text-xs ${row?.soloSound ? "border-primary bg-primary/15 text-primary" : "border-border"}`}
                    >
                      Solo sound
                    </button>
                  </>
                )}
                {picture && (
                  <button
                    type="button"
                    aria-pressed={Boolean(row?.soloPicture)}
                    disabled={disabled}
                    onClick={() =>
                      void onUpdate(lane, { soloPicture: !row?.soloPicture })
                    }
                    className={`rounded-lg border px-3 py-2 text-xs ${row?.soloPicture ? "border-primary bg-primary/15 text-primary" : "border-border"}`}
                  >
                    Solo picture
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}
      {!lanes.length && (
        <p className="text-sm text-foreground/65">
          Add media to create a track.
        </p>
      )}
    </div>
  );
}
