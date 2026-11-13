import type { EditOperation, EditProject, TimelineClip } from "./workspace";
import { assertLinkedEditTargets } from "./clip-groups";
import {
  EditPlanValidationError,
  type EditPlanValidationReason,
} from "./edit-plan-validation";

const EPSILON = 0.000001;
const additive = (operation: EditOperation) =>
  ["sound", "broll", "caption"].includes(operation.type) ||
  (operation.type === "graphic" &&
    operation.parameters?.graphicMode !== "update");
const overlaps = (
  start: number,
  end: number,
  otherStart: number,
  otherEnd: number
) => start < otherEnd - EPSILON && end > otherStart + EPSILON;
const targets = (
  project: Pick<EditProject, "clips">,
  operation: EditOperation
) => project.clips.filter(clip => operation.targetClipIds.includes(clip.id));

/** Retaining a source range can be staged early only when every retained sample
 * stays at its original timeline position. This is not a moving/ripple trim. */
export function trimPreservesTimelineClock(
  project: Pick<EditProject, "clips">,
  operation: EditOperation
) {
  const clips = targets(project, operation);
  return (
    operation.type === "trim" &&
    clips.length > 0 &&
    clips.every(clip => {
      const speed = clip.speed ?? 1;
      const sourceIn = operation.parameters?.sourceIn ?? clip.inPoint;
      return (
        Number.isFinite(speed) &&
        speed > 0 &&
        Math.abs(
          operation.start - (clip.start + (sourceIn - clip.inPoint) / speed)
        ) <= EPSILON
      );
    })
  );
}

function changesClock(operation: EditOperation, clip: TimelineClip) {
  if (operation.type === "move")
    return (
      Math.abs(
        (operation.parameters?.destination ?? operation.start) - clip.start
      ) > EPSILON
    );
  if (operation.type === "pacing")
    return (
      Math.abs(
        (operation.parameters?.speed ?? clip.speed ?? 1) - (clip.speed ?? 1)
      ) > EPSILON
    );
  if (operation.type === "trim") {
    const sourceIn = operation.parameters?.sourceIn ?? clip.inPoint;
    return (
      Math.abs(
        operation.start -
          (clip.start + (sourceIn - clip.inPoint) / (clip.speed ?? 1))
      ) > EPSILON
    );
  }
  return false;
}

/** The server runs this before signing/settling the plan; execution uses the same
 * checks. Never invent a second clock for an ambiguous structural composition. */
