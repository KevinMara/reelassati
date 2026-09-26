import type {
  Asset,
  EditProject,
  EditRevision,
  TimelineClip,
  TranscriptSegment,
} from "@contracts/workspace";
import type { EditorChatAction } from "@contracts/editor-chat";
import {
  applyEditOperation,
  contentDuration,
  resizeTimeline,
} from "./edit-timeline";
import {
  appendEditorRevisions,
  currentRevisionIndex,
  restoreEditorRevision,
} from "./editor-history";
import {
  allocateTimelineLane,
  clipLaneKind,
  clipLaneNumber,
} from "./timeline-lanes";

export function chatSnapshot(
  project: EditProject,
  id: string,
  label: string
): EditRevision {
  return {
    id,
    label,
    createdAt: new Date().toISOString(),
    duration: project.duration,
    aspectRatio: project.aspectRatio,
    captionStyle: project.captionStyle,
    captionAppearance: project.captionAppearance,
    storyBeats: project.storyBeats,
    clips: structuredClone(project.clips),
    transcript: structuredClone(project.transcript),
    transcriptProvenance: project.transcriptProvenance,
  };
}

/** Persist an action and its reversible edit together. A replay never adds a second clip. */
export function recordChatEdit(
  before: EditProject,
  after: EditProject,
  id: string,
  label: string
): EditProject {
  const projection = (p: EditProject) =>
    JSON.stringify([
      p.clips,
      p.transcript,
      p.duration,
      p.aspectRatio,
      p.captionStyle,
      p.captionAppearance,
      p.storyBeats,
    ]);
  if (projection(before) === projection(after)) return after;
  return {
    ...after,
    updatedAt: new Date().toISOString(),
    ...appendEditorRevisions(
      before,
      [chatSnapshot(after, `chat-revision-${id}`, label)],
      chatSnapshot(before, `chat-before-${id}`, "Before Reel edit")
    ),
  };
}

export function insertChatAsset(
  project: EditProject,
  asset: Asset,
  id: string,
  start: number,
  requestedDuration?: number
): EditProject {
  if (project.clips.some(c => c.id === `chat-clip-${id}`)) return project;
  if (
    asset.status !== "ready" ||
    !["image", "video", "audio", "export"].includes(asset.kind)
  )
    throw new Error("This file is not ready to add to the timeline.");
  const available =
    asset.kind === "image" ? (requestedDuration ?? 5) : asset.duration;
  if (!available || !Number.isFinite(available) || available <= 0)
    throw new Error(
      "The file duration is not available yet. Check the generated file in Library."
    );
  const duration = Math.min(available, requestedDuration ?? available);
  const audio = asset.kind === "audio";
  const clip: TimelineClip = {
    id: `chat-clip-${id}`,
    assetId: asset.id,
    label: asset.name,
    track: audio ? "audio" : "video",
    lane: allocateTimelineLane(
      project.clips,
      audio ? "audio" : "video",
      start,
      duration
    ),
    start,
    duration,
    inPoint: 0,
    outPoint: duration,
    locked: false,
    color: audio ? "#157D98" : asset.kind === "image" ? "#A35A35" : "#6553BE",
    fit: "contain",
  };
  const clips = [...project.clips, clip];
  return {
    ...project,
    clips,
    duration: Math.max(project.duration, contentDuration(clips)),
    activeAssetId: asset.id,
  };
}

export function mapChatTranscript(
  project: EditProject,
  assetId: string,
  segments: TranscriptSegment[]
): TranscriptSegment[] {
  return project.clips
    .filter(c => c.assetId === assetId && !c.muted && !c.graphic)
    .flatMap(clip => {
      const speed = clip.speed ?? 1;
      return segments
        .filter(
          s =>
            s.end > clip.inPoint &&
            s.start < clip.inPoint + clip.duration * speed
        )
        .map(s => ({
          ...s,
          id: `chat-caption-${clip.id}-${s.id}`,
          sourceClipId: clip.id,
          start: clip.start + Math.max(0, s.start - clip.inPoint) / speed,
          end: Math.min(
            clip.start + clip.duration,
            clip.start + (s.end - clip.inPoint) / speed
          ),
        }))
        .filter(s => s.end > s.start);
    })
    .sort((a, b) => a.start - b.start);
}

