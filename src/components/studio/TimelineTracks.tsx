import { useRef, useState, type DragEvent, type PointerEvent } from "react";
import {
  Film,
  Shapes,
  Type,
  Music2,
  Lock,
  VolumeX,
  Magnet,
} from "lucide-react";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import {
  LIBRARY_ASSET_DRAG_TYPE,
  TIMELINE_CLIP_DRAG_TYPE,
  clipLaneKind,
  clipLaneNumber,
  timelineLanes,
  timelineClipColor,
  timeAtTimelinePointer,
  trimTimelineClip,
  type TimelineLane,
} from "@/lib/timeline-lanes";

import {
  buildTimelineSnapPoints,
  snapTimelineTime,
  type TimelineSnapPoint,
} from "@/lib/timeline-snapping";

const names = {
  video: "Video",
  audio: "Audio",
  text: "Text",
  graphics: "Graphics",
  captions: "Captions",
};
const icons = {
  video: Film,
  audio: Music2,
  text: Type,
  graphics: Shapes,
  captions: Type,
};
const fmt = (value: number) => `${value.toFixed(1)}s`;

type Props = {
  project: EditProject;
  assets: Asset[];
  time: number;
  zoom: number;
  selectedClipId: string | null;
  disabled?: boolean;
  onSeek(time: number): void;
  onSelect(clip: TimelineClip, time: number): void;
  onAssetDrop(asset: Asset, time: number, lane: TimelineLane): Promise<void>;
  onFilesDrop(files: File[], time: number, lane: TimelineLane): Promise<void>;
  onMove(clip: TimelineClip, time: number, lane: TimelineLane): Promise<void>;
  onTrim(clip: TimelineClip): Promise<void>;
  onCaptionSelect(time: number): void;
};

