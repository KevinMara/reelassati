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
} from "./timeline-lanes";

/** Explicit ownership prevents music edits from changing speech captions. Legacy cues
 * conservatively follow primary video only; imported audio cues acquire ownership on transcription. */
export function captionOwner(
  project: Pick<EditProject, "clips">,
  segment: TranscriptSegment
): TimelineClip | undefined {
  const covers = (c: TimelineClip) =>
    segment.start >= c.start && segment.start < c.start + c.duration;
  if (segment.sourceClipId)
    return (
      project.clips.find(c => c.id === segment.sourceClipId && covers(c)) ??
      project.clips.find(
        c => c.id.startsWith(`${segment.sourceClipId}-`) && covers(c)
      )
    );
  return (
    project.clips.find(
      c => clipLaneKind(c) === "video" && clipLaneNumber(c) === 1 && covers(c)
    ) ??
    (!project.clips.some(c => clipLaneKind(c) === "video")
      ? project.clips.find(
          c =>
            clipLaneKind(c) === "audio" && clipLaneNumber(c) === 1 && covers(c)
        )
      : undefined)
  );
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
    ["start", "duration", "inPoint", "speed"].some(
      key =>
        original[key as keyof TimelineClip] !==
        replacement[key as keyof TimelineClip]
    );
  const follows = timingChanged;
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
          ? [{ ...segment, sourceClipId: id, start, end }]
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
    return original
      ? [{ ...segment, start: segment.start + delta, end: segment.end + delta }]
      : [segment];
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
    if (clipLaneNumber(clone) !== 1) return [];
    const delta = clone.start - source[index].start;
    return [
      {
        ...segment,
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
