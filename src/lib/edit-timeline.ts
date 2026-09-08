import type {
  EditOperation,
  EditProject,
  TimelineClip,
} from "@contracts/workspace";

export function contentDuration(clips: TimelineClip[], empty = 1): number {
  return Math.max(empty, ...clips.map(c => c.start + c.duration));
}

/** Remove an interval from every unlocked track; preserve source offsets and captions. */
export function rippleRemove(
  project: EditProject,
  start: number,
  end: number
): EditProject {
  const length = end - start;
  if (length <= 0) return project;
  if (project.clips.some(c => c.locked && c.start + c.duration > start)) {
    throw new Error(
      "Unlock the clips after this point before closing the gap."
    );
  }
  const clips = project.clips.flatMap(c => {
    const finish = c.start + c.duration;
    if (finish <= start) return [c];
    if (c.start >= end) return [{ ...c, start: c.start - length }];
    const pieces: TimelineClip[] = [];
    if (c.start < start)
      pieces.push({
        ...c,
        duration: start - c.start,
        outPoint: c.inPoint + (start - c.start) * (c.speed ?? 1),
      });
    if (finish > end)
      pieces.push({
        ...c,
        id: `${c.id}-after-${end}`,
        start,
        duration: finish - end,
        inPoint: c.inPoint + (end - c.start) * (c.speed ?? 1),
      });
    return pieces;
  });
  const transcript = project.transcript.flatMap(s => {
    if (s.end <= start) return [s];
    if (s.start >= end)
      return [{ ...s, start: s.start - length, end: s.end - length }];
    return [];
  });
  return { ...project, clips, transcript, duration: contentDuration(clips) };
}

export function resizeTimeline(project: EditProject, end: number): EditProject {
  if (!Number.isFinite(end) || end < 0.2)
    throw new Error("Choose a duration of at least 0.2 seconds.");
  if (project.clips.some(c => c.locked && c.start + c.duration > end))
    throw new Error(
      "Unlock clips beyond the new end before shortening the edit."
    );
  return {
    ...project,
    duration: end,
    playhead: Math.min(project.playhead, end),
    clips: project.clips
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
      .map(s => ({ ...s, end: Math.min(s.end, end) })),
  };
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
    !["caption", "broll", "silence"].includes(op.type) &&
    !project.clips.some(targeted)
  )
    throw new Error(
      "Choose an unlocked target clip before applying this change."
    );
  let next = {
    ...project,
    clips: project.clips.map(c => ({ ...c })),
    transcript: project.transcript.map(s => ({ ...s })),
  };
  if (op.type === "caption") {
    if (!p.text?.trim())
      throw new Error("This caption needs text before it can be applied.");
    next.transcript.push({
      id: op.id,
      start: op.start,
      end: op.end,
      text: p.text,
    });
  } else if (op.type === "broll") {
    if (!p.assetId)
      throw new Error("Generate or choose the supporting media first.");
    next.clips.push({
      id: op.id,
      assetId: p.assetId,
      label: op.label,
      track: "overlay",
      start: op.start,
      duration: op.end - op.start,
      inPoint: 0,
      outPoint: op.end - op.start,
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
      return [
        { ...c, duration: offset, outPoint: source },
        {
          ...c,
          id: `${c.id}-${op.id}`,
          start: op.start,
          duration: c.duration - offset,
          inPoint: source,
        },
      ];
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
        };
      return c;
    });
  }
  if (["trim", "move", "pacing", "delete"].includes(op.type)) {
    next.transcript = next.transcript.flatMap(segment => {
      const original = project.clips.find(
        c =>
          targeted(c) &&
          c.track !== "overlay" &&
          segment.start >= c.start &&
          segment.start < c.start + c.duration
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
      return [
        {
          ...segment,
          start: Math.max(edited.start, start),
          end: Math.min(edited.start + edited.duration, end),
        },
      ];
    });
  }
  next.duration = contentDuration(next.clips);
  next.proposedChanges = next.proposedChanges.map(c =>
    c.id === op.id
      ? { ...c, status: "accepted", reviewedAt: new Date().toISOString() }
      : c
  );
  return next;
}
