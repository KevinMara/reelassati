import { mapTranscriptTime } from "@contracts/transcript-timing";
import { captionOwner, projectSplitCaptions } from "./editor-manual";
import {
  allocateTimelineLane,
  preserveGraphicDuration,
} from "./timeline-lanes";
import { normalizeGraphic } from "@contracts/motion-graphics";
import { patchVisual } from "@contracts/clip-visual";
import { assertNoShotTransition } from "@contracts/adjacent-transition";
import {
  assertLinkedEditTargets,
  normalizeClipGroups,
  splitGrouping,
} from "@contracts/clip-groups";
import type {
  EditOperation,
  EditProject,
  TimelineClip,
} from "@contracts/workspace";

export function contentDuration(clips: TimelineClip[], empty = 1): number {
  return Math.max(empty, ...clips.map(c => c.start + c.duration));
}

/** Structural revisions create deterministic membership IDs without joining an
 * existing clip, group or AV link, including newly generated pieces. */
function membershipIds(
  project: EditProject,
  seed: string,
  pieces: TimelineClip[]
) {
  const reserved = new Set(
    [...project.clips, ...pieces].flatMap(c => [c.id, c.groupId, c.linkId])
  );
  let count = 0;
  return () => {
    let id: string;
    do id = `${seed}-membership-${++count}`;
    while (reserved.has(id));
    reserved.add(id);
    return id;
  };
}

/** Remove an interval from every unlocked track; preserve source offsets and captions. */
export function rippleRemove(
  project: EditProject,
  start: number,
  end: number
): EditProject {
  if (
    ![start, end].every(Number.isFinite) ||
    start < 0 ||
    end > project.duration
  )
    throw new Error("Choose an interval inside the timeline.");
  const length = end - start;
  if (length <= 0) return project;
  assertNoShotTransition(
    project,
    project.clips.filter(c => c.start + c.duration > start).map(c => c.id)
  );
  if (project.clips.some(c => c.locked && c.start + c.duration > start)) {
    throw new Error(
      "Unlock the clips after this point before closing the gap."
    );
  }
  const splits: Array<{ original: TimelineClip; pieces: TimelineClip[] }> = [];
  const clips = project.clips.map(preserveGraphicDuration).flatMap(c => {
    const finish = c.start + c.duration;
    if (finish <= start) return [c];
    if (c.start >= end) {
      const pieces = [{ ...c, start: c.start - length }];
      splits.push({ original: c, pieces });
      return pieces;
    }
    const pieces: TimelineClip[] = [];
    if (c.start < start)
      pieces.push({
        ...c,
        duration: start - c.start,
        fadeOut: finish > end ? 0 : c.fadeOut,
        outPoint: c.inPoint + (start - c.start) * (c.speed ?? 1),
      });
    if (finish > end)
      pieces.push({
        ...c,
        id: `${c.id}-after-${end}`,
        start,
        duration: finish - end,
        inPoint: c.inPoint + (end - c.start) * (c.speed ?? 1),
        fadeIn: c.start < start ? 0 : c.fadeIn,
      });
    splits.push({ original: c, pieces });
    return pieces;
  });
  const projected = projectSplitCaptions(project, splits);
  const transcript = projected.flatMap(s => {
    if (
      captionOwner(project, project.transcript.find(t => t.id === s.id) ?? s) ||
      s.sourceClipId
    )
      return [s];
    if (s.end <= start) return [s];
    if (s.start >= end) return [mapTranscriptTime(s, t => t - length)];
    const before =
      s.start < start
        ? mapTranscriptTime(s, t => t, { start: s.start, end: start })
        : undefined;
    const after =
      s.end > end
        ? mapTranscriptTime(s, t => t - length, { start, end: s.end - length })
        : undefined;
    return [
      ...(before?.text.trim() && before.end > before.start
        ? [{ ...before, id: `${s.id}-before-${start}` }]
        : []),
      ...(after?.text.trim() && after.end > after.start
        ? [
            {
              ...after,
              id: `${s.id}-after-${end}`,
              sourceClipId:
                s.sourceClipId &&
                clips.some(c => c.id === `${s.sourceClipId}-after-${end}`)
                  ? `${s.sourceClipId}-after-${end}`
                  : s.sourceClipId,
            },
          ]
        : []),
    ];
  });
  const removed = new Set(
    splits.filter(s => !s.pieces.length).map(s => s.original.id)
  );
  const base = {
    ...project,
    clips: project.clips
      .filter(c => !removed.has(c.id))
      .map(preserveGraphicDuration),
  };
  const grouped = splitGrouping(
    base,
    splits.filter(s => s.pieces.length),
    membershipIds(project, `ripple-${start}-${end}`, clips)
  );
  const duration = Math.max(
    0.2,
    project.duration - length,
    contentDuration(clips, 0.2)
  );
  return {
    ...project,
    clips: grouped.clips,
    transcript,
    duration,
    playhead: Math.min(
      duration,
      project.playhead <= start
        ? project.playhead
        : project.playhead >= end
          ? project.playhead - length
          : start
    ),
  };
}

