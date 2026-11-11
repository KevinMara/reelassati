import type { Asset, EditOperation, EditProject } from "./workspace";
import type { EditPlanningContext } from "./edit-planning-context";
import { normalizeGraphic } from "./motion-graphics";

export type EditorialCoverageIssue =
  | "missing-decision"
  | "missing-evidence"
  | "invalid-evidence"
  | "missing-reason"
  | "unresolved-source"
  | "missing-operation"
  | "cosmetic-only"
  | "unrelated-operation"
  | "unchanged-operation";

export interface EditorialSceneDecision {
  sceneId: string;
  start: number;
  end: number;
  purpose: string;
  decision: "preserve" | "improve" | "blocked" | "unreviewed";
  reason: string;
  speechIds: string[];
  observationIndexes: number[];
  operationIds: string[];
  issues: EditorialCoverageIssue[];
}

/** A source-linked planning/accounting check, not a measured quality score. */
export interface EditorialCoverageReview {
  version: 1;
  status: "accounted" | "partial";
  scenes: EditorialSceneDecision[];
}

const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
const text = (value: unknown, limit = 600) =>
  typeof value === "string" ? value.trim().slice(0, limit) : "";
const captionKey = (value: string) =>
  (
    value
      .normalize("NFKC")
      .toLocaleLowerCase("en")
      .match(/[\p{L}\p{M}]+|\p{N}+(?:[.,]\p{N}+)*/gu) ?? []
  ).join("\u001f");
const contentTypes = new Set<EditOperation["type"]>([
  "trim",
  "move",
  "delete",
  "silence",
  "pacing",
  "broll",
  "caption",
  "graphic",
]);
const overlaps = (
  a: { start: number; end: number },
  b: { start: number; end: number }
) => a.start < b.end && a.end > b.start;
const review = (scenes: EditorialSceneDecision[]): EditorialCoverageReview => ({
  version: 1,
  status:
    !scenes.length || scenes.some(scene => scene.issues.length)
      ? "partial"
      : "accounted",
  scenes,
});

function actuallyChangesContent(
  project: EditProject,
  operation: EditOperation
) {
  const targets = project.clips.filter(clip =>
    operation.targetClipIds.includes(clip.id)
  );
  const parameters = operation.parameters ?? {};
  switch (operation.type) {
    case "trim":
      return targets.some(
        clip =>
          Math.abs(operation.start - clip.start) > 0.000001 ||
          Math.abs(operation.end - operation.start - clip.duration) >
            0.000001 ||
          Math.abs((parameters.sourceIn ?? clip.inPoint) - clip.inPoint) >
            0.000001
      );
    case "move":
      return targets.some(
        clip =>
          Math.abs((parameters.destination ?? clip.start) - clip.start) >
          0.000001
      );
    case "pacing":
      return targets.some(
        clip => Math.abs((parameters.speed ?? 1) - (clip.speed ?? 1)) > 0.000001
      );
    case "caption":
      return !project.transcript.some(
        segment =>
          segment.start <= operation.start + 0.001 &&
          segment.end >= operation.end - 0.001 &&
          captionKey(segment.text) === captionKey(parameters.text ?? "")
      );
    case "broll":
      return (
        !parameters.assetId ||
        !project.clips.some(
          clip =>
            !clip.hidden &&
            !clip.graphic &&
            clip.track !== "audio" &&
            clip.assetId === parameters.assetId &&
            clip.start <= operation.start &&
            clip.start + clip.duration >= operation.end &&
            Math.abs(
              clip.inPoint +
                (operation.start - clip.start) * (clip.speed ?? 1) -
                (parameters.sourceIn ?? 0)
            ) < 0.000001
        )
      );
    case "graphic": {
      if (parameters.graphicMode !== "update") return true;
      const replacement = normalizeGraphic(parameters.graphic);
      if (!replacement) return false;
      const meaningful = [
        "kind",
        "text",
        "secondaryText",
        "from",
        "to",
        "prefix",
        "suffix",
        "composition",
        "x",
        "y",
        "width",
        "height",
      ] as const;
      return targets.some(clip => {
        const current = normalizeGraphic(clip.graphic);
        return (
          current &&
          meaningful.some(
            key =>
              JSON.stringify(current[key]) !== JSON.stringify(replacement[key])
          )
        );
      });
    }
    default:
      return true;
  }
}

/** Account for every observed scene without imposing any edit/effect quota.
 * Preserve is valid with specific source evidence and a reason. A declared
 * missing explanation/shot cannot be satisfied by grade, zoom, SFX or a split.
 * Invalid/missing review data makes an otherwise safe edit partial, not a retry. */