export function TimelineTracks({
  project,
  assets,
  time,
  zoom,
  selectedClipId,
  disabled,
  onSeek,
  onSelect,
  onAssetDrop,
  onFilesDrop,
  onMove,
  onTrim,
  onCaptionSelect,
}: Props) {
  const [drop, setDrop] = useState<{ lane: string; time: number } | null>(null);
  const [trimDraft, setTrimDraft] = useState<TimelineClip | null>(null);
  const [snapping, setSnapping] = useState(true);
  const [snapGuide, setSnapGuide] = useState<TimelineSnapPoint | null>(null);
  const draggedClip = useRef<{ id: string; offset: number } | null>(null);
  const lanes = timelineLanes(project.clips);
  const clipPlacement = (
    clip: TimelineClip,
    at: number,
    offset: number,
    rowWidth: number,
    altKey: boolean
  ) =>
    snapTimelineTime({
      time: Math.max(0, at - Math.max(0, Math.min(clip.duration, offset))),
      movingDuration: clip.duration,
      points: buildTimelineSnapPoints(
        project.clips,
        project.duration,
        time,
        new Set([clip.id])
      ),
      pixelsPerSecond: rowWidth / project.duration,
      enabled: snapping && !altKey,
    });
  const pointerTime = (event: {
    clientX: number;
    currentTarget: HTMLElement;
  }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return timeAtTimelinePointer(
      event.clientX,
      rect.left,
      rect.width,
      project.duration
    );
  };
  const supportsDrop = (event: DragEvent) =>
    [LIBRARY_ASSET_DRAG_TYPE, TIMELINE_CLIP_DRAG_TYPE, "Files"].some(type =>
      event.dataTransfer.types.includes(type)
    );
  const handleDrop = async (
    event: DragEvent<HTMLDivElement>,
    lane: TimelineLane
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setDrop(null);
    setSnapGuide(null);
    if (disabled) return;
    const at = pointerTime(event);
    const assetId = event.dataTransfer.getData(LIBRARY_ASSET_DRAG_TYPE);
    if (assetId) {
      const asset = assets.find(a => a.id === assetId);
      if (asset) await onAssetDrop(asset, at, lane);
      return;
    }
    const payload = event.dataTransfer.getData(TIMELINE_CLIP_DRAG_TYPE);
    if (payload) {
      try {
        const data = JSON.parse(payload) as { id: string; offset: number };
        const clip = project.clips.find(c => c.id === data.id);
        if (clip && !clip.locked && Number.isFinite(data.offset))
          await onMove(
            clip,
            clipPlacement(
              clip,
              at,
              data.offset,
              event.currentTarget.getBoundingClientRect().width,
              event.altKey
            ).time,
            lane
          );
      } catch {
        /* Unknown external drag payload is ignored. */
      }
      return;
    }
    const files = Array.from(event.dataTransfer.files);
    if (files.length) await onFilesDrop(files, at, lane);
  };
  const beginTrim = (
    event: PointerEvent<HTMLSpanElement>,
    original: TimelineClip,
    side: "start" | "end"
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (original.locked || disabled) return;
    const handle = event.currentTarget;
    const row = handle.closest<HTMLElement>("[data-timeline-lane]");
    if (!row) return;
    const rect = row.getBoundingClientRect();
    const previousEnd = Math.max(
      0,
      ...project.clips
        .filter(
          c =>
            c.id !== original.id &&
            clipLaneKind(c) === clipLaneKind(original) &&
            clipLaneNumber(c) === clipLaneNumber(original) &&
            c.start + c.duration <= original.start + 0.001
        )
        .map(c => c.start + c.duration)
    );
    onSelect(
      original,
      side === "start" ? original.start : original.start + original.duration
    );
    handle.setPointerCapture(event.pointerId);
    let draft = original;
    const move = (e: globalThis.PointerEvent) => {
      const speed = original.speed ?? 1;
      const minimumSpan = Math.min(0.001, original.duration);
      const result = snapTimelineTime({
        time: timeAtTimelinePointer(
          e.clientX,
          rect.left,
          rect.width,
          project.duration
        ),
        points: buildTimelineSnapPoints(
          project.clips,
          project.duration,
          time,
          new Set([original.id])
        ),
        pixelsPerSecond: rect.width / project.duration,
        enabled: snapping && !e.altKey,
        minimum:
          side === "start"
            ? Math.max(previousEnd, original.start - original.inPoint / speed)
            : original.start + minimumSpan,
        maximum:
          side === "start"
            ? original.start + original.duration - minimumSpan
            : original.start + (original.outPoint - original.inPoint) / speed,
      });
      draft = trimTimelineClip(original, side, result.time);
      const actualEdge =
        side === "start" ? draft.start : draft.start + draft.duration;
      setSnapGuide(
        result.point && Math.abs(result.point.time - actualEdge) < 1e-8
          ? result.point
          : null
      );
      setTrimDraft(draft);
      onSeek(side === "start" ? draft.start : draft.start + draft.duration);
    };
    const cleanup = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", cancel);
      setTrimDraft(null);
      setSnapGuide(null);
    };
    const finish = () => {
      cleanup();
      if (draft !== original) void onTrim(draft);
    };
    const cancel = () => cleanup();
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish, { once: true });
    handle.addEventListener("pointercancel", cancel, { once: true });
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-1.5">
        <button
          type="button"
          aria-pressed={snapping}
          onClick={() => {
            setSnapping(value => !value);
            setSnapGuide(null);
          }}
          title="Align moved clips and trimmed edges with the playhead and other clips. Hold Alt for exact placement."
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${snapping ? "bg-primary/15 text-primary" : "text-foreground/50 hover:bg-foreground/5"}`}
        >
          <Magnet className="h-3.5 w-3.5" />
          Clip snapping {snapping ? "on" : "off"}
        </button>
        <span className="text-[10px] text-foreground/45">
          Hold Alt for precise placement
        </span>
        <span
          role="status"
          aria-live="polite"
          className="ml-auto text-[10px] text-cyan-400"
        >
          {snapGuide
            ? `Aligned to ${snapGuide.label.toLowerCase()} · ${fmt(snapGuide.time)}`
            : ""}
        </span>
      </div>
      <div
        className="editor-timeline-scroll overflow-x-auto"
        aria-label="Editing timeline"
      >
        <div className="min-w-[680px]" style={{ width: `${zoom}%` }}>
          <div className="grid grid-cols-[92px_minmax(0,1fr)] border-b border-border bg-background/45">
            <div className="border-r border-border px-3 py-2 font-mono text-xs uppercase tracking-wider text-foreground/60">
              Time
            </div>
            <div
              className="relative mx-1.5 h-9 cursor-crosshair"
              onPointerDown={e => onSeek(pointerTime(e))}
            >
              {Array.from(
                { length: Math.floor(project.duration / 5) + 1 },
                (_, i) => (
                  <span
                    key={i}
                    className="pointer-events-none absolute top-1.5 -translate-x-1/2 font-mono text-[10px] text-foreground/65"
                    style={{ left: `${(i * 500) / project.duration}%` }}
                  >
                    {i * 5}s
                  </span>
                )
              )}
              <input
                type="range"
                min={0}
                max={project.duration}
                step={1 / 30}
                value={time}
                onChange={e => onSeek(Number(e.currentTarget.value))}
                onPointerDown={e => e.stopPropagation()}
                aria-label="Timeline playhead"
                aria-valuetext={fmt(time)}
                className="absolute inset-x-0 bottom-0 h-1 w-full cursor-col-resize accent-primary opacity-50 hover:opacity-100"
              />
            </div>
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute bottom-0 left-[98px] right-1.5 top-0 z-20">
              <div
                className="absolute inset-y-0 w-px bg-primary"
                style={{ left: `${(time / project.duration) * 100}%` }}
              >
                <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-primary" />
              </div>
              {snapGuide && (
                <div
                  className="absolute inset-y-0 w-px bg-cyan-300"
                  style={{
                    left: `${(snapGuide.time / project.duration) * 100}%`,
                  }}
                  aria-hidden="true"
                >
                  <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-cyan-300" />
                </div>
              )}
            </div>
            {lanes.map(lane => {
              const key = `${lane.kind}-${lane.number}`;
              const Icon = icons[lane.kind];
              const clips = project.clips.filter(
                c =>
                  clipLaneKind(c) === lane.kind &&
                  clipLaneNumber(c) === lane.number
              );
              const emptyDestination =
                !clips.length &&
                (lane.kind === "video" || lane.kind === "audio");
              return (
                <div
                  key={key}
                  className={`grid grid-cols-[92px_minmax(0,1fr)] border-b border-border last:border-b-0 ${emptyDestination && lane.number > 1 ? "min-h-[38px]" : "min-h-[62px]"}`}
                >
                  <div className="flex items-center gap-2 border-r border-border bg-background/35 px-3 text-[11px] text-foreground/65">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {names[lane.kind]} {lane.number}
                    </span>
                  </div>
                  <div
                    data-timeline-lane={key}
                    className={`relative mx-1.5 my-1 overflow-hidden rounded-md bg-background/50 ${drop?.lane === key ? "ring-1 ring-primary" : ""}`}
                    onClick={e => onSeek(pointerTime(e))}
                    onDragEnter={e => {
                      if (!disabled && supportsDrop(e)) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }}
                    onDragOver={e => {
                      if (!disabled && supportsDrop(e)) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect =
                          e.dataTransfer.types.includes(TIMELINE_CLIP_DRAG_TYPE)
                            ? "move"
                            : "copy";
                        const at = pointerTime(e);
                        const moving = draggedClip.current;
                        const clip =
                          moving &&
                          project.clips.find(item => item.id === moving.id);
                        if (
                          clip &&
                          moving &&
                          e.dataTransfer.types.includes(TIMELINE_CLIP_DRAG_TYPE)
                        ) {
                          const placement = clipPlacement(
                            clip,
                            at,
                            moving.offset,
                            e.currentTarget.getBoundingClientRect().width,
                            e.altKey
                          );
                          setDrop({ lane: key, time: placement.time });
                          setSnapGuide(placement.point);
                        } else {
                          // New media drops exactly under the pointer, without hidden offsets.
                          setDrop({ lane: key, time: at });
                          setSnapGuide(null);
                        }
                      }
                    }}
                    onDragLeave={e => {
                      if (
                        !e.currentTarget.contains(
                          e.relatedTarget as Node | null
                        )
                      ) {
                        setDrop(null);
                        setSnapGuide(null);
                      }
                    }}
                    onDrop={e => void handleDrop(e, lane)}
                  >
                    {emptyDestination && (
                      <span className="pointer-events-none absolute inset-0 flex items-center px-3 text-[10px] text-foreground/30">
                        {lane.number > 1
                          ? `Drop to layer ${lane.number}`
                          : `Drop ${lane.kind === "audio" ? "audio" : "video or images"} here`}
                      </span>
                    )}
                    {lane.kind === "captions" &&
                      lane.number === 1 &&
                      project.transcript.map(segment => (
                        <button
                          key={segment.id}
                          type="button"
                          className="absolute inset-y-1 truncate rounded-md border border-white/10 bg-emerald-700/85 px-2 text-left text-[11px] text-white"
                          style={{
                            left: `${(segment.start / project.duration) * 100}%`,
                            width: `${Math.max(0.4, ((segment.end - segment.start) / project.duration) * 100)}%`,
                          }}
                          title={segment.text}
                          onClick={e => {
                            e.stopPropagation();
                            const row =
                              e.currentTarget.parentElement!.getBoundingClientRect();
                            onCaptionSelect(
                              timeAtTimelinePointer(
                                e.clientX,
                                row.left,
                                row.width,
                                project.duration
                              )
                            );
                          }}
                        >
                          {segment.text}
                        </button>
                      ))}
                    {clips.map(original => {
                      const clip =
                        trimDraft?.id === original.id ? trimDraft : original;
                      return (
                        <button
                          key={clip.id}
                          type="button"
                          draggable={!clip.locked && !disabled}
                          aria-label={`${clip.label}, ${names[lane.kind]} ${lane.number}, ${fmt(clip.start)} to ${fmt(clip.start + clip.duration)}`}
                          aria-pressed={selectedClipId === clip.id}
                          onDragStart={e => {
                            if (clip.locked) {
                              e.preventDefault();
                              return;
                            }
                            const row =
                              e.currentTarget.parentElement!.getBoundingClientRect();
                            const drag = {
                              id: clip.id,
                              offset: Math.max(
                                0,
                                timeAtTimelinePointer(
                                  e.clientX,
                                  row.left,
                                  row.width,
                                  project.duration
                                ) - clip.start
                              ),
                            };
                            draggedClip.current = drag;
                            e.dataTransfer.setData(
                              TIMELINE_CLIP_DRAG_TYPE,
                              JSON.stringify(drag)
                            );
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            draggedClip.current = null;
                            setDrop(null);
                            setSnapGuide(null);
                          }}
                          onClick={e => {
                            e.stopPropagation();
                            const row =
                              e.currentTarget.parentElement!.getBoundingClientRect();
                            onSelect(
                              clip,
                              e.detail === 0
                                ? clip.start
                                : timeAtTimelinePointer(
                                    e.clientX,
                                    row.left,
                                    row.width,
                                    project.duration
                                  )
                            );
                          }}
                          className={`absolute inset-y-1 overflow-hidden rounded-md border px-2 text-left text-xs font-medium text-white shadow-sm ${selectedClipId === clip.id ? "border-white/80 ring-2 ring-primary/35" : "border-white/10 hover:border-white/40"}`}
                          style={{
                            left: `${(clip.start / project.duration) * 100}%`,
                            width: `${Math.max(0.4, (clip.duration / project.duration) * 100)}%`,
                            backgroundColor: timelineClipColor(clip, assets),
                            opacity: clip.muted ? 0.55 : 1,
                          }}
                          title={`${clip.label} · Drag to move; drag edges to trim`}
                        >
                          <span className="pointer-events-none flex items-center gap-1 truncate">
                            {clip.locked && (
                              <Lock className="h-2.5 w-2.5 shrink-0" />
                            )}
                            {clip.muted && (
                              <VolumeX className="h-2.5 w-2.5 shrink-0" />
                            )}
                            <span className="truncate">{clip.label}</span>
                          </span>
                          <span className="pointer-events-none mt-0.5 block truncate font-mono text-[10px] text-white/65">
                            {fmt(clip.duration)}
                          </span>
                          {!clip.locked &&
                            ["start", "end"].map(side => (
                              <span
                                key={side}
                                role="separator"
                                aria-label={`Trim ${side} of ${clip.label}`}
                                aria-orientation="vertical"
                                draggable={false}
                                onDragStart={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onClick={e => e.stopPropagation()}
                                onPointerDown={e =>
                                  beginTrim(
                                    e,
                                    original,
                                    side as "start" | "end"
                                  )
                                }
                                className={`absolute inset-y-0 z-10 w-1.5 cursor-ew-resize hover:bg-white/70 ${side === "start" ? "left-0" : "right-0"}`}
                              />
                            ))}
                        </button>
                      );
                    })}
                    {drop?.lane === key && (
                      <span
                        className="pointer-events-none absolute inset-y-0 z-30 w-px bg-white"
                        style={{
                          left: `${(drop.time / project.duration) * 100}%`,
                        }}
                      >
                        <span className="absolute left-1 top-0 rounded bg-primary px-1 text-[10px] text-white">
                          {fmt(drop.time)}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