/** Remove only the union of selected time spans, across every unlocked track. */
export function rippleDeleteSelection(
  project: EditProject,
  ids: string[]
): EditProject {
  const intervals = project.clips
    .filter(c => ids.includes(c.id))
    .map(c => ({
      start: c.start,
      end: Math.min(project.duration, c.start + c.duration),
    }))
    .sort((a, b) => a.start - b.start);
  if (!intervals.length)
    throw new Error("Select clips whose time you want to remove.");
  const merged: typeof intervals = [];
  for (const range of intervals) {
    const last = merged.at(-1);
    if (last && range.start <= last.end)
      last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged
    .reverse()
    .reduce(
      (current, range) => rippleRemove(current, range.start, range.end),
      project
    );
}

export function resizeTimeline(project: EditProject, end: number): EditProject {
  if (!Number.isFinite(end) || end < 0.2)
    throw new Error("Choose a duration of at least 0.2 seconds.");
  assertNoShotTransition(
    project,
    project.clips.filter(c => c.start + c.duration > end).map(c => c.id)
  );
  if (project.clips.some(c => c.locked && c.start + c.duration > end))
    throw new Error(
      "Unlock clips beyond the new end before shortening the edit."
    );
  return normalizeClipGroups({
    ...project,
    duration: end,
    playhead: Math.min(project.playhead, end),
    clips: project.clips
      .map(preserveGraphicDuration)
      .filter(c => c.start < end)
      .map(c => ({
        ...c,
        duration: Math.min(c.duration, end - c.start),
        outPoint: Math.min(
          c.outPoint,
          c.inPoint + (end - c.start) * (c.speed ?? 1)
        ),
      })),
    transcript: project.transcript
      .filter(s => s.start < end)
      .map(s => mapTranscriptTime(s, t => t, { start: 0, end })),
  });
}

/** Execute supported decisions on actual media, never merely mark a suggestion accepted. */
export function applyEditOperation(
  project: EditProject,
  op: EditOperation
): EditProject {
  const p = op.parameters ?? {};
  const targets = new Set(op.targetClipIds);
  const targeted = (c: TimelineClip) => targets.has(c.id) && !c.locked;
  if (
    ["trim", "split", "move", "delete", "pacing", "style"].includes(op.type) ||
    (op.type === "audio" &&
      project.clips.some(
        c =>
          targeted(c) && (op.start > c.start || op.end < c.start + c.duration)
      ))
  )
    assertNoShotTransition(
      project,
      project.clips.filter(targeted).map(c => c.id)
    );
  if (
    !["caption", "broll", "silence", "graphic"].includes(op.type) &&
    !project.clips.some(targeted)
  )
    throw new Error(
      "Choose an unlocked target clip before applying this change."
    );
  let next = {
    ...project,
    clips: project.clips.map(c => ({ ...preserveGraphicDuration(c) })),
    transcript: project.transcript.map(s => ({ ...s })),
  };
  const captionSplits: Array<{
    original: TimelineClip;
    pieces: TimelineClip[];
  }> = [];
  // Local look/audio adjustments must not leak to the rest of a long source clip.
  if (op.type === "style" || op.type === "audio") {
    next.clips = next.clips.flatMap(c => {
      if (!targeted(c)) return [c];
      const start = Math.max(c.start, op.start);
      const end = Math.min(c.start + c.duration, op.end);
      if (end <= start) {
        targets.delete(c.id);
        return [c];
      }
      const speed = c.speed ?? 1;
      const parts: TimelineClip[] = [];
      if (start > c.start)
        parts.push({
          ...c,
          id: `${c.id}-${op.id}-before`,
          duration: start - c.start,
          fadeOut: 0,
          outPoint: c.inPoint + (start - c.start) * speed,
        });
      parts.push({
        ...c,
        start,
        duration: end - start,
        inPoint: c.inPoint + (start - c.start) * speed,
        outPoint: c.inPoint + (end - c.start) * speed,
        fadeIn: start > c.start ? 0 : c.fadeIn,
        fadeOut: end < c.start + c.duration ? 0 : c.fadeOut,
      });
      if (end < c.start + c.duration)
        parts.push({
          ...c,
          id: `${c.id}-${op.id}-after`,
          start: end,
          duration: c.start + c.duration - end,
          inPoint: c.inPoint + (end - c.start) * speed,
          fadeIn: 0,
        });
      if (parts.length > 1) captionSplits.push({ original: c, pieces: parts });
      return parts;
    });
  }
  if (op.type === "graphic") {
    const graphic = normalizeGraphic(p.graphic);
    if (
      !graphic ||
      ![op.start, op.end].every(Number.isFinite) ||
      op.start < 0 ||
      op.end > project.duration ||
      op.end <= op.start
    )
      throw new Error("Choose a graphic and a valid time range.");
    if (p.graphicMode === "update") {
      const matches = next.clips.filter(c => targeted(c) && c.graphic);
      if (matches.length !== 1 || op.targetClipIds.length !== 1)
        throw new Error("Choose one unlocked motion graphic to update.");
      const target = matches[0];
      if (
        op.start > target.start + 0.001 ||
        op.end < target.start + target.duration - 0.001
      )
        throw new Error(
          "Select the whole graphic to change its text or animation."
        );
      next.clips = next.clips.map(c =>
        c.id === target.id
          ? {
              ...c,
              graphic,
              label: graphic.text.trim() || op.label,
              color: graphic.background,
            }
          : c
      );
    } else
      next.clips.push({
        id: op.id,
        track: "overlay",
        label: op.label,
        start: op.start,
        duration: op.end - op.start,
        inPoint: 0,
        outPoint: op.end - op.start,
        locked: false,
        color: graphic.background,
        graphic,
        lane: allocateTimelineLane(
          next.clips,
          graphic.kind === "text" || graphic.kind === "callout"
            ? "text"
            : "graphics",
          op.start,
          op.end - op.start
        ),
      });
  } else if (op.type === "caption") {
    if (!p.text?.trim())
      throw new Error("This caption needs text before it can be applied.");
    if (
      p.sourceClipId &&
      !project.clips.some(
        c =>
          c.id === p.sourceClipId &&
          targets.has(c.id) &&
          !c.locked &&
          op.start >= c.start &&
          op.end <= c.start + c.duration
      )
    )
      throw new Error(
        "The caption's source owner no longer covers this interval."
      );
    next.transcript.push({
      id: op.id,
      start: op.start,
      end: op.end,
      text: p.text,
      ...(p.sourceClipId ? { sourceClipId: p.sourceClipId } : {}),
    });
  } else if (op.type === "broll") {
    if (!p.assetId)
      throw new Error("Generate or choose the supporting media first.");
    const sourceIn = p.sourceIn ?? 0;
    if (
      !Number.isFinite(sourceIn) ||
      sourceIn < 0 ||
      !Number.isFinite(op.end - op.start) ||
      op.end <= op.start
    )
      throw new Error("Choose a valid supporting-media source interval.");
    next.clips.push({
      id: op.id,
      assetId: p.assetId,
      label: op.label,
      track: "video",
      lane: allocateTimelineLane(
        next.clips,
        "video",
        op.start,
        op.end - op.start,
        2
      ),
      start: op.start,
      duration: op.end - op.start,
      inPoint: sourceIn,
      outPoint: sourceIn + op.end - op.start,
      locked: false,
      color: "#B98B4B",
      fit: "cover",
      muted: true,
    });
  } else if (op.type === "silence") {
    next = rippleRemove(next, op.start, op.end);
  } else if (op.type === "delete") {
    next.clips = next.clips.filter(c => !targeted(c));
  } else if (op.type === "split") {
    next.clips = next.clips.flatMap(c => {
      const offset = op.start - c.start;
      if (!targeted(c) || offset <= 0 || offset >= c.duration) return [c];
      const source = c.inPoint + offset * (c.speed ?? 1);
      const pieces = [
        { ...c, duration: offset, outPoint: source, fadeOut: 0 },
        {
          ...c,
          id: `${c.id}-${op.id}`,
          start: op.start,
          duration: c.duration - offset,
          inPoint: source,
          fadeIn: 0,
        },
      ];
      captionSplits.push({ original: c, pieces });
      return pieces;
    });
  } else {
    next.clips = next.clips.map(c => {
      if (!targeted(c)) return c;
      if (op.type === "trim") {
        const sourceIn = p.sourceIn ?? c.inPoint;
        const duration = Math.min(
          op.end - op.start,
          (c.outPoint - sourceIn) / (c.speed ?? 1)
        );
        if (duration <= 0)
          throw new Error("This trim is outside the source clip.");
        return {
          ...c,
          start: op.start,
          duration,
          inPoint: sourceIn,
          outPoint: sourceIn + duration * (c.speed ?? 1),
        };
      }
      if (op.type === "move") return { ...c, start: p.destination ?? op.start };
      if (op.type === "pacing") {
        if (!p.speed)
          throw new Error("This pacing change needs a playback speed.");
        return {
          ...c,
          speed: p.speed,
          duration: (c.outPoint - c.inPoint) / p.speed,
        };
      }
      if (op.type === "audio")
        return { ...c, volume: p.volume ?? 0.25, muted: false };
      if (op.type === "style")
        return {
          ...c,
          fit: p.fit ?? c.fit,
          fadeIn: p.fadeIn ?? c.fadeIn,
          fadeOut: p.fadeOut ?? c.fadeOut,
          brightness: p.brightness ?? c.brightness,
          contrast: p.contrast ?? c.contrast,
          saturation: p.saturation ?? c.saturation,
          ...(p.visual
            ? {
                visual: patchVisual(c, p.visual),
                visualStart: c.visualStart ?? c.inPoint,
                visualDuration: c.visualDuration ?? c.outPoint - c.inPoint,
              }
            : {}),
        };
      return c;
    });
  }
  assertLinkedEditTargets(
    project,
    op,
    project.clips
      .filter(original => {
        const split = captionSplits.find(s => s.original.id === original.id);
        if (split && split.pieces.length > 1) return true;
        const replacement = next.clips.find(c => c.id === original.id);
        return (
          !replacement ||
          ["start", "duration", "inPoint", "outPoint", "speed"].some(key =>
            key === "speed"
              ? (original.speed ?? 1) !== (replacement.speed ?? 1)
              : original[key as keyof TimelineClip] !==
                replacement[key as keyof TimelineClip]
          )
        );
      })
      .map(c => c.id)
  );
  if (captionSplits.length) {
    const grouped = splitGrouping(
      project,
      captionSplits.map(split => ({
        ...split,
        pieces: split.pieces.map(piece =>
          next.clips.find(c => c.id === piece.id)!
        ),
      })),
      membershipIds(project, op.id, next.clips)
    );
    next.clips = next.clips.map(clip => {
      const metadata = grouped.clips.find(c => c.id === clip.id);
      return metadata
        ? { ...clip, groupId: metadata.groupId, linkId: metadata.linkId }
        : clip;
    });
    next.transcript = projectSplitCaptions(project, captionSplits);
  }
  // A valid original link must survive every retained structural piece. This
  // rejects paired operations whose source bounds or rate would desynchronize
  // the two sources, rather than quietly discarding the user's relationship.
  const normalized = normalizeClipGroups(next);
  const linkedOriginalIds = new Set(
    normalizeClipGroups(project)
      .clips.filter(c => c.linkId)
      .map(c => c.id)
  );
  const linkedPieceIds = new Set(
    captionSplits
      .filter(s => linkedOriginalIds.has(s.original.id))
      .flatMap(s => s.pieces.map(c => c.id))
  );
  if (
    next.clips.some(
      c =>
        (linkedOriginalIds.has(c.id) || linkedPieceIds.has(c.id)) &&
        !normalized.clips.find(n => n.id === c.id)?.linkId
    )
  )
    throw new Error(
      "Linked audio and video need matching valid timing. Unlink them before making different source edits."
    );
  next = normalized;
  if (["trim", "move", "pacing", "delete"].includes(op.type)) {
    next.transcript = next.transcript.flatMap(segment => {
      const original = project.clips.find(
        c => targeted(c) && c.id === captionOwner(project, segment)?.id
      );
      if (!original) return [segment];
      const edited = next.clips.find(c => c.id === original.id);
      if (!edited) return [];
      const sourceStart =
        original.inPoint +
        (segment.start - original.start) * (original.speed ?? 1);
      const sourceEnd =
        original.inPoint +
        (segment.end - original.start) * (original.speed ?? 1);
      const start =
        edited.start + (sourceStart - edited.inPoint) / (edited.speed ?? 1);
      const end =
        edited.start + (sourceEnd - edited.inPoint) / (edited.speed ?? 1);
      if (end <= edited.start || start >= edited.start + edited.duration)
        return [];
      const mapped = {
        ...mapTranscriptTime(
          segment,
          t =>
            edited.start +
            (original.inPoint +
              (t - original.start) * (original.speed ?? 1) -
              edited.inPoint) /
              (edited.speed ?? 1),
          {
            start: Math.max(edited.start, start),
            end: Math.min(edited.start + edited.duration, end),
          }
        ),
        start: Math.max(edited.start, start),
        end: Math.min(edited.start + edited.duration, end),
      };
      return mapped.text.trim() ? [mapped] : [];
    });
  }
  next.duration = ["style", "audio", "caption", "split", "graphic"].includes(
    op.type
  )
    ? project.duration
    : contentDuration(next.clips);
  next.proposedChanges = next.proposedChanges.map(c =>
    c.id === op.id
      ? { ...c, status: "accepted", reviewedAt: new Date().toISOString() }
      : c
  );
  return next;
}