export function reviewEditorialCoverage(
  raw: unknown,
  project: EditProject,
  context: Pick<EditPlanningContext, "scenes">,
  changes: EditOperation[],
  assets: Asset[] = []
): EditorialCoverageReview {
  const rows = Array.isArray(raw)
    ? raw.slice(0, 1000).map(record).filter(Boolean)
    : [];
  return review(
    context.scenes.map(scene => {
      const matches = rows.filter(row => row!.sceneId === scene.id);
      const row = matches.length === 1 ? matches[0] : undefined;
      const issues: EditorialCoverageIssue[] = [];
      const decision = ["preserve", "improve", "blocked"].includes(
        String(row?.decision)
      )
        ? (row!.decision as "preserve" | "improve" | "blocked")
        : "unreviewed";
      if (decision === "unreviewed") issues.push("missing-decision");
      const purpose = text(row?.purpose, 240),
        reason = text(row?.reason);
      if (row && (!purpose || !reason)) issues.push("missing-reason");
      const evidence = record(row?.evidence);
      const suppliedSpeech = Array.isArray(evidence?.speechIds)
        ? evidence.speechIds
        : [];
      const suppliedObservations = Array.isArray(evidence?.observationIndexes)
        ? evidence.observationIndexes
        : [];
      const speechIds = suppliedSpeech.filter(
        (id): id is string =>
          typeof id === "string" && scene.speechIds.includes(id)
      );
      const observationIndexes = suppliedObservations.filter(
        (index): index is number =>
          Number.isInteger(index) &&
          Number(index) >= 0 &&
          Number(index) < scene.observations.length
      );
      if (!speechIds.length && !observationIndexes.length)
        issues.push("missing-evidence");
      if (
        speechIds.length !== suppliedSpeech.length ||
        observationIndexes.length !== suppliedObservations.length
      )
        issues.push("invalid-evidence");
      const indexes = Array.isArray(row?.operationIndexes)
        ? row.operationIndexes
        : [];
      const operations = indexes.flatMap(index =>
        Number.isInteger(index) && Number(index) >= 0 && changes[Number(index)]
          ? [changes[Number(index)]]
          : []
      );
      if (indexes.length !== operations.length)
        issues.push("missing-operation");
      if (decision === "blocked") issues.push("unresolved-source");
      if (decision === "improve") {
        if (!operations.length) issues.push("missing-operation");
        else {
          const substantive = operations.filter(operation => {
            if (!contentTypes.has(operation.type)) return false;
            if (operation.type !== "broll") return true;
            const assetId = operation.parameters?.assetId;
            const asset = assets.find(item => item.id === assetId);
            // The shared visual catalog contains fixed finishing overlays and
            // frames, not source-observed demonstrations. Imported IDs and the
            // planner's shared: alias retain the same decorative classification.
            return !asset?.catalog && !assetId?.startsWith("shared:");
          });
          if (!substantive.length) issues.push("cosmetic-only");
          const related = substantive.filter(
            operation =>
              overlaps(operation, scene) &&
              (["broll", "graphic", "caption", "silence"].includes(
                operation.type
              ) ||
                scene.sources.some(source =>
                  operation.targetClipIds.includes(source.clipId)
                ))
          );
          if (substantive.length && !related.length)
            issues.push("unrelated-operation");
          if (
            related.length &&
            !related.some(operation =>
              actuallyChangesContent(project, operation)
            )
          )
            issues.push("unchanged-operation");
        }
      }
      return {
        sceneId: scene.id,
        start: scene.start,
        end: scene.end,
        purpose,
        decision,
        reason,
        speechIds: [...new Set(speechIds)],
        observationIndexes: [...new Set(observationIndexes)],
        operationIds: [...new Set(operations.map(operation => operation.id))],
        issues: [...new Set(issues)],
      };
    })
  );
}

/** Reconcile replacements/withdrawals and client omissions against stable IDs.
 * Repairing a rejected graphic with color cannot complete its content objective. */
export function reconcileEditorialCoverage(
  original: EditorialCoverageReview,
  changes: EditOperation[]
): EditorialCoverageReview {
  return review(
    original.scenes.map(scene => {
      if (scene.decision !== "improve") return { ...scene };
      const remaining = scene.operationIds.flatMap(id => {
        const operation = changes.find(change => change.id === id);
        return operation ? [operation] : [];
      });
      const issues = [...scene.issues];
      if (remaining.length !== scene.operationIds.length)
        issues.push("missing-operation");
      if (
        remaining.length &&
        !remaining.some(operation => contentTypes.has(operation.type))
      )
        issues.push("cosmetic-only");
      return { ...scene, issues: [...new Set(issues)] };
    })
  );
}

/** Recheck the current prepared source and actual retained operations locally;
 * missing/legacy coverage never becomes complete because a request succeeded. */
export function reviewAppliedEditorialCoverage(
  value: unknown,
  project: EditProject,
  context: Pick<EditPlanningContext, "scenes">,
  changes: EditOperation[],
  assets: Asset[] = []
): EditorialCoverageReview {
  const prior = normalizeEditorialCoverage(value);
  const current = reviewEditorialCoverage(
    prior?.scenes.map(scene => ({
      ...scene,
      evidence: {
        speechIds: scene.speechIds,
        observationIndexes: scene.observationIndexes,
      },
      operationIndexes: scene.operationIds.map(id =>
        changes.findIndex(change => change.id === id)
      ),
    })),
    project,
    context,
    changes,
    assets
  );
  const checked = review(
    current.scenes.map(scene => ({
      ...scene,
      issues: [
        ...new Set([
          ...scene.issues,
          ...(prior?.scenes.find(item => item.sceneId === scene.sceneId)
            ?.issues ?? []),
        ]),
      ],
    }))
  );
  if (prior?.status === "partial") checked.status = "partial";
  return checked;
}

