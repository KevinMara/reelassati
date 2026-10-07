import { assertNoShotTransition } from "./adjacent-transition";
import type { EditOperation, EditProject, TimelineClip } from "./workspace";

type ClipProject = Pick<EditProject, "clips">;
type Membership = "groupId" | "linkId";
export interface SelectionExpansion {
  groups?: boolean;
  links?: boolean;
}
export interface ClipGroupingSplit {
  original: TimelineClip;
  pieces: TimelineClip[];
}
const EPSILON = 0.000001;
const validId = (id: unknown): id is string =>
  typeof id === "string" &&
  id.length > 0 &&
  id.length <= 256 &&
  id.trim() === id;
const visual = (clip: TimelineClip) =>
  !clip.graphic && (clip.track === "video" || clip.track === "overlay");
const close = (a: number, b: number) =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= EPSILON;

/** A link is explicit user intent, not an inference from filenames. Separate
 * audio can be linked to video when their timeline spans agree. Same-source AV
 * must additionally share its source span and playback clock. */
function compatibleAV(clips: readonly TimelineClip[]) {
  if (
    clips.length < 2 ||
    !clips.some(visual) ||
    !clips.some(c => c.track === "audio") ||
    clips.some(c => c.transitionHandle || (!visual(c) && c.track !== "audio"))
  )
    return false;
  const first = clips[0];
  if (
    clips.some(
      c =>
        !Number.isFinite(c.start) ||
        c.start < 0 ||
        !Number.isFinite(c.duration) ||
        c.duration <= 0 ||
        !Number.isFinite(c.inPoint) ||
        c.inPoint < 0 ||
        !Number.isFinite(c.outPoint) ||
        c.outPoint <= c.inPoint ||
        !Number.isFinite(c.speed ?? 1) ||
        (c.speed ?? 1) < 0.25 ||
        (c.speed ?? 1) > 4 ||
        Math.abs((c.outPoint - c.inPoint) / (c.speed ?? 1) - c.duration) >
          0.001 ||
        !close(c.start, first.start) ||
        !close(c.duration, first.duration)
    )
  )
    return false;
  for (let i = 0; i < clips.length; i++)
    for (const other of clips.slice(i + 1)) {
      const clip = clips[i];
      if (
        clip.assetId &&
        clip.assetId === other.assetId &&
        (!close(clip.inPoint, other.inPoint) ||
          !close(clip.outPoint, other.outPoint) ||
          !close(clip.speed ?? 1, other.speed ?? 1))
      )
        return false;
    }
  return true;
}

function memberships(clips: readonly TimelineClip[], field: Membership) {
  const values = new Map<string, TimelineClip[]>();
  for (const clip of clips) {
    const id = clip[field];
    if (clip.transitionHandle || !validId(id)) continue;
    const members = values.get(id) ?? [];
    members.push(clip);
    values.set(id, members);
  }
  for (const [id, members] of values)
    if (members.length < 2 || (field === "linkId" && !compatibleAV(members)))
      values.delete(id);
  return values;
}

/** Remove singleton, malformed and generated-handle memberships after deletion
 * or other structural edits. This never manufactures a relationship. */
export function normalizeClipGroups<T extends ClipProject>(project: T): T {
  const groups = memberships(project.clips, "groupId"),
    links = memberships(project.clips, "linkId");
  let changed = false;
  const clips = project.clips.map(clip => {
    const groupId =
        clip.groupId && groups.has(clip.groupId) ? clip.groupId : undefined,
      linkId = clip.linkId && links.has(clip.linkId) ? clip.linkId : undefined;
    if (groupId === clip.groupId && linkId === clip.linkId) return clip;
    changed = true;
    return { ...clip, groupId, linkId };
  });
  return changed ? { ...project, clips } : project;
}

/** Transitive expansion handles a group containing one member of an AV link.
 * Passing both flags false gives direct-clip selection without dismantling it. */
