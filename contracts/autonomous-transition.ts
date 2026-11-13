import type {
  Asset,
  EditOperation,
  EditProject,
  TimelineClip,
} from "./workspace";
import {
  adjacentTransitionHandleIds,
  applyAdjacentTransition,
} from "./adjacent-transition";
import {
  visualClock,
  visualTransitions,
  type VisualTransition,
} from "./clip-visual";
import { effectiveTimelineClips } from "./timeline-mixer";
import {
  normalizeTransitionPresets,
  TRANSITION_PRESETS,
  type TransitionPreset,
} from "./transition-presets";

export interface AutonomousTransition {
  outgoingId: string;
  incomingId: string;
  /** The intended boundary on the proposal's original timeline, before cuts. */
  cutTime: number;
  kind: VisualTransition;
  /** Canonical zero for removal; the planner may omit duration when kind=none. */
  duration: number;
}
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const record = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
const picture = (c: TimelineClip) =>
  !c.hidden &&
  !c.graphic &&
  !c.transitionHandle &&
  ["video", "overlay"].includes(c.track);
const EPSILON = 0.001;

/** Resolve an advertised preset to immutable controls; never clamp unsupported effects. */
export function normalizeAutonomousTransition(
  value: unknown,
  presets: readonly TransitionPreset[] = TRANSITION_PRESETS
): AutonomousTransition | undefined {
  const row = record(value);
  if (
    !row ||
    Object.keys(row).some(
      key =>
        ![
          "outgoingId",
          "incomingId",
          "cutTime",
          "kind",
          "duration",
          "presetId",
        ].includes(key)
    )
  )
    return;
  const preset =
    row.presetId === undefined
      ? undefined
      : presets.find(p => p.id === row.presetId);
  if (
    row.presetId !== undefined &&
    (!preset ||
      (row.kind !== undefined && row.kind !== preset.kind) ||
      (row.duration !== undefined && row.duration !== preset.duration))
  )
    return;
  const kind = row.kind ?? preset?.kind;
  const duration =
    kind === "none" &&
    (row.duration === undefined || row.duration === null || row.duration === 0)
      ? 0
      : (row.duration ?? preset?.duration);
  if (
    typeof row.outgoingId !== "string" ||
    !row.outgoingId.trim() ||
    row.outgoingId.length > 160 ||
    typeof row.incomingId !== "string" ||
    !row.incomingId.trim() ||
    row.incomingId.length > 160 ||
    !finite(row.cutTime) ||
    row.cutTime <= 0 ||
    !visualTransitions.some(t => t.value === kind) ||
    !finite(duration) ||
    (kind === "none"
      ? duration !== 0 || row.outgoingId === row.incomingId
      : duration < 0.05 || duration > 5)
  )
    return;
  return {
    outgoingId: row.outgoingId,
    incomingId: row.incomingId,
    cutTime: row.cutTime,
    kind: kind as AutonomousTransition["kind"],
    duration,
  };
}

export function autonomousTransitionTargets(transition: AutonomousTransition) {
  return [...new Set([transition.outgoingId, transition.incomingId])];
}

