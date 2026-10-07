import { mapTranscriptTime } from "@contracts/transcript-timing";
import type {
  Asset,
  EditProject,
  TimelineClip,
  TranscriptSegment,
} from "@contracts/workspace";
import {
  allocateTimelineLane,
  clipLaneKind,
  clipLaneNumber,
  preserveGraphicDuration,
} from "./timeline-lanes";

import { captionOwner } from "@contracts/caption-ownership";
import {
  assertNoShotTransition,
  transitionFreeClip,
} from "@contracts/adjacent-transition";
export { captionOwner } from "@contracts/caption-ownership";

/** Project cue and measured word clocks onto split source spans, using the original
 * ownership snapshot. This also handles a gap closure or local style segmentation. */
export function projectSplitCaptions(
  project: EditProject,
  splits: Array<{ original: TimelineClip; pieces: TimelineClip[] }>
): TranscriptSegment[] {
  const byId = new Map(splits.map(split => [split.original.id, split]));
  return project.transcript.flatMap(segment => {
    const owner = captionOwner(project, segment);
    const split = owner && byId.get(owner.id);
    if (!split) return [segment];
    let retained = 0;
    return split.pieces.flatMap(piece => {
      const mapped = mapTranscriptTime(
        segment,
        time =>
          piece.start +
          (split.original.inPoint +
            (time - split.original.start) * (split.original.speed ?? 1) -
            piece.inPoint) /
            (piece.speed ?? 1),
        { start: piece.start, end: piece.start + piece.duration }
      );
      if (mapped.end <= mapped.start || !mapped.text.trim()) return [];
      return [
        {
          ...mapped,
          id: retained++ === 0 ? segment.id : `${segment.id}-piece-${piece.id}`,
          sourceClipId: piece.id,
        },
      ];
    });
  });
}

/** Split every selected clip crossing the playhead in one reversible revision. */
export function splitClipGroup(
  project: EditProject,
  ids: string[],
  time: number,
  makeId: () => string
) {
  const selected = project.clips.filter(c => ids.includes(c.id));
  if (selected.some(c => c.locked))
    throw new Error("Unlock the selection before splitting it.");
  const splits = selected
    .filter(
      c => time > c.start + 0.000001 && time < c.start + c.duration - 0.000001
    )
    .map(original => {
      const c = preserveGraphicDuration(original),
        offset = time - c.start;
      return {
        original,
        pieces: [
          {
            ...c,
            duration: offset,
            fadeOut: 0,
            outPoint: c.inPoint + offset * (c.speed ?? 1),
          },
          {
            ...c,
            id: makeId(),
            label: `${c.label} · B`,
            start: time,
            duration: c.duration - offset,
            fadeIn: 0,
            inPoint: c.inPoint + offset * (c.speed ?? 1),
          },
        ],
      };
    });
  if (!splits.length)
    throw new Error(
      "Place the playhead inside a selected clip before splitting."
    );
  assertNoShotTransition(
    project,
    splits.map(s => s.original.id)
  );
  return {
    project: {
      ...project,
      transcript: projectSplitCaptions(project, splits),
      clips: project.clips.flatMap(
        c => splits.find(s => s.original.id === c.id)?.pieces ?? [c]
      ),
    },
    ids: splits.map(s => s.pieces[1].id),
  };
}

export function toggleTimelineLane(
  project: EditProject,
  lane: { kind: import("./timeline-lanes").TimelineLaneKind; number: number },
  property: "locked" | "muted" | "hidden"
): EditProject {
  const group = project.clips.filter(
    c => clipLaneKind(c) === lane.kind && clipLaneNumber(c) === lane.number
  );
  if (!group.length) return project;
  if (property !== "locked" && group.some(c => c.locked))
    throw new Error(
      "Unlock this track’s clips before changing visibility or sound."
    );
  const eligible =
    property === "muted" ? group.filter(c => !c.transitionHandle) : group;
  const value = !eligible.every(c => Boolean(c[property]));
  const ids = new Set(eligible.map(c => c.id));
  return {
    ...project,
    clips: project.clips.map(c =>
      ids.has(c.id) ? { ...c, [property]: value } : c
    ),
  };
}