export function expandLinkedSelection(
  project: ClipProject,
  ids: readonly string[],
  { groups = true, links = true }: SelectionExpansion = {}
): string[] {
  const clips = new Map(project.clips.map(c => [c.id, c])),
    groupMembers = groups
      ? memberships(project.clips, "groupId")
      : new Map<string, TimelineClip[]>(),
    linkMembers = links
      ? memberships(project.clips, "linkId")
      : new Map<string, TimelineClip[]>(),
    selected = new Set(ids.filter(id => clips.has(id))),
    queue = [...selected];
  for (let i = 0; i < queue.length; i++) {
    const clip = clips.get(queue[i])!;
    for (const members of [
      groups && clip.groupId ? groupMembers.get(clip.groupId) : undefined,
      links && clip.linkId ? linkMembers.get(clip.linkId) : undefined,
    ])
      for (const member of members ?? [])
        if (!selected.has(member.id)) {
          selected.add(member.id);
          queue.push(member.id);
        }
  }
  return queue;
}

/** Planning and execution share the same explicit-target rule. A partial local
 * look/audio edit creates pieces and therefore also needs the matching AV peer;
 * a whole-span style change remains local. Execution can supply the IDs whose
 * clocks actually changed, without inferring or expanding authority. */
export function assertLinkedEditTargets(
  project: ClipProject,
  operation: Pick<
    EditOperation,
    "type" | "start" | "end" | "targetClipIds" | "parameters"
  >,
  changedClipIds?: readonly string[]
): void {
  // Silence has always been a global all-track range ripple, including locks.
  if (operation.type === "silence") return;
  const normalized = normalizeClipGroups(project),
    targeted = new Set(operation.targetClipIds),
    parameters = operation.parameters ?? {},
    actualChanges = changedClipIds && new Set(changedClipIds),
    changesClock = (clip: TimelineClip) => {
      if (actualChanges) return actualChanges.has(clip.id);
      if (!targeted.has(clip.id)) return false;
      if (operation.type === "delete") return true;
      if (operation.type === "split")
        return (
          operation.start > clip.start &&
          operation.start < clip.start + clip.duration
        );
      if (operation.type === "move")
        return (parameters.destination ?? operation.start) !== clip.start;
      if (operation.type === "pacing")
        return (
          parameters.speed !== undefined &&
          parameters.speed !== (clip.speed ?? 1)
        );
      if (operation.type === "trim") {
        const sourceIn = parameters.sourceIn ?? clip.inPoint,
          duration = Math.min(
            operation.end - operation.start,
            (clip.outPoint - sourceIn) / (clip.speed ?? 1)
          );
        return (
          operation.start !== clip.start ||
          duration !== clip.duration ||
          sourceIn !== clip.inPoint
        );
      }
      if (operation.type === "style" || operation.type === "audio") {
        const start = Math.max(clip.start, operation.start),
          end = Math.min(clip.start + clip.duration, operation.end);
        return (
          end > start &&
          (start > clip.start || end < clip.start + clip.duration)
        );
      }
      return false;
    };
  for (const members of memberships(normalized.clips, "linkId").values()) {
    if (!members.some(changesClock)) continue;
    if (members.some(c => !targeted.has(c.id)))
      throw new Error("Include linked audio or unlink first.");
    if (members.some(c => c.locked))
      throw new Error(
        "Unlock linked audio and video before changing their timing."
      );
  }
}

