import {
  normalizeVisual,
  visualClock,
  type VisualTransition,
} from "./clip-visual";
import type { Asset, EditProject, TimelineClip } from "./workspace";
import { sha256 } from "@noble/hashes/sha2.js";
import { captionOwner } from "./caption-ownership";
import { clipLaneNumber, isPrimaryFootage } from "./timeline-layers";

export function adjacentTransitionHandleIds(
  outgoingId: string,
  incomingId: string
) {
  const key = Array.from(
    sha256(new TextEncoder().encode(JSON.stringify([outgoingId, incomingId]))),
    byte => byte.toString(16).padStart(2, "0")
  ).join("");
  return {
    incoming: `transition-${key}-incoming`,
    outgoing: `transition-${key}-outgoing`,
  };
}
const video = (c: TimelineClip) =>
  !c.graphic && (c.track === "video" || c.track === "overlay");

export function assertNoShotTransition(
  project: Pick<EditProject, "clips">,
  ids: string[]
) {
  const selected = new Set(ids);
  for (const c of project.clips) {
    const pair = c.shotTransition;
    if (!pair) continue;
    const handles = adjacentTransitionHandleIds(
      pair.outgoingId,
      pair.incomingId
    );
    if (
      [
        pair.outgoingId,
        pair.incomingId,
        handles.outgoing,
        handles.incoming,
      ].some(id => selected.has(id))
    )
      throw new Error(
        "Remove the transition between these shots before changing their timing, splitting or deleting them."
      );
  }
}
export function transitionFreeClip(
  project: Pick<EditProject, "clips">,
  clip: TimelineClip
) {
  let value = { ...clip, shotTransition: undefined, transitionHandle: false };
  for (const c of [clip, ...project.clips]) {
    const pair = c.shotTransition;
    if (!pair) continue;
    if (pair.incomingId === clip.id)
      value = {
        ...value,
        visual: normalizeVisual({
          ...normalizeVisual(value.visual),
          entrance: pair.incomingEntrance,
        }),
      };
    if (pair.outgoingId === clip.id)
      value = {
        ...value,
        visual: normalizeVisual({
          ...normalizeVisual(value.visual),
          exit: pair.outgoingExit,
        }),
      };
  }
  return value;
}
export function removeAdjacentTransition(
  project: EditProject,
  outgoingId: string,
  incomingId: string
): EditProject {
  const incoming = project.clips.find(c => c.id === incomingId),
    pair = incoming?.shotTransition;
  if (!pair || pair.outgoingId !== outgoingId || pair.incomingId !== incomingId)
    throw new Error(
      "This pair does not have a generated shot transition to remove."
    );
  const handles = adjacentTransitionHandleIds(outgoingId, incomingId);
  if (
    project.clips.some(
      c =>
        [outgoingId, incomingId, handles.incoming, handles.outgoing].includes(
          c.id
        ) && c.locked
    )
  )
    throw new Error(
      "Unlock the transition’s shots and handles before removing it."
    );
  return {
    ...project,
    clips: project.clips
      .filter(c => c.id !== handles.incoming && c.id !== handles.outgoing)
      .map(c =>
        c.id === incomingId
          ? {
              ...c,
              shotTransition: undefined,
              visual: normalizeVisual({
                ...normalizeVisual(c.visual),
                entrance: pair.incomingEntrance,
              }),
            }
          : c.id === outgoingId
            ? {
                ...c,
                visual: normalizeVisual({
                  ...normalizeVisual(c.visual),
                  exit: pair.outgoingExit,
                }),
              }
            : c
      ),
  };
}

/** Center a visual transition on a real cut using measured, silent source handles.
 * Main footage, speech/captions and project duration keep their original clocks. */