/** Captions on the primary speech lane follow source time through manual trims/speed changes. */
export function replaceTimelineClip(
  project: EditProject,
  id: string,
  replacement?: TimelineClip
): EditProject {
  const original = project.clips.find(c => c.id === id);
  if (!original) throw new Error("This clip is no longer available.");
  if (original.locked) throw new Error("Unlock this clip before editing it.");
  const timingChanged =
    !replacement ||
    [
      "start",
      "duration",
      "inPoint",
      "outPoint",
      "speed",
      "lane",
      "track",
      "assetId",
    ].some(
      key =>
        original[key as keyof TimelineClip] !==
        replacement[key as keyof TimelineClip]
    );
  const follows = timingChanged;
  if (
    timingChanged ||
    (replacement &&
      [
        "visual",
        "fit",
        "brightness",
        "contrast",
        "saturation",
        "fadeIn",
        "fadeOut",
        "hidden",
      ].some(
        key =>
          JSON.stringify(original[key as keyof TimelineClip]) !==
          JSON.stringify(replacement[key as keyof TimelineClip])
      ))
  )
    assertNoShotTransition(project, [id]);
  const transcript = follows
    ? project.transcript.flatMap(segment => {
        if (captionOwner(project, segment)?.id !== id) return [segment];
        if (!replacement) return [];
        const sourceStart =
          original.inPoint +
          (segment.start - original.start) * (original.speed ?? 1);
        const sourceEnd =
          original.inPoint +
          (segment.end - original.start) * (original.speed ?? 1);
        const start = Math.max(
          replacement.start,
          replacement.start +
            (sourceStart - replacement.inPoint) / (replacement.speed ?? 1)
        );
        const end = Math.min(
          replacement.start + replacement.duration,
          replacement.start +
            (sourceEnd - replacement.inPoint) / (replacement.speed ?? 1)
        );
        return end > start
          ? [
              {
                ...mapTranscriptTime(
                  segment,
                  t =>
                    replacement.start +
                    (original.inPoint +
                      (t - original.start) * (original.speed ?? 1) -
                      replacement.inPoint) /
                      (replacement.speed ?? 1),
                  { start, end }
                ),
                sourceClipId: id,
              },
            ]
          : [];
      })
    : project.transcript;
  return {
    ...project,
    transcript,
    clips: project.clips.flatMap(c =>
      c.id !== id ? [c] : replacement ? [replacement] : []
    ),
  };
}

export function detachClipAudio(
  project: EditProject,
  clipId: string,
  assets: Asset[],
  newId: string
): EditProject {
  const clip = project.clips.find(c => c.id === clipId);
  if (
    !clip ||
    clip.locked ||
    clip.transitionHandle ||
    clip.muted ||
    !assets.some(a => a.id === clip.assetId && a.kind === "video") ||
    clipLaneKind(clip) !== "video"
  )
    throw new Error("Select an unlocked video with its source audio enabled.");
  const audio: TimelineClip = {
    ...clip,
    id: newId,
    track: "audio",
    label: `${clip.label} · audio`,
    lane: allocateTimelineLane(
      project.clips,
      "audio",
      clip.start,
      clip.duration
    ),
    color: "#B3567D",
    graphic: undefined,
    shotTransition: undefined,
    transitionHandle: false,
    primaryFootage: false,
  };
  return {
    ...project,
    transcript: project.transcript.map(s =>
      captionOwner(project, s)?.id === clipId
        ? { ...s, sourceClipId: newId }
        : s
    ),
    clips: [
      ...project.clips.map(c => (c.id === clipId ? { ...c, muted: true } : c)),
      audio,
    ],
  };
}

