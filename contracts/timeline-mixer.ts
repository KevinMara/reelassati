import type { EditProject, TimelineClip } from "./workspace";
import {
  clipLaneKind,
  clipLaneNumber,
  isPrimaryFootage,
  type TimelineLaneKind,
} from "./timeline-layers";
import { assertNoShotTransition } from "./adjacent-transition";
import { captionOwner } from "./caption-ownership";

export interface TimelineTrackSettings {
  kind: TimelineLaneKind;
  number: number;
  name?: string;
  gain?: number;
  soloSound?: boolean;
  soloPicture?: boolean;
}
export type TimelineTrack = Pick<TimelineTrackSettings, "kind" | "number">;
const sameLane = (clip: TimelineClip, lane: TimelineTrack) =>
  clipLaneKind(clip) === lane.kind && clipLaneNumber(clip) === lane.number;
const sameSettings = (a: TimelineTrack, b: TimelineTrack) =>
  a.kind === b.kind && a.number === b.number;

export function timelineTrackSettings(
  project: EditProject,
  lane: TimelineTrack
) {
  return project.trackSettings?.find(row => sameSettings(row, lane));
}

export function timelineTrackGain(project: EditProject, clip: TimelineClip) {
  const gain = timelineTrackSettings(project, {
    kind: clipLaneKind(clip),
    number: clipLaneNumber(clip),
  })?.gain;
  return typeof gain === "number" && Number.isFinite(gain)
    ? Math.max(0, Math.min(2, gain))
    : 1;
}

/** Solo is evaluated at playback/export time; it never overwrites clip flags. */
export function effectiveTimelineClips(project: EditProject): TimelineClip[] {
  const occupied = (project.trackSettings ?? []).filter(row =>
    project.clips.some(clip => sameLane(clip, row))
  );
  const soundSolo = occupied.filter(
    row => row.soloSound && ["audio", "video"].includes(row.kind)
  );
  const pictureSolo = occupied.filter(
    row => row.soloPicture && ["video", "text", "graphics"].includes(row.kind)
  );
  return project.clips.map(clip => {
    const kind = clipLaneKind(clip),
      number = clipLaneNumber(clip);
    const lane = { kind, number };
    const muted =
      clip.muted ||
      (soundSolo.length > 0 && !soundSolo.some(row => sameSettings(row, lane)));
    const hidden =
      clip.hidden ||
      (pictureSolo.length > 0 &&
        kind !== "audio" &&
        kind !== "captions" &&
        !pictureSolo.some(row => sameSettings(row, lane)));
    return muted === clip.muted && hidden === clip.hidden
      ? clip
      : { ...clip, muted: Boolean(muted), hidden: Boolean(hidden) };
  });
}

export function updateTimelineTrack(
  project: EditProject,
  lane: TimelineTrack,
  patch: Omit<Partial<TimelineTrackSettings>, "kind" | "number">
): EditProject {
  const clips = project.clips.filter(clip => sameLane(clip, lane));
  if (
    !clips.length &&
    !(
      lane.kind === "captions" &&
      lane.number === 1 &&
      project.transcript.length
    )
  )
    throw new Error("This track is no longer available.");
  if (
    clips.some(clip => clip.locked) &&
    (patch.gain !== undefined ||
      patch.soloSound !== undefined ||
      patch.soloPicture !== undefined)
  )
    throw new Error("Unlock this track before changing its mix.");
  if (
    patch.gain !== undefined &&
    (!Number.isFinite(patch.gain) || patch.gain < 0 || patch.gain > 2)
  )
    throw new Error("Track gain must be between 0 and 200%.");
  if (
    patch.name !== undefined &&
    (!patch.name.trim() || patch.name.trim().length > 60)
  )
    throw new Error("Use a track name between 1 and 60 characters.");
  if (patch.soloSound !== undefined && !["video", "audio"].includes(lane.kind))
    throw new Error("This track has no source sound.");
  if (
    patch.soloPicture !== undefined &&
    !["video", "text", "graphics"].includes(lane.kind)
  )
    throw new Error("This track has no picture to solo.");
  const next = {
    ...timelineTrackSettings(project, lane),
    ...lane,
    ...patch,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
  };
  return {
    ...project,
    trackSettings: [
      ...(project.trackSettings ?? []).filter(row => !sameSettings(row, lane)),
      next,
    ],
  };
}

/** Swaps occupied lanes in one family, preserving primary speech and cue ownership. */
export function reorderTimelineTrack(
  project: EditProject,
  lane: TimelineTrack,
  direction: "up" | "down"
): EditProject {
  const numbers = [
    ...new Set(
      project.clips
        .filter(clip => clipLaneKind(clip) === lane.kind)
        .map(clipLaneNumber)
    ),
  ].sort((a, b) => b - a);
  const at = numbers.indexOf(lane.number);
  const other = numbers[at + (direction === "up" ? -1 : 1)];
  if (at < 0 || other === undefined) return project;
  const affected = project.clips.filter(
    clip =>
      clipLaneKind(clip) === lane.kind &&
      [lane.number, other].includes(clipLaneNumber(clip))
  );
  if (affected.some(clip => clip.locked))
    throw new Error("Unlock both tracks before reordering.");
  assertNoShotTransition(
    project,
    affected.map(clip => clip.id)
  );
  const remap = (number: number) =>
    number === lane.number ? other : number === other ? lane.number : number;
  return {
    ...project,
    transcript: project.transcript.map(cue => ({
      ...cue,
      sourceClipId: cue.sourceClipId ?? captionOwner(project, cue)?.id,
    })),
    clips: project.clips.map(clip =>
      clipLaneKind(clip) === lane.kind
        ? {
            ...clip,
            ...(lane.kind === "video"
              ? { primaryFootage: isPrimaryFootage(clip) }
              : {}),
            lane: remap(clipLaneNumber(clip)),
          }
        : clip
    ),
    trackSettings: project.trackSettings?.map(row =>
      row.kind === lane.kind ? { ...row, number: remap(row.number) } : row
    ),
  };
}