export function applyAdjacentTransition(
  project: EditProject,
  assets: Asset[],
  outgoingId: string,
  incomingId: string,
  kind: VisualTransition,
  duration: number
): EditProject {
  if (kind === "none")
    return removeAdjacentTransition(project, outgoingId, incomingId);
  const outgoing = project.clips.find(c => c.id === outgoingId),
    incoming = project.clips.find(c => c.id === incomingId);
  if (
    !outgoing ||
    !incoming ||
    outgoing.id === incoming.id ||
    !video(outgoing) ||
    !video(incoming) ||
    outgoing.locked ||
    incoming.locked
  )
    throw new Error("Choose two unlocked video shots at the same cut.");
  if (
    outgoing.transitionHandle ||
    incoming.transitionHandle ||
    project.clips.some(
      c =>
        c.shotTransition &&
        (c.shotTransition.outgoingId === outgoingId ||
          c.shotTransition.incomingId === outgoingId ||
          c.shotTransition.outgoingId === incomingId ||
          c.shotTransition.incomingId === incomingId) &&
        (c.shotTransition.outgoingId !== outgoingId ||
          c.shotTransition.incomingId !== incomingId)
    )
  )
    throw new Error(
      "Remove the existing transition on these shots before connecting a different pair."
    );
  if (
    !Number.isFinite(duration) ||
    duration < 0.05 ||
    duration > 5 ||
    normalizeVisual({ entrance: { kind } }).entrance.kind !== kind
  )
    throw new Error("Choose a supported transition lasting 0.05–5 seconds.");
  const cut = incoming.start,
    half = duration / 2,
    si = incoming.speed ?? 1,
    so = outgoing.speed ?? 1;
  if (
    [outgoing, incoming].some(
      c =>
        ![c.start, c.duration, c.inPoint, c.outPoint, c.speed ?? 1].every(
          Number.isFinite
        ) ||
        c.start < 0 ||
        c.duration <= 0 ||
        c.inPoint < 0 ||
        c.outPoint <= c.inPoint ||
        (c.speed ?? 1) < 0.25 ||
        (c.speed ?? 1) > 4 ||
        Math.abs((c.outPoint - c.inPoint) / (c.speed ?? 1) - c.duration) > 0.001
    )
  )
    throw new Error(
      "Both shots need valid source timing and playback speeds before adding a transition."
    );
  if (Math.abs(outgoing.start + outgoing.duration - cut) > 0.001)
    throw new Error(
      "These shots must meet at a cut. Move or trim them before applying the transition."
    );
  if (outgoing.fadeOut || incoming.fadeIn)
    throw new Error(
      "Remove the outgoing fade-out and incoming fade-in first; those fades also change source audio."
    );
  const oa = assets.find(a => a.id === outgoing.assetId),
    ia = assets.find(a => a.id === incoming.assetId);
  if (
    !oa ||
    !ia ||
    oa.kind !== "video" ||
    ia.kind !== "video" ||
    oa.status !== "ready" ||
    ia.status !== "ready" ||
    !oa.duration ||
    !ia.duration ||
    !Number.isFinite(oa.duration) ||
    !Number.isFinite(ia.duration)
  )
    throw new Error(
      "Both video files need measured source durations before adding a transition."
    );
  if (
    incoming.inPoint - half * si < -0.000001 ||
    outgoing.outPoint + half * so > oa.duration + 0.000001 ||
    incoming.outPoint > ia.duration + 0.000001
  )
    throw new Error(
      "There is not enough unused source footage around this cut. Shorten the transition or trim the shots to leave handles."
    );
  if (
    half > outgoing.duration ||
    half > incoming.duration ||
    duration > visualClock(incoming).duration / (2 * si) + 0.000001
  )
    throw new Error(
      "This transition is too long for the incoming shot’s animation span. Choose a shorter duration."
    );
  const ids = adjacentTransitionHandleIds(outgoing.id, incoming.id);
  if (
    project.clips.some(
      c => (c.id === ids.incoming || c.id === ids.outgoing) && c.locked
    )
  )
    throw new Error(
      "Unlock the existing transition handles before changing this transition."
    );
  const unrelated = project.clips.filter(
    c =>
      c.id !== outgoing.id &&
      c.id !== incoming.id &&
      c.id !== ids.incoming &&
      c.id !== ids.outgoing
  );
  if (
    unrelated.some(
      c =>
        video(c) &&
        c.start < incoming.start + incoming.duration &&
        c.start + c.duration > cut - half
    )
  )
    throw new Error(
      "Another video layer overlaps this transition or incoming shot. Resolve that overlap before applying a transition between shots."
    );
  const preserved = (c: TimelineClip) => ({
    ...c,
    visualStart: c.visualStart ?? c.inPoint,
    visualDuration: c.visualDuration ?? c.outPoint - c.inPoint,
  });
  const outgoingMain = {
    ...preserved(outgoing),
    primaryFootage: isPrimaryFootage(outgoing),
    transitionHandle: false,
    visual: normalizeVisual({
      ...normalizeVisual(outgoing.visual),
      exit: { kind: "none", duration: 0.5 },
    }),
  };
  const incomingMain = {
    ...preserved(incoming),
    primaryFootage: isPrimaryFootage(incoming),
    transitionHandle: false,
    lane: Math.max(clipLaneNumber(outgoing) + 1, clipLaneNumber(incoming)),
    shotTransition: incoming.shotTransition ?? {
      outgoingId,
      incomingId,
      incomingEntrance: normalizeVisual(incoming.visual).entrance,
      outgoingExit: normalizeVisual(outgoing.visual).exit,
    },
    visual: normalizeVisual({
      ...normalizeVisual(incoming.visual),
      entrance: { kind, duration, at: incoming.inPoint - half * si },
    }),
  };
  const incomingHandle = {
    ...incomingMain,
    id: ids.incoming,
    label: `${kind} · incoming handle`,
    start: cut - half,
    duration: half,
    inPoint: Math.max(0, incoming.inPoint - half * si),
    outPoint: incoming.inPoint,
    shotTransition: undefined,
    transitionHandle: true,
    primaryFootage: false,
    muted: true,
    fadeIn: 0,
    fadeOut: 0,
  };
  const outgoingHandle = {
    ...outgoingMain,
    id: ids.outgoing,
    label: `${kind} · outgoing handle`,
    start: cut,
    duration: half,
    inPoint: outgoing.outPoint,
    outPoint: outgoing.outPoint + half * so,
    shotTransition: undefined,
    transitionHandle: true,
    primaryFootage: false,
    muted: true,
    fadeIn: 0,
    fadeOut: 0,
  };
  const transcript = project.transcript.map(cue => {
    if (cue.sourceClipId) return cue;
    const owner = captionOwner(project, cue);
    return owner && (owner.id === incoming.id || owner.id === outgoing.id)
      ? { ...cue, sourceClipId: owner.id }
      : cue;
  });
  return {
    ...project,
    transcript,
    clips: [
      ...project.clips
        .filter(c => c.id !== ids.incoming && c.id !== ids.outgoing)
        .map(c =>
          c.id === outgoing.id
            ? outgoingMain
            : c.id === incoming.id
              ? incomingMain
              : c
        ),
      incomingHandle,
      outgoingHandle,
    ],
  };
}