export function moveClipGroup(
  project: EditProject,
  ids: string[],
  anchorId: string,
  time: number,
  lane: number
): EditProject {
  const group = project.clips.filter(c => ids.includes(c.id)),
    anchor = group.find(c => c.id === anchorId);
  if (!anchor || group.some(c => c.locked))
    throw new Error("Unlock the selected clips before moving them together.");
  assertNoShotTransition(project, ids);
  const delta = Math.max(
    -Math.min(...group.map(c => c.start)),
    time - anchor.start
  );
  const anchorKind = clipLaneKind(anchor);
  const laneDelta = Math.max(
    1 -
      Math.min(
        ...group.filter(c => clipLaneKind(c) === anchorKind).map(clipLaneNumber)
      ),
    lane - clipLaneNumber(anchor)
  );
  const moving = group.map(c => ({
    ...c,
    start: c.start + delta,
    lane: Math.max(
      1,
      clipLaneNumber(c) + (clipLaneKind(c) === anchorKind ? laneDelta : 0)
    ),
  }));
  const stationary = project.clips.filter(c => !ids.includes(c.id));
  for (const kind of new Set(moving.map(clipLaneKind))) {
    const family = moving.filter(c => clipLaneKind(c) === kind);
    let shift = 0;
    while (
      family.some(c =>
        stationary.some(
          other =>
            clipLaneKind(other) === kind &&
            clipLaneNumber(other) === c.lane + shift &&
            c.start < other.start + other.duration - 0.000001 &&
            c.start + c.duration > other.start + 0.000001
        )
      )
    )
      shift++;
    family.forEach(c => {
      c.lane += shift;
    });
  }
  // All caption projections use the original snapshot, so two moved clips cannot retime the same cue twice.
  const transcript = project.transcript.flatMap(segment => {
    const owner = captionOwner(project, segment);
    const original = group.find(c => c.id === owner?.id);
    return original ? [mapTranscriptTime(segment, t => t + delta)] : [segment];
  });
  return {
    ...project,
    transcript,
    clips: project.clips.map(c => moving.find(m => m.id === c.id) ?? c),
  };
}

export function deleteClipGroup(
  project: EditProject,
  ids: string[]
): EditProject {
  const group = project.clips.filter(c => ids.includes(c.id));
  if (group.some(c => c.locked))
    throw new Error("Unlock the selected clips before deleting them.");
  assertNoShotTransition(project, ids);
  return {
    ...project,
    clips: project.clips.filter(c => !ids.includes(c.id)),
    transcript: project.transcript.filter(
      s => !group.some(c => c.id === captionOwner(project, s)?.id)
    ),
  };
}

export function pasteClipGroup(
  project: EditProject,
  source: TimelineClip[],
  time: number,
  makeId: () => string,
  sourceTranscript = project.transcript
): { project: EditProject; ids: string[] } {
  source = source
    .filter(c => !c.transitionHandle)
    .map(c => transitionFreeClip({ clips: [...project.clips, ...source] }, c));
  if (!source.length) return { project, ids: [] };
  const first = Math.min(...source.map(c => c.start));
  const added = source.map(c => ({
    ...structuredClone(c),
    id: makeId(),
    start: c.start - first + Math.max(0, time),
    locked: false,
  }));
  // Treat pasted clips as a group when allocating lanes to preserve layer order.
  const staged = { ...project, clips: [...project.clips, ...added] };
  const placed = moveClipGroup(
    staged,
    added.map(c => c.id),
    added[0].id,
    added[0].start,
    clipLaneNumber(added[0])
  );
  const copiedCaptions = sourceTranscript.flatMap(segment => {
    const index = source.findIndex(
      c => c.id === captionOwner({ clips: source }, segment)?.id
    );
    if (index < 0) return [];
    const clone = placed.clips.find(c => c.id === added[index].id)!;
    const delta = clone.start - source[index].start;
    return [
      {
        ...mapTranscriptTime(segment, t => t + delta),
        id: makeId(),
        sourceClipId: clone.id,
        start: segment.start + delta,
        end: segment.end + delta,
      },
    ];
  });
  return {
    project: {
      ...placed,
      transcript: [...placed.transcript, ...copiedCaptions].sort(
        (a, b) => a.start - b.start
      ),
    },
    ids: added.map(c => c.id),
  };
}
