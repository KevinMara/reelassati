import type { Asset, EditProject, TimelineClip } from "./workspace";
import {
  applyAdjacentTransition,
  adjacentTransitionHandleIds,
} from "./adjacent-transition";
import { normalizeVisual, visualClock } from "./clip-visual";
import {
  nativeTransitionDefinitions,
  type NativeTransitionId,
} from "./native-transition-program";
import { exportFrameRates, type ExportFrameRate } from "./export-settings";
import { effectiveTimelineClips } from "./timeline-mixer";

export type NativeTransitionKind = `native-${NativeTransitionId}`;
export function nativeTransitionId(
  kind: NativeTransitionKind
): NativeTransitionId {
  return kind.slice(7) as NativeTransitionId;
}
export function isNativeTransitionKind(
  value: unknown
): value is NativeTransitionKind {
  return (
    typeof value === "string" &&
    value.startsWith("native-") &&
    Object.hasOwn(nativeTransitionDefinitions, value.slice(7))
  );
}
export interface NativeTransitionReference {
  version: 1;
  id: NativeTransitionId;
  duration: number;
  frameRate: ExportFrameRate;
}
export interface NativeTransitionRecipe {
  key: string;
  reference: NativeTransitionReference;
  start: number;
  duration: number;
  outgoing: TimelineClip;
  incoming: TimelineClip;
}
export function applyNativeAdjacentTransition(
  project: EditProject,
  assets: Asset[],
  outgoingId: string,
  incomingId: string,
  kind: NativeTransitionKind,
  duration: number
): EditProject {
  if (!isNativeTransitionKind(kind))
    throw new Error("Unknown native transition");
  const next = applyAdjacentTransition(
    project,
    assets,
    outgoingId,
    incomingId,
    "dissolve",
    duration
  );
  const incoming = next.clips.find(c => c.id === incomingId)!,
    outgoing = next.clips.find(c => c.id === outgoingId)!;
  const start = incoming.start - duration / 2,
    end = start + duration;
  if (
    (outgoing.fadeIn ?? 0) > start - outgoing.start ||
    (incoming.fadeOut ?? 0) > incoming.start + incoming.duration - end
  )
    throw new Error(
      "Finish the source audio fades before adding this transition."
    );
  const ref: NativeTransitionReference = {
    version: 1,
    id: nativeTransitionId(kind),
    duration,
    frameRate: project.frameRate ?? 30,
  };
  const handles = adjacentTransitionHandleIds(outgoingId, incomingId);
  return {
    ...next,
    clips: next.clips.map(c =>
      c.id === incomingId || c.id === handles.incoming
        ? {
            ...c,
            visual: normalizeVisual({
              ...c.visual,
              entrance: { kind: "none", duration: 0.5 },
            }),
            ...(c.id === incomingId
              ? { shotTransition: { ...c.shotTransition!, native: ref } }
              : {}),
          }
        : c
    ),
  };
}
export function nativeTransitionRecipes(
  project: EditProject
): NativeTransitionRecipe[] {
  const visible = new Set(
    effectiveTimelineClips(project)
      .filter(c => !c.hidden)
      .map(c => c.id)
  );
  return project.clips.flatMap(incoming => {
    const pair = incoming.shotTransition,
      ref = pair?.native;
    if (!pair || !ref) return [];
    if (
      ref.version !== 1 ||
      !Object.hasOwn(nativeTransitionDefinitions, ref.id) ||
      ![ref.duration, ref.frameRate].every(Number.isFinite) ||
      ref.duration < 0.05 ||
      ref.duration > 5 ||
      !exportFrameRates.includes(ref.frameRate) ||
      pair.incomingId !== incoming.id
    )
      throw new Error(
        "This native transition has invalid controls. Remove and apply it again."
      );
    const outgoing = project.clips.find(c => c.id === pair.outgoingId);
    if (
      !outgoing ||
      Math.abs(outgoing.start + outgoing.duration - incoming.start) > 0.001
    )
      throw new Error(
        "The native transition no longer has adjacent source shots."
      );
    // A hidden/unsoloed source must never reappear through a baked overlay.
    if (!visible.has(incoming.id) || !visible.has(outgoing.id)) return [];
    const start = incoming.start - ref.duration / 2;
    if (start < 0 || start + ref.duration > project.duration + 0.001)
      throw new Error("Native transition lies outside the project.");
    return [
      {
        key: `native-${incoming.id}`,
        reference: ref,
        start,
        duration: ref.duration,
        outgoing,
        incoming,
      },
    ];
  });
}
/** A native input spans the cut and real source handles. Pose animation keeps
 * its source clock; transition handles never gain a second audio track. */
export function nativeTransitionInput(
  recipe: NativeTransitionRecipe,
  role: "outgoing" | "incoming"
): TimelineClip {
  const source = recipe[role],
    clock = visualClock(source),
    speed = source.speed ?? 1;
  const inPoint = source.inPoint + (recipe.start - source.start) * speed;
  if (inPoint < -0.000001)
    throw new Error("Native transition is missing source handles");
  return {
    ...source,
    id: `${recipe.key}-${role}`,
    start: 0,
    duration: recipe.duration,
    inPoint: Math.max(0, inPoint),
    outPoint: inPoint + recipe.duration * speed,
    visualStart: clock.start,
    visualDuration: clock.duration,
    visual: normalizeVisual({
      ...source.visual,
      entrance: { kind: "none", duration: 0.5 },
      exit: { kind: "none", duration: 0.5 },
    }),
    fadeIn: 0,
    fadeOut: 0,
    muted: true,
    shotTransition: undefined,
    transitionHandle: true,
  };
}