/** Measured source handles and currently executable cuts are evidence, not an effect quota. */
export function buildAutonomousTransitionContext(
  project: EditProject,
  assets: Asset[],
  personalPresets: TransitionPreset[] = []
) {
  const clips = effectiveTimelineClips(project).filter(picture);
  const byAsset = new Map(assets.map(asset => [asset.id, asset]));
  const transitionPresets = [
    ...TRANSITION_PRESETS,
    ...normalizeTransitionPresets(personalPresets),
  ];
  const transitionSources = clips.flatMap(clip => {
    const asset = byAsset.get(clip.assetId ?? "");
    if (
      asset?.kind !== "video" ||
      asset.status !== "ready" ||
      !finite(asset.duration) ||
      asset.duration <= 0
    )
      return [];
    const speed = clip.speed ?? 1;
    if (
      ![clip.start, clip.duration, clip.inPoint, clip.outPoint, speed].every(
        finite
      ) ||
      clip.start < 0 ||
      clip.duration <= 0 ||
      clip.inPoint < 0 ||
      clip.outPoint > asset.duration ||
      clip.outPoint <= clip.inPoint ||
      speed < 0.25 ||
      speed > 4
    )
      return [];
    return [
      {
        clipId: clip.id,
        assetId: asset.id,
        locked: clip.locked,
        start: clip.start,
        end: clip.start + clip.duration,
        sourceIn: clip.inPoint,
        sourceOut: clip.outPoint,
        speed,
        sourceDuration: asset.duration,
        headHandleSeconds: clip.inPoint / speed,
        tailHandleSeconds: Math.max(0, asset.duration - clip.outPoint) / speed,
      },
    ];
  });
  const existingTransitions = project.clips.flatMap(incoming => {
    const pair = incoming.shotTransition;
    if (!pair || pair.incomingId !== incoming.id) return [];
    const outgoing = project.clips.find(c => c.id === pair.outgoingId);
    if (!outgoing) return [];
    const handles = adjacentTransitionHandleIds(outgoing.id, incoming.id);
    return [
      {
        outgoingId: outgoing.id,
        incomingId: incoming.id,
        cutTime: incoming.start,
        start: outgoing.start,
        end: incoming.start + incoming.duration,
        kind: incoming.visual?.entrance.kind,
        duration: incoming.visual?.entrance.duration,
        locked:
          outgoing.locked ||
          incoming.locked ||
          project.clips.some(
            c => c.locked && [handles.incoming, handles.outgoing].includes(c.id)
          ),
      },
    ];
  });
  const sourceById = new Map(
    transitionSources.map(source => [source.clipId, source])
  );
  const incomingByTime = new Map<number, TimelineClip[]>();
  for (const clip of clips) {
    const key = Math.round(clip.start / EPSILON);
    incomingByTime.set(key, [...(incomingByTime.get(key) ?? []), clip]);
  }
  const transitionCuts = clips.flatMap(outgoing => {
    const key = Math.round((outgoing.start + outgoing.duration) / EPSILON);
    return [-1, 0, 1]
      .flatMap(offset => incomingByTime.get(key + offset) ?? [])
      .flatMap(incoming => {
        if (
          outgoing.id === incoming.id ||
          Math.abs(outgoing.start + outgoing.duration - incoming.start) >
            EPSILON
        )
          return [];
        const left = sourceById.get(outgoing.id),
          right = sourceById.get(incoming.id);
        if (!left || !right) return [];
        const maxDuration = Math.min(
          5,
          2 * outgoing.duration,
          2 * incoming.duration,
          2 * left.tailHandleSeconds,
          2 * right.headHandleSeconds,
          visualClock(incoming).duration / (2 * (incoming.speed ?? 1))
        );
        if (maxDuration < 0.05) return [];
        try {
          applyAdjacentTransition(
            project,
            assets,
            outgoing.id,
            incoming.id,
            "dissolve",
            0.05
          );
        } catch {
          return [];
        }
        return [
          {
            outgoingId: outgoing.id,
            incomingId: incoming.id,
            cutTime: incoming.start,
            maxDuration,
            presetIds: transitionPresets
              .filter(p => p.duration <= maxDuration)
              .map(p => p.id),
          },
        ];
      });
  });
  return {
    transitionSources,
    transitionCuts,
    transitionPresets,
    existingTransitions,
  };
}