export function assertAutonomousComposition(
  project: Pick<EditProject, "clips">,
  operations: EditOperation[]
) {
  const invalid = (
    reason: EditPlanValidationReason,
    message: string,
    operation: EditOperation
  ): never => {
    throw new EditPlanValidationError(
      reason,
      message,
      operations.indexOf(operation),
      operation.type
    );
  };
  for (const operation of operations) {
    try {
      assertLinkedEditTargets(project, operation);
    } catch {
      invalid(
        "linked_targets_invalid",
        "Include linked audio or unlock the linked targets before changing their timing.",
        operation
      );
    }
  }
  const retained = operations.filter(operation =>
    trimPreservesTimelineClock(project, operation)
  );
  for (const trim of retained) {
    for (const clip of targets(project, trim)) {
      for (const local of operations) {
        if (local === trim || !local.targetClipIds.includes(clip.id)) continue;
        if (local.type === "delete")
          invalid(
            "retained_range_conflict",
            "A retained trim and whole-clip deletion conflict. Choose the intended structural edit.",
            local
          );
        if (
          local.type === "split" &&
          (local.start <= trim.start + EPSILON ||
            local.start >= trim.end - EPSILON)
        )
          invalid(
            "retained_range_conflict",
            "The split falls outside the retained source. It needs explicit structural targets.",
            local
          );
        if (!["style", "audio"].includes(local.type)) continue;
        // A whole-clip grade/mix follows the retained clip. A specifically timed
        // treatment must survive completely; silently compressing half of an
        // emphasis or changing its beat would be a different editorial decision.
        const wholeClip =
          local.start <= clip.start + EPSILON &&
          local.end >= clip.start + clip.duration - EPSILON;
        const staticTreatment =
          local.type === "audio" ||
          (!local.parameters?.visual &&
            !local.parameters?.fadeIn &&
            !local.parameters?.fadeOut);
        // A rounded global grade may end before a fractional source tail while
        // still covering every retained frame. No motion clock is compressed.
        const coversRetained =
          staticTreatment &&
          local.start <= trim.start + EPSILON &&
          local.end >= trim.end - EPSILON;
        const start = Math.max(clip.start, local.start);
        const end = Math.min(clip.start + clip.duration, local.end);
        if (
          !wholeClip &&
          !coversRetained &&
          (start < trim.start - EPSILON ||
            end > trim.end + EPSILON ||
            start >= end)
        )
          invalid(
            "retained_range_conflict",
            "The local treatment does not fit the retained source. It needs explicit structural targets.",
            local
          );
      }
    }
  }
  for (const structural of operations.filter(operation =>
    ["trim", "move", "pacing"].includes(operation.type)
  )) {
    for (const clip of targets(project, structural)) {
      if (!changesClock(structural, clip)) {
        if (
          structural.type !== "trim" &&
          operations.some(
            other =>
              other !== structural &&
              (other.type === "silence" ||
                ([
                  "trim",
                  "move",
                  "pacing",
                  "split",
                  "delete",
                  "style",
                  "audio",
                ].includes(other.type) &&
                  other.targetClipIds.includes(clip.id)))
          )
        )
          invalid(
            "clock_conflict",
            "A redundant move or speed operation cannot address locally split source pieces. Remove that operation before applying the treatment.",
            structural
          );
        continue;
      }
      const nextStart =
        structural.type === "move"
          ? (structural.parameters?.destination ?? structural.start)
          : structural.type === "trim"
            ? structural.start
            : clip.start;
      const nextEnd =
        structural.type === "trim"
          ? structural.end
          : nextStart +
            (clip.outPoint - clip.inPoint) /
              (structural.type === "pacing"
                ? (structural.parameters?.speed ?? clip.speed ?? 1)
                : (clip.speed ?? 1));
      if (
        operations.some(
          other =>
            other !== structural &&
            (other.type === "silence" ||
              ([
                "trim",
                "move",
                "pacing",
                "split",
                "delete",
                "style",
                "audio",
              ].includes(other.type) &&
                other.targetClipIds.includes(clip.id)) ||
              (additive(other) &&
                (overlaps(
                  other.start,
                  other.end,
                  clip.start,
                  clip.start + clip.duration
                ) ||
                  overlaps(other.start, other.end, nextStart, nextEnd))))
        )
      )
        invalid(
          "clock_conflict",
          "A moved or speed-changed source with dependent timed edits needs a new plan on the resulting timeline. No edit was applied.",
          structural
        );
    }
  }
  if (retained.length) {
    const retainedEnd = Math.max(
      1,
      ...project.clips.map(
        clip =>
          retained.find(trim => trim.targetClipIds.includes(clip.id))?.end ??
          clip.start + clip.duration
      ),
      ...operations
        .filter(
          operation => additive(operation) && operation.type !== "caption"
        )
        .map(operation => operation.end)
    );
    const invalidRipple = operations.find(
      operation =>
        operation.type === "silence" && operation.end > retainedEnd + EPSILON
    );
    if (invalidRipple)
      invalid(
        "ripple_range_invalid",
        "The ripple cut extends beyond the retained timeline. Choose a surviving interval.",
        invalidRipple
      );
  }
}

/** Insertions and local treatments use the original clock. Materialize them
 * before ripple cuts project their source samples; otherwise a treatment that
 * spans a later cut would address already-shifted source pieces. Safe retained
 * trims still precede local splits; ripple cuts remain in descending time. */
export function orderAutonomousOperations(
  project: Pick<EditProject, "clips">,
  operations: EditOperation[]
) {
  assertAutonomousComposition(project, operations);
  const phase = (operation: EditOperation) =>
    operation.type === "transition"
      ? operation.parameters?.transition?.kind === "none"
        ? -1
        : 5
      : operation.type === "sound"
        ? 0
        : additive(operation)
          ? 1
          : trimPreservesTimelineClock(project, operation)
            ? 2
            : ["style", "audio", "split", "graphic"].includes(operation.type)
              ? 3
              : 4;
  return [...operations].sort(
    (a, b) =>
      phase(a) - phase(b) ||
      (a.type === "transition" && b.type === "transition"
        ? a.start - b.start
        : b.start - a.start)
  );
}