function exactSelection(project: ClipProject, ids: readonly string[]) {
  const unique = [...new Set(ids)];
  if (
    !unique.length ||
    unique.some(id => !project.clips.some(c => c.id === id))
  )
    throw new Error("Choose clips that are still on this timeline.");
  return unique;
}
function assertMutable(project: ClipProject, ids: readonly string[]) {
  const selected = project.clips.filter(c => ids.includes(c.id));
  if (selected.some(c => c.locked))
    throw new Error(
      "Unlock the affected clips before changing their group or link."
    );
  if (selected.some(c => c.transitionHandle))
    throw new Error(
      "Generated transition handles cannot be grouped or linked."
    );
  assertNoShotTransition(project, [...ids]);
}
function guardedResult<T extends ClipProject>(before: T, after: T): T {
  const affected = before.clips
    .filter(c => {
      const next = after.clips.find(n => n.id === c.id);
      return next && (c.groupId !== next.groupId || c.linkId !== next.linkId);
    })
    .map(c => c.id);
  assertMutable(before, affected);
  return after;
}
function freshId(clips: readonly TimelineClip[], makeId: () => string) {
  const reserved = new Set(
    clips.flatMap(c => [c.id, c.groupId, c.linkId].filter(validId))
  );
  return () => {
    const id = makeId();
    if (!validId(id) || reserved.has(id))
      throw new Error("A new group or link needs a fresh unique identifier.");
    reserved.add(id);
    return id;
  };
}

export function groupClips<T extends ClipProject>(
  project: T,
  ids: readonly string[],
  makeId: () => string
): T {
  const selected = expandLinkedSelection(
    project,
    exactSelection(project, ids),
    {
      groups: true,
      links: false,
    }
  );
  if (selected.length < 2)
    throw new Error("Select at least two clips to group.");
  assertMutable(project, selected);
  const members = project.clips.filter(c => selected.includes(c.id));
  if (
    members[0].groupId &&
    members.every(c => c.groupId === members[0].groupId)
  )
    return guardedResult(project, normalizeClipGroups(project));
  const groupId = freshId(project.clips, makeId)();
  return guardedResult(
    project,
    normalizeClipGroups({
      ...project,
      clips: project.clips.map(c =>
        selected.includes(c.id) ? { ...c, groupId } : c
      ),
    })
  );
}
export function ungroupClips<T extends ClipProject>(
  project: T,
  ids: readonly string[]
): T {
  const selected = exactSelection(project, ids);
  assertMutable(project, selected);
  return guardedResult(
    project,
    normalizeClipGroups({
      ...project,
      clips: project.clips.map(c =>
        selected.includes(c.id) ? { ...c, groupId: undefined } : c
      ),
    })
  );
}
export function linkClips<T extends ClipProject>(
  project: T,
  ids: readonly string[],
  makeId: () => string
): T {
  const selected = expandLinkedSelection(
    project,
    exactSelection(project, ids),
    {
      groups: false,
      links: true,
    }
  );
  assertMutable(project, selected);
  const members = project.clips.filter(c => selected.includes(c.id));
  if (!compatibleAV(members))
    throw new Error(
      "Link video and audio with matching timeline spans and compatible source timing."
    );
  if (members[0].linkId && members.every(c => c.linkId === members[0].linkId))
    return guardedResult(project, normalizeClipGroups(project));
  const linkId = freshId(project.clips, makeId)();
  return guardedResult(
    project,
    normalizeClipGroups({
      ...project,
      clips: project.clips.map(c =>
        selected.includes(c.id) ? { ...c, linkId } : c
      ),
    })
  );
}
export function unlinkClips<T extends ClipProject>(
  project: T,
  ids: readonly string[]
): T {
  const selected = exactSelection(project, ids);
  assertMutable(project, selected);
  return guardedResult(
    project,
    normalizeClipGroups({
      ...project,
      clips: project.clips.map(c =>
        selected.includes(c.id) ? { ...c, linkId: undefined } : c
      ),
    })
  );
}

/** Replace split clips and retain a persistent group's collection. AV links are
 * instead partitioned by their resulting spans: before links to before, after
 * to after. A one-sided cut never links a half-clip to an uncut partner. This
 * only projects clip metadata; the caller separately maps captions. */
