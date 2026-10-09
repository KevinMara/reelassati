import { isPrimaryFootage } from "@contracts/timeline-layers";
import { speechAutoZoom, cutSelectedOnBeats } from "./rhythm-editing";
import { clipLaneKind } from "@contracts/timeline-layers";
import { expandLinkedSelection } from "@contracts/clip-groups";
import { mapTranscriptTime } from "@contracts/transcript-timing";
import { projectSplitCaptions } from "./editor-manual";
import {
  applyAdjacentTransition,
  assertNoShotTransition,
} from "@contracts/adjacent-transition";
import type {
  Asset,
  EditProject,
  EditRevision,
  TimelineClip,
  TranscriptSegment,
} from "@contracts/workspace";
import type { EditorChatAction } from "@contracts/editor-chat";
import { exportFrameRates } from "@contracts/export-settings";
import { assertLinkedEditTargets, splitGrouping } from "@contracts/clip-groups";
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
  preserveGraphicDuration,
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
    frameRate: project.frameRate,
    trackSettings: structuredClone(project.trackSettings),
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
      p.frameRate,
      p.trackSettings,
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
          ...mapTranscriptTime(s, t => clip.start + (t - clip.inPoint) / speed),
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
  } else if (action.kind === "speech-zoom") {
    if (project.revisions.some(r => r.id === `chat-revision-${action.id}`))
      return project;
    assertChatRhythmTargets(project, action);
    next = speechAutoZoom(
      project,
      action.targetClipIds,
      action.amount,
      action.replacePath
    );
  } else if (action.kind === "adjacent-transition") {
    next = applyAdjacentTransition(
      project,
      assets,
      action.outgoingId,
      action.incomingId,
      action.transition,
      action.duration
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
    if (
      action.frameRate !== undefined &&
      !exportFrameRates.includes(action.frameRate)
    )
      throw new Error("Choose a frame rate of 24, 25, 30 or 60 fps.");
    next =
      action.duration !== undefined
        ? resizeTimeline(project, action.duration)
        : { ...project };
    if (action.aspectRatio) next.aspectRatio = action.aspectRatio;
    if (action.frameRate !== undefined) next.frameRate = action.frameRate;
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
      const message = project.editorChat?.messages.find(message =>
        message.plan?.actions.some(step => step.id === action.id)
      );
      const selectedClipIds =
        message?.request?.selectedClipIds ?? message?.selectedClipIds;
      const range = message?.request?.range ?? message?.range;
      if (
        range &&
        action.beats.some(
          beat => beat.start < range.start || beat.end > range.end
        )
      )
        throw new Error(
          "These story sections extend outside your selected range."
        );
      const splits: Array<{ original: TimelineClip; pieces: TimelineClip[] }> =
        [];
      const boundaries = [
        ...new Set(action.beats.flatMap(beat => [beat.start, beat.end])),
      ].sort((a, b) => a - b);
      next.clips = project.clips.flatMap(clip => {
        if (
          clip.locked ||
          !isPrimaryFootage(clip) ||
          (selectedClipIds?.length && !selectedClipIds.includes(clip.id))
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
        const original = clip;
        if (cuts.length > 2) assertNoShotTransition(project, [clip.id]);
        if (cuts.length > 2) clip = preserveGraphicDuration(clip);
        const pieces = cuts.slice(0, -1).map((start, index) => {
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
        if (pieces.length > 1) splits.push({ original, pieces });
        return pieces;
      });
      if (splits.length) {
        const targetClipIds = splits.map(split => split.original.id);
        // This legacy section action authorizes primary footage only. A linked
        // structural cut must instead use explicit matching AV edit targets.
        assertLinkedEditTargets(
          project,
          { type: "split", start: 0, end: 0, targetClipIds },
          targetClipIds
        );
        const reserved = new Set(
          [...project.clips, ...next.clips].flatMap(clip => [
            clip.id,
            clip.groupId,
            clip.linkId,
          ])
        );
        let sequence = 0;
        const grouped = splitGrouping(project, splits, () => {
          let id: string;
          do id = `${action.id}-story-membership-${++sequence}`;
          while (reserved.has(id));
          reserved.add(id);
          return id;
        });
        const memberships = new Map(grouped.clips.map(clip => [clip.id, clip]));
        next.clips = next.clips.map(clip => ({
          ...clip,
          groupId: memberships.get(clip.id)?.groupId,
          linkId: memberships.get(clip.id)?.linkId,
        }));
      }
      next.transcript = projectSplitCaptions(project, splits);
    }
  }
  return recordChatEdit(project, next, action.id, action.label);
}

function assertChatRhythmTargets(
  project: EditProject,
  action: Extract<EditorChatAction, { kind: "speech-zoom" | "beat-cuts" }>
) {
  const ids = action.targetClipIds;
  if (
    !ids.length ||
    new Set(ids).size !== ids.length ||
    ids.some(
      id =>
        !project.clips.some(
          c => c.id === id && !c.locked && !c.transitionHandle
        )
    )
  )
    throw new Error("The rhythm edit targets missing or locked clips.");
  const message = project.editorChat?.messages.find(m =>
    m.plan?.actions.some(a => a.id === action.id)
  );
  const selected =
    message?.request?.selectedClipIds ?? message?.selectedClipIds;
  if (
    message?.request?.range ||
    message?.range ||
    (selected?.length && ids.some(id => !selected.includes(id)))
  )
    throw new Error("This rhythm edit extends outside its saved selection.");
  const pictures = ids.filter(
    id => clipLaneKind(project.clips.find(c => c.id === id)!) === "video"
  );
  if (action.kind === "beat-cuts") {
    const peers = expandLinkedSelection(project, pictures, {
      groups: false,
      links: true,
    });
    if (
      !pictures.length ||
      peers.some(id => !ids.includes(id)) ||
      ids.some(id => !peers.includes(id))
    )
      throw new Error(
        "Beat cuts require every explicitly targeted linked audio/video peer."
      );
  } else if (pictures.length !== ids.length)
    throw new Error("Speech zoom needs picture targets only.");
  return pictures;
}

export function applyMeasuredBeatAction(
  project: EditProject,
  action: Extract<EditorChatAction, { kind: "beat-cuts" }>,
  times: number[]
) {
  if (project.revisions.some(r => r.id === `chat-revision-${action.id}`))
    return project;
  const pictures = assertChatRhythmTargets(project, action);
  const reserved = new Set(
    project.clips.flatMap(c => [c.id, c.linkId, c.groupId])
  );
  let sequence = 0;
  const makeId = () => {
    let id: string;
    do id = `${action.id}-beat-piece-${++sequence}`;
    while (reserved.has(id));
    reserved.add(id);
    return id;
  };
  return recordChatEdit(
    project,
    cutSelectedOnBeats(project, pictures, times, makeId),
    action.id,
    action.label
  );
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