/** Resolve a signed original cut against actual surviving descendants, never by ID guessing. */
export function applyAutonomousTransition(
  original: EditProject,
  working: EditProject,
  operation: EditOperation,
  assets: Asset[],
  roots: ReadonlyMap<string, string>
): EditProject {
  const transition = normalizeAutonomousTransition(
    operation.parameters?.transition
  );
  if (!transition)
    throw new Error(
      "Choose a supported transition, an explicit original cut time and duration."
    );
  if (
    !Number.isFinite(operation.start) ||
    !Number.isFinite(operation.end) ||
    operation.start < 0 ||
    operation.end <= operation.start ||
    operation.end > original.duration
  )
    throw new Error(
      "The transition interval must be finite and inside the original timeline."
    );
  const expected = autonomousTransitionTargets(transition);
  if (
    operation.targetClipIds.length !== expected.length ||
    expected.some(id => !operation.targetClipIds.includes(id))
  )
    throw new Error(
      "The transition targets must identify its exact source shots."
    );
  const outgoingRoot = original.clips.find(c => c.id === transition.outgoingId);
  const incomingRoot = original.clips.find(c => c.id === transition.incomingId);
  if (
    !outgoingRoot ||
    !incomingRoot ||
    outgoingRoot.locked ||
    incomingRoot.locked
  )
    throw new Error(
      "Choose available unlocked picture sources for the transition."
    );
  const accepted = (next: EditProject): EditProject => ({
    ...next,
    proposedChanges: next.proposedChanges.map(op =>
      op.id === operation.id
        ? { ...op, status: "accepted", reviewedAt: new Date().toISOString() }
        : op
    ),
  });
  if (transition.kind === "none") {
    if (
      incomingRoot.shotTransition?.outgoingId !== outgoingRoot.id ||
      incomingRoot.shotTransition.incomingId !== incomingRoot.id ||
      Math.abs(transition.cutTime - incomingRoot.start) > EPSILON ||
      Math.abs(operation.start - outgoingRoot.start) > EPSILON ||
      Math.abs(operation.end - (incomingRoot.start + incomingRoot.duration)) >
        EPSILON
    )
      throw new Error(
        "Transition removal requires the exact existing pair, cut and complete shot range."
      );
    return accepted(
      applyAdjacentTransition(
        working,
        assets,
        outgoingRoot.id,
        incomingRoot.id,
        "none",
        0
      )
    );
  }
  if (!picture(outgoingRoot) || !picture(incomingRoot))
    throw new Error(
      "Choose available visible picture sources for the transition."
    );
  if (
    Math.abs(operation.start - (transition.cutTime - transition.duration / 2)) >
      EPSILON ||
    Math.abs(operation.end - (transition.cutTime + transition.duration / 2)) >
      EPSILON ||
    operation.start < 0 ||
    operation.end > original.duration
  )
    throw new Error("The transition interval must surround its original cut.");
  const visible = effectiveTimelineClips(working).filter(picture);
  const outgoing = visible.filter(
    c =>
      (roots.get(c.id) ?? c.id) === outgoingRoot.id &&
      c.assetId === outgoingRoot.assetId
  );
  const incoming = visible.filter(
    c =>
      (roots.get(c.id) ?? c.id) === incomingRoot.id &&
      c.assetId === incomingRoot.assetId
  );
  const pairs = outgoing.flatMap(left =>
    incoming.flatMap(right => {
      if (
        left.id === right.id ||
        Math.abs(left.start + left.duration - right.start) > EPSILON
      )
        return [];
      // A ripple gap may straddle the original cut. Its retained source edges
      // still bracket that cut, while unrelated local grade/split seams do not.
      const originalLeftEnd =
        outgoingRoot.start +
        (left.outPoint - outgoingRoot.inPoint) / (outgoingRoot.speed ?? 1);
      const originalRightStart =
        incomingRoot.start +
        (right.inPoint - incomingRoot.inPoint) / (incomingRoot.speed ?? 1);
      if (
        originalLeftEnd > transition.cutTime + EPSILON ||
        originalRightStart < transition.cutTime - EPSILON
      )
        return [];
      return [{ left, right }];
    })
  );
  if (pairs.length !== 1)
    throw new Error(
      "The original transition cut does not identify one surviving adjacent shot pair."
    );
  const { left, right } = pairs[0];
  const next = applyAdjacentTransition(
    working,
    assets,
    left.id,
    right.id,
    transition.kind,
    transition.duration
  );
  return accepted(next);
}

export const AUTONOMOUS_TRANSITION_GUIDANCE = `A genuine adjacent-shot transition uses type=transition and parameters.transition:{outgoingId,incomingId,cutTime,kind,duration}. cutTime is the intended cut on the ORIGINAL timeline; use the supplied transitionCuts and transitionSources. targetClipIds must be exactly those source IDs (one ID when both are the same). For creation, start/end are cutTime-duration/2 and cutTime+duration/2, or omit both for the compiler to supply them. kind is dissolve|wipe-left|wipe-right|wipe-up|wipe-down|slide-left|slide-right|zoom; duration is 0.05..5 seconds and must fit measured source handles and both surviving shot bodies. Instead of kind/duration, parameters.transition.presetId may select an exact transitionPresets ID; do not invent presets. A transition is applied after cuts and local treatments, with silent source handles, unchanged speech/caption timing and unchanged total length. A same-source cut requires the same outgoingId/incomingId plus an explicit cutTime and a separate evidenced split or ripple cut that creates that boundary. No boundary is created by the transition itself. Existing transitions are listed in existingTransitions. Before changing their shots' timing, splitting or restyling, explicitly remove that exact pair with type=transition, parameters.transition:{outgoingId,incomingId,cutTime,kind:none}; omit duration (canonical zero). Removal uses the supplied existing pair's full start/end range, or omit both for compilation. Removal executes first; a separate creation operation may recreate the transition after the new cut. Never silently remove a transition or target only part of its shots for removal. Missing handles, locked shots/handles, overlapping picture layers, conflicting source-audio fades or an ambiguous surviving cut are unsupported; retain a straight cut and explain the limitation instead. Source handles contain real footage, never frozen or fabricated frames. Transitions may connect a sequence when their handles do not overlap. Use only motivated transitions; no transition quota or effect on every cut. Single-clip visual entrance/exit controls are not adjacent-shot crossfades.`;