export function splitGrouping<T extends ClipProject>(
  project: T,
  splits: readonly ClipGroupingSplit[],
  makeId: () => string
): T {
  if (!splits.length) return normalizeClipGroups(project);
  const normalized = normalizeClipGroups(project),
    byId = new Map<string, ClipGroupingSplit>(),
    used = new Set(project.clips.map(c => c.id));
  for (const split of splits) {
    if (
      byId.has(split.original.id) ||
      !project.clips.some(c => c.id === split.original.id)
    )
      throw new Error("A split must refer to one current original clip.");
    if (!split.pieces.length)
      throw new Error("A split needs retained clip pieces.");
    assertMutable(project, [split.original.id]);
    const ids = new Set<string>();
    for (const piece of split.pieces) {
      if (
        !validId(piece.id) ||
        ids.has(piece.id) ||
        (piece.id !== split.original.id && used.has(piece.id))
      )
        throw new Error("Split pieces need unique clip identifiers.");
      ids.add(piece.id);
      used.add(piece.id);
      if (piece.transitionHandle || piece.shotTransition)
        throw new Error(
          "Remove a generated transition before splitting its shots."
        );
      if (
        piece.assetId !== split.original.assetId ||
        piece.track !== split.original.track
      )
        throw new Error("Split pieces must retain their source and track.");
    }
    byId.set(split.original.id, split);
  }
  let clips = normalized.clips.flatMap(c => {
    const split = byId.get(c.id);
    return split
      ? split.pieces.map(piece => ({
          ...piece,
          groupId: c.groupId,
          linkId: undefined,
        }))
      : [c];
  });
  const nextId = freshId([...project.clips, ...clips], makeId);
  for (const [linkId, members] of memberships(normalized.clips, "linkId")) {
    if (!members.some(c => byId.has(c.id))) continue;
    const familyIds = new Set(
        members.flatMap(c => byId.get(c.id)?.pieces.map(p => p.id) ?? [c.id])
      ),
      family = clips.filter(c => familyIds.has(c.id)),
      buckets: TimelineClip[][] = [];
    for (const c of family) {
      const bucket = buckets.find(
        b => close(b[0].start, c.start) && close(b[0].duration, c.duration)
      );
      if (bucket) bucket.push(c);
      else buckets.push([c]);
    }
    const assigned = new Map<string, string>();
    let retained = false;
    for (const bucket of buckets.sort((a, b) => a[0].start - b[0].start))
      if (compatibleAV(bucket)) {
        const id = retained ? nextId() : linkId;
        retained = true;
        bucket.forEach(c => assigned.set(c.id, id));
      }
    clips = clips.map(c =>
      familyIds.has(c.id) ? { ...c, linkId: assigned.get(c.id) } : c
    );
  }
  return guardedResult(project, normalizeClipGroups({ ...project, clips }));
}

/** Only relationships with several copied members survive. Every surviving
 * relation gets a fresh ID, so a paste can never select or move its originals. */
export function remapPastedGrouping(
  source: readonly TimelineClip[],
  copies: readonly TimelineClip[],
  makeId: () => string,
  existingClips: readonly TimelineClip[] = []
): TimelineClip[] {
  if (source.length !== copies.length)
    throw new Error("Each copied clip needs its matching source clip.");
  if ([...source, ...copies].some(c => c.transitionHandle || c.shotTransition))
    throw new Error(
      "Copy transition-free source clips, excluding generated handles."
    );
  const existingIds = new Set([...source, ...existingClips].map(c => c.id)),
    seen = new Set<string>();
  for (const c of copies) {
    if (!validId(c.id) || existingIds.has(c.id) || seen.has(c.id))
      throw new Error("Pasted clips need fresh unique clip identifiers.");
    seen.add(c.id);
  }
  const nextId = freshId([...source, ...existingClips, ...copies], makeId),
    groups = memberships(source, "groupId"),
    links = memberships(source, "linkId"),
    groupIds = new Map([...groups.keys()].map(id => [id, nextId()])),
    linkIds = new Map([...links.keys()].map(id => [id, nextId()]));
  return normalizeClipGroups({
    clips: copies.map((c, i) => ({
      ...c,
      groupId: source[i].groupId ? groupIds.get(source[i].groupId!) : undefined,
      linkId: source[i].linkId ? linkIds.get(source[i].linkId!) : undefined,
    })),
  }).clips;
}