export function applyChatAction(
  project: EditProject,
  action: EditorChatAction,
  assets: Asset[]
): EditProject {
  let next = project;
  if (action.kind === "history") {
    const current = currentRevisionIndex(project);
    const index = current + (action.direction === "undo" ? -1 : 1);
    if (index < 0 || index >= project.revisions.length)
      throw new Error(`Nothing to ${action.direction}.`);
    return {
      ...restoreEditorRevision(project, index),
      updatedAt: new Date().toISOString(),
    };
  }
  if (action.kind === "edit") {
    if (
      project.proposedChanges.some(
        op => op.id === action.operation.id && op.status === "accepted"
      )
    )
      return project;
    next = applyEditOperation(
      {
        ...project,
        proposedChanges: [
          ...project.proposedChanges.filter(
            op => op.id !== action.operation.id
          ),
          action.operation,
        ],
      },
      action.operation
    );
  } else if (action.kind === "insert") {
    const asset = assets.find(a => a.id === action.assetId);
    if (!asset) throw new Error("The requested file is no longer in Library.");
    next = insertChatAsset(
      project,
      asset,
      action.id,
      action.start,
      action.duration
    );
  } else if (action.kind === "settings") {
    next =
      action.duration !== undefined
        ? resizeTimeline(project, action.duration)
        : { ...project };
    if (action.aspectRatio) next.aspectRatio = action.aspectRatio;
    if (action.captionStyle) {
      next.captionStyle = action.captionStyle;
      next.captionAppearance = undefined;
    }
    if (action.captionAppearance)
      next.captionAppearance = action.captionAppearance;
  } else if (action.kind === "seek") {
    return {
      ...project,
      playhead: Math.max(0, Math.min(project.duration, action.time)),
    };
  } else if (action.kind === "story-beats") {
    next = { ...project, storyBeats: action.beats };
    if (action.splitClips) {
      const boundaries = [
        ...new Set(action.beats.flatMap(beat => [beat.start, beat.end])),
      ].sort((a, b) => a - b);
      next.clips = project.clips.flatMap(clip => {
        if (
          clip.locked ||
          clipLaneKind(clip) !== "video" ||
          clipLaneNumber(clip) !== 1
        )
          return [clip];
        const cuts = [
          clip.start,
          ...boundaries.filter(
            t =>
              t > clip.start + 0.001 && t < clip.start + clip.duration - 0.001
          ),
          clip.start + clip.duration,
        ];
        return cuts.slice(0, -1).map((start, index) => {
          const end = cuts[index + 1];
          const beat = action.beats.find(
            b => start >= b.start - 0.001 && end <= b.end + 0.001
          );
          return {
            ...clip,
            id: index === 0 ? clip.id : `${clip.id}-${action.id}-${index}`,
            start,
            duration: end - start,
            label: beat?.label ?? clip.label,
            inPoint: clip.inPoint + (start - clip.start) * (clip.speed ?? 1),
            outPoint: clip.inPoint + (end - clip.start) * (clip.speed ?? 1),
            fadeIn: index === 0 ? clip.fadeIn : 0,
            fadeOut: index === cuts.length - 2 ? clip.fadeOut : 0,
          };
        });
      });
    }
  }
  return recordChatEdit(project, next, action.id, action.label);
}

/** Paid actions that lost their response need read-only recovery, never automatic replay. */
export function canRunChatAction(
  action: EditorChatAction,
  actions: EditorChatAction[],
  mode: "ask" | "auto",
  remaining: number
) {
  if (
    !Number.isSafeInteger(action.credits) ||
    action.credits < 0 ||
    !Number.isFinite(remaining) ||
    remaining < 0
  )
    return false;
  if (!["pending", "awaiting-approval"].includes(action.status)) return false;
  if (
    action.dependsOn.some(
      id => actions.find(a => a.id === id)?.status !== "completed"
    )
  )
    return false;
  if (action.scope === "extra" && mode === "ask" && !action.runtime?.approved)
    return false;
  return action.credits <= remaining;
}
