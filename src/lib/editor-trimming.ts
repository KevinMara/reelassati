import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import { assertNoShotTransition } from "@contracts/adjacent-transition";
import { clipLaneKind, clipLaneNumber } from "@contracts/timeline-layers";
import { expandLinkedSelection } from "@contracts/clip-groups";
import { projectSplitCaptions } from "./editor-manual";

const epsilon = 0.000001;
function linked(project: EditProject, clip: TimelineClip) {
  const ids = expandLinkedSelection(project, [clip.id], {
    groups: false,
    links: true,
  });
  return project.clips.filter(c => ids.includes(c.id));
}
function sourceLimit(clip: TimelineClip, assets: Asset[]) {
  const asset = assets.find(a => a.id === clip.assetId);
  return asset?.kind === "image" || clip.graphic
    ? Infinity
    : (asset?.duration ?? clip.outPoint);
}
function commitPieces(
  project: EditProject,
  originals: TimelineClip[],
  pieces: TimelineClip[],
  assets: Asset[]
): EditProject {
  if (originals.some(c => c.locked))
    throw new Error("Unlock the linked clips before changing their timing.");
  assertNoShotTransition(
    project,
    originals.map(c => c.id)
  );
  for (const clip of pieces) {
    if (
      ![
        clip.start,
        clip.duration,
        clip.inPoint,
        clip.outPoint,
        clip.speed ?? 1,
      ].every(Number.isFinite) ||
      clip.start < 0 ||
      clip.duration <= epsilon ||
      clip.inPoint < -epsilon ||
      clip.outPoint > sourceLimit(clip, assets) + epsilon ||
      (clip.speed ?? 1) < 0.25 ||
      (clip.speed ?? 1) > 4 ||
      Math.abs(
        (clip.outPoint - clip.inPoint) / (clip.speed ?? 1) - clip.duration
      ) > 0.001
    )
      throw new Error(
        "The edit exceeds a source boundary or supported playback speed."
      );
    if (
      project.clips.some(
        other =>
          !originals.some(c => c.id === other.id) &&
          clipLaneKind(other) === clipLaneKind(clip) &&
          clipLaneNumber(other) === clipLaneNumber(clip) &&
          other.start < clip.start + clip.duration - epsilon &&
          other.start + other.duration > clip.start + epsilon
      )
    )
      throw new Error(
        "This timing would overlap another clip on the same track."
      );
  }
  const splits = originals.map((original, index) => ({
    original,
    pieces: [pieces[index]],
  }));
  return {
    ...project,
    duration: Math.max(
      project.duration,
      ...pieces.map(c => c.start + c.duration)
    ),
    clips: project.clips.map(c => pieces.find(piece => piece.id === c.id) ?? c),
    transcript: projectSplitCaptions(project, splits),
  };
}
function selected(project: EditProject, id: string) {
  const clip = project.clips.find(c => c.id === id);
  if (!clip) throw new Error("Select a current clip.");
  return clip;
}

/** Change the source window while keeping the clip's placement and duration. */
export function slipTimelineSource(
  project: EditProject,
  id: string,
  sourceDelta: number,
  assets: Asset[]
) {
  const clip = selected(project, id);
  if (!Number.isFinite(sourceDelta))
    throw new Error("Enter a finite source offset.");
  const originals = linked(project, clip);
  const pieces = originals.map(c => {
    const delta = (sourceDelta / (clip.speed ?? 1)) * (c.speed ?? 1);
    return { ...c, inPoint: c.inPoint + delta, outPoint: c.outPoint + delta };
  });
  return commitPieces(project, originals, pieces, assets);
}

/** Preserve source spans and change playback speed to fit the chosen duration. */
export function rateStretchTimelineClip(
  project: EditProject,
  id: string,
  duration: number,
  assets: Asset[]
) {
  const clip = selected(project, id);
  const originals = linked(project, clip);
  if (
    originals.some(
      c => c.graphic || assets.find(a => a.id === c.assetId)?.kind === "image"
    )
  )
    throw new Error("Rate stretch applies to video and audio sources.");
  const pieces = originals.map(c => ({
    ...c,
    duration,
    speed: (c.outPoint - c.inPoint) / duration,
  }));
  return commitPieces(project, originals, pieces, assets);
}

export function nextRollingClip(project: EditProject, clip: TimelineClip) {
  return project.clips.find(
    c =>
      c.id !== clip.id &&
      clipLaneKind(c) === clipLaneKind(clip) &&
      clipLaneNumber(c) === clipLaneNumber(clip) &&
      Math.abs(c.start - (clip.start + clip.duration)) < epsilon
  );
}

/** Move a touching cut, preserving the pair's outer placement and total duration. */
export function rollTimelineCut(
  project: EditProject,
  id: string,
  delta: number,
  assets: Asset[]
) {
  const left = selected(project, id),
    right = nextRollingClip(project, left);
  if (!right)
    throw new Error("Select a clip with a touching next clip on its track.");
  if (!Number.isFinite(delta)) throw new Error("Enter a finite cut offset.");
  const lefts = linked(project, left),
    rights = linked(project, right);
  if (lefts.some(c => rights.some(other => other.id === c.id)))
    throw new Error("Unlink these adjacent clips before rolling their cut.");
  const paired = lefts.map(a => ({
    a,
    b: rights.find(
      b =>
        clipLaneKind(a) === clipLaneKind(b) &&
        clipLaneNumber(a) === clipLaneNumber(b) &&
        Math.abs(a.start + a.duration - b.start) < epsilon
    ),
  }));
  if (paired.some(pair => !pair.b) || paired.length !== rights.length)
    throw new Error(
      "Both sides need matching linked tracks before rolling the cut. Unlink them to edit independently."
    );
  const originals = paired.flatMap(({ a, b }) => [a, b!]);
  const pieces = paired.flatMap(({ a, b }) => [
    {
      ...a,
      duration: a.duration + delta,
      outPoint: a.outPoint + delta * (a.speed ?? 1),
    },
    {
      ...b!,
      start: b!.start + delta,
      duration: b!.duration - delta,
      inPoint: b!.inPoint + delta * (b!.speed ?? 1),
    },
  ]);
  return commitPieces(project, originals, pieces, assets);
}