/** Bounded display/persistence normalization. Never upgrade an incomplete report. */
export function normalizeEditorialCoverage(
  value: unknown
): EditorialCoverageReview | undefined {
  const raw = record(value);
  if (raw?.version !== 1 || !Array.isArray(raw.scenes)) return;
  const allowedIssues: EditorialCoverageIssue[] = [
    "missing-decision",
    "missing-evidence",
    "invalid-evidence",
    "missing-reason",
    "unresolved-source",
    "missing-operation",
    "cosmetic-only",
    "unrelated-operation",
    "unchanged-operation",
  ];
  const scenes = raw.scenes.slice(0, 1000).flatMap(value => {
    const row = record(value);
    if (
      !row ||
      !text(row.sceneId) ||
      !Number.isFinite(row.start) ||
      !Number.isFinite(row.end) ||
      Number(row.end) <= Number(row.start)
    )
      return [];
    const issues = Array.isArray(row.issues)
      ? row.issues.filter((issue): issue is EditorialCoverageIssue =>
          allowedIssues.includes(issue as EditorialCoverageIssue)
        )
      : ["missing-decision" as const];
    if (Array.isArray(row.issues) && issues.length !== row.issues.length)
      issues.push("missing-decision");
    const decision = ["preserve", "improve", "blocked", "unreviewed"].includes(
      String(row.decision)
    )
      ? (row.decision as EditorialSceneDecision["decision"])
      : "unreviewed";
    const speechIds = Array.isArray(row.speechIds)
      ? row.speechIds
          .map(id => text(id, 100))
          .filter(Boolean)
          .slice(0, 500)
      : [];
    const observationIndexes = Array.isArray(row.observationIndexes)
      ? row.observationIndexes
          .filter(
            (index): index is number =>
              Number.isInteger(index) && Number(index) >= 0
          )
          .slice(0, 500)
      : [];
    const operationIds = Array.isArray(row.operationIds)
      ? row.operationIds
          .map(id => text(id, 100))
          .filter(Boolean)
          .slice(0, 500)
      : [];
    if (decision === "unreviewed") issues.push("missing-decision");
    if (decision === "blocked") issues.push("unresolved-source");
    if (!text(row.purpose) || !text(row.reason)) issues.push("missing-reason");
    if (!speechIds.length && !observationIndexes.length)
      issues.push("missing-evidence");
    if (decision === "improve" && !operationIds.length)
      issues.push("missing-operation");
    return [
      {
        sceneId: text(row.sceneId, 100),
        start: Number(row.start),
        end: Number(row.end),
        purpose: text(row.purpose, 240),
        reason: text(row.reason),
        decision,
        speechIds,
        observationIndexes,
        operationIds,
        issues: [...new Set(issues)],
      },
    ];
  });
  const normalized = review(scenes);
  if (raw.status !== "accounted" || scenes.length !== raw.scenes.length)
    normalized.status = "partial";
  return normalized;
}

export const EDITORIAL_COVERAGE_DIRECTION = `
Return editorialCoverage as a content decision for EVERY supplied scene, including
any source gaps. Each row is {sceneId,purpose,decision:
preserve|improve|blocked,reason,evidence:{speechIds:[],observationIndexes:[]},
operationIndexes:[]}. sceneId and speechIds must match the supplied scene exactly;
observationIndexes are zero-based indexes in THAT scene's observations.
operationIndexes are zero-based positions in your final changes array.
Explain the scene's role in the coherent story and whether its existing source
already delivers the needed meaning, demonstration or context. Cite the actual
evidence and give a specific reason. Preserve is a first-class decision when the
source already works; it needs no invented edit. An improvement decision must
identify actual content-changing operations addressing that scene. Color, zoom,
sound hits and splitting alone do not supply a missing explanation or demonstration.
Use preserve even when adding color, camera motion or sound to a scene whose
content already works. For example: an existing spoken hook plus a readable
headline, with only grade and a push-in added, is preserve, not improve. This
describes the content decision, not whether the image received any finishing.
Shared catalog frames, transitions and textures are finishing treatments; inserting
one as broll does not supply a missing subject demonstration or explanatory shot.
They may finish a sound scene, whose content decision should then be preserve.
Missing speech, missing source material, unsupported factual additions and source-
baked defects that the available tools cannot repair must remain blocked with the
specific limitation in chat. Never treat a decorative fallback as a resolved need.
Do not force a shot/effect count, manufacture defects, or claim this planning
accountability check measures audience retention or guarantees creative quality.
`.trim();
