import type { Asset, EditOperation, EditProject } from "./workspace";
import type { StockMedia } from "./stock-media";
import { editorAudioCatalog } from "./editor-audio-catalog";
import { EditPlanValidationError } from "./edit-plan-validation";
import {
  draftAutonomousPlan,
  preflightAutonomousPlan,
  type AutonomousGraphicDecision,
  type AutonomousGraphicReview,
} from "./autonomous-execution";
import { protectedSourceBounds } from "./automatic-graphic-protection";
import { normalizeSourceVisualEvidence } from "./source-visual-evidence";
import { effectiveTimelineClips } from "./timeline-mixer";
import { normalizeGraphic } from "./motion-graphics";

export interface EditPlanQualityReview {
  repairedOperationIds: string[];
  withdrawn: AutonomousGraphicDecision[];
}

/** Match the client's measured media inventory; URLs are not needed to draft. */
export function editPlanQualityAssets(
  assets: Asset[],
  stock: StockMedia[]
): Asset[] {
  return [
    ...assets,
    ...stock.map(item => ({
      id: `stock:${item.provider}:${item.id}`,
      name: item.title,
      kind: item.kind,
      status: "ready" as const,
      duration: item.duration,
      url: "",
      size: 0,
      createdAt: "",
      contentType: `${item.kind}/${item.kind === "video" ? "webm" : "jpeg"}`,
    })),
    ...editorAudioCatalog.map(item => ({
      id: `catalog:${item.id}`,
      name: item.name,
      kind: "audio" as const,
      status: "ready" as const,
      duration: item.duration,
      url: "",
      size: 0,
      createdAt: "",
      contentType: "audio/wav",
    })),
  ];
}

export function reviewEditPlanGraphics(
  project: EditProject,
  changes: EditOperation[],
  assets: Asset[],
  request: string,
  checkpoint: () => void
): AutonomousGraphicReview {
  checkpoint();
  try {
    return preflightAutonomousPlan(project, changes, assets, checkpoint, {
      request,
    });
  } catch (error) {
    // Preserve cancellation/deadline identity; never turn it into a repair request.
    checkpoint();
    if (error instanceof EditPlanValidationError) throw error;
    throw new EditPlanValidationError(
      "graphic_refinement_unsafe",
      "The composed edit cannot pass preflight."
    );
  }
}

/** Salvage valid work after the single model correction. Only automatic text
 * cards may move; arrows/highlights retain their semantic attachment points.
 * Every candidate uses the full renderer-aware source and motion checks. Text,
 * size, duration, source timing and every unrelated operation stay untouched. */
export function finalizeEditPlanGraphics(
  project: EditProject,
  changes: EditOperation[],
  assets: Asset[],
  request: string,
  checkpoint: () => void
): { changes: EditOperation[]; qualityReview: EditPlanQualityReview } {
  const review = reviewEditPlanGraphics(
    project,
    changes,
    assets,
    request,
    checkpoint
  );
  const rejected = new Map(
    review.omitted.map(item => [item.operationId, item])
  );
  const accepted = new Map(
    changes.filter(item => !rejected.has(item.id)).map(item => [item.id, item])
  );
  const repairedOperationIds: string[] = [];
  for (const operation of changes) {
    const decision = rejected.get(operation.id);
    const graphic = normalizeGraphic(operation.parameters?.graphic);
    if (
      !decision ||
      request.trim() ||
      operation.parameters?.graphicMode === "update" ||
      !graphic ||
      !["text", "callout"].includes(graphic.kind) ||
      decision.issues.some(
        issue => !["source-overlap", "competing-text"].includes(issue.reason)
      )
    )
      continue;
    const positions = [...new Set([graphic.x, 25, 50, 75])]
      .flatMap(x =>
        [...new Set([graphic.y, 15, 30, 50, 70, 85])].map(y => ({ x, y }))
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - graphic.x, a.y - graphic.y) -
          Math.hypot(b.x - graphic.x, b.y - graphic.y)
      );
    for (const position of positions) {
      checkpoint();
      const dx = position.x - graphic.x,
        dy = position.y - graphic.y;
      if (!dx && !dy) continue;
      const motion = graphic.motion?.map(frame => ({
        ...frame,
        x: frame.x + dx,
        y: frame.y + dy,
      }));
      // Do not clamp paths or change their motion to make a placement fit.
      if (
        motion?.some(
          frame => frame.x < 0 || frame.x > 100 || frame.y < 0 || frame.y > 100
        )
      )
        continue;
      const candidate: EditOperation = {
        ...operation,
        parameters: {
          ...operation.parameters,
          graphic: { ...graphic, ...position, ...(motion ? { motion } : {}) },
        },
      };
      const attempt = changes.flatMap(item =>
        item.id === operation.id
          ? [candidate]
          : accepted.has(item.id)
            ? [accepted.get(item.id)!]
            : []
      );
      let checked: AutonomousGraphicReview;
      try {
        checked = reviewEditPlanGraphics(
          project,
          attempt,
          assets,
          request,
          checkpoint
        );
      } catch (error) {
        checkpoint();
        // A new placement can fail the render-safe frame check. Only that
        // candidate is rejected; source, execution and cancellation failures
        // keep their normal failure path.
        if (
          error instanceof EditPlanValidationError &&
          error.reason === "audit_graphic_readability"
        )
          continue;
        throw error;
      }
      if (checked.omitted.length) continue;
      accepted.set(operation.id, candidate);
      rejected.delete(operation.id);
      repairedOperationIds.push(operation.id);
      break;
    }
  }
  const result = changes.flatMap(item =>
    accepted.has(item.id) ? [accepted.get(item.id)!] : []
  );
  const finalReview = reviewEditPlanGraphics(
    project,
    result,
    assets,
    request,
    checkpoint
  );
  if (finalReview.omitted.length)
    throw new EditPlanValidationError(
      "graphic_refinement_unsafe",
      "The final composed graphics changed after validation."
    );
  return {
    changes: result,
    qualityReview: { repairedOperationIds, withdrawn: [...rejected.values()] },
  };
}

/** Source rectangles are normalized; these measured samples are in canvas %.
 * They help composition but never replace the guard's complete frame sampling. */
export function editPlanGraphicFeedback(
  project: EditProject,
  changes: EditOperation[],
  assets: Asset[],
  review: AutonomousGraphicReview,
  checkpoint: () => void
) {
  const { draft } = draftAutonomousPlan(project, changes, assets, checkpoint);
  const [width, height] = draft.aspectRatio.split(":").map(Number);
  const canvas = { width: 1000, height: (1000 * height) / width };
  const protectedRegions = effectiveTimelineClips(draft).flatMap(clip => {
    checkpoint();
    const asset = assets.find(item => item.id === clip.assetId);
    if (!asset?.width || !asset.height) return [];
    const evidence = normalizeSourceVisualEvidence(
      draft.sourceReviews?.find(item => item.assetId === clip.assetId)
        ?.visualProtection,
      asset.duration
    );
    return (evidence?.regions ?? []).flatMap(region => {
      const start = Math.max(
        clip.start,
        clip.start + (region.start - clip.inPoint) / (clip.speed ?? 1)
      );
      const end = Math.min(
        clip.start + clip.duration,
        clip.start + (region.end - clip.inPoint) / (clip.speed ?? 1)
      );
      if (end <= start) return [];
      return [
        {
          sourceClipId: clip.id,
          assetId: asset.id,
          regionId: region.id,
          kind: region.kind,
          start,
          end,
          sourceRect: region.rect,
          samples: [start, (start + end) / 2, Math.max(start, end - 0.001)].map(
            time => {
              const rect = protectedSourceBounds(
                clip,
                time,
                region.rect,
                { width: asset.width!, height: asset.height! },
                canvas
              );
              return {
                time,
                canvasPercent: rect && {
                  x: (rect.x / canvas.width) * 100,
                  y: (rect.y / canvas.height) * 100,
                  width: (rect.width / canvas.width) * 100,
                  height: (rect.height / canvas.height) * 100,
                },
              };
            }
          ),
        },
      ];
    });
  });
  return {
    rejected: review.omitted.map(decision => ({
      ...decision,
      operation: changes.find(
        operation => operation.id === decision.operationId
      ),
    })),
    immutableChanges: changes.filter(
      operation =>
        !review.omitted.some(item => item.operationId === operation.id)
    ),
    geometry: {
      aspectRatio: draft.aspectRatio,
      frameRate: draft.frameRate ?? 30,
      sourceSizes: assets
        .filter(asset => asset.width && asset.height)
        .map(({ id, width, height }) => ({ assetId: id, width, height })),
      composedClips: draft.clips,
      protectedRegions,
      sampleNote:
        "Illustrative boundary/midpoint samples only. Final validation checks every rendered frame and animation states; do not infer safety between these samples.",
    },
  };
}

const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
const invalid = () =>
  new EditPlanValidationError(
    "graphic_refinement_invalid",
    "The graphic correction response is incomplete or ambiguous."
  );
const scopeError = () =>
  new EditPlanValidationError(
    "graphic_refinement_scope",
    "A graphic correction exceeds its original edit scope."
  );
// A rejected overlay must not be "repaired" by hiding or reframing its source.
// Geometry, fit, opacity and transition controls need their own editorial
// decision. Only a subtle grade is available as a graphic-to-style fallback.
const refinementColorBounds = {
  exposure: [-0.5, 0.5],
  temperature: [-0.15, 0.15],
  tint: [-0.15, 0.15],
  highlights: [-0.15, 0.15],
  shadows: [-0.15, 0.15],
  whites: [-0.15, 0.15],
  blacks: [-0.15, 0.15],
  brightness: [-0.1, 0.1],
  contrast: [0.85, 1.15],
  saturation: [0.85, 1.15],
} satisfies Record<string, readonly [number, number]>;

function assertRefinementParameters(type: unknown, value: unknown) {
  const parameters = record(value);
  if (!parameters || !Object.keys(parameters).length) throw scopeError();
  for (const [key, control] of Object.entries(parameters)) {
    if (type === "graphic") {
      if (!["graphic", "graphicMode"].includes(key)) throw scopeError();
    } else if (type === "style") {
      const bounds = Object.hasOwn(refinementColorBounds, key)
        ? refinementColorBounds[key as keyof typeof refinementColorBounds]
        : undefined;
      if (
        !bounds ||
        typeof control !== "number" ||
        !Number.isFinite(control) ||
        control < bounds[0] ||
        control > bounds[1]
      )
        throw scopeError();
    } else throw scopeError();
  }
}

/** Repairs can replace only rejected graphics. No general replanning, new
 * spending, speech changes, new targets or silent omission of valid operations. */
export function mergeGraphicRefinement(
  original: EditOperation[],
  rejected: AutonomousGraphicDecision[],
  response: unknown,
  compile: (raw: unknown) => EditOperation[]
): {
  changes: EditOperation[];
  summary: string;
  qualityReview: EditPlanQualityReview;
} {
  const output = record(response);
  if (
    !output ||
    typeof output.summary !== "string" ||
    !output.summary.trim() ||
    !Array.isArray(output.corrections) ||
    output.corrections.length !== rejected.length ||
    Object.keys(output).some(
      key => !["summary", "corrections", "editorialNotes"].includes(key)
    )
  )
    throw invalid();
  const replacements = new Map<string, EditOperation | null>();
  const withdrawn: AutonomousGraphicDecision[] = [];
  for (const raw of output.corrections) {
    const row = record(raw);
    const id = row?.operationId;
    const decision = rejected.find(item => item.operationId === id);
    const prior = original.find(item => item.id === id);
    if (
      !row ||
      typeof id !== "string" ||
      !decision ||
      !prior ||
      replacements.has(id) ||
      Object.keys(row).some(
        key => !["operationId", "operation", "withdraw"].includes(key)
      )
    )
      throw invalid();
    const withdrawal = record(row.withdraw);
    if (withdrawal) {
      if (
        row.operation !== undefined ||
        Object.keys(withdrawal).some(key => key !== "reason")
      )
        throw invalid();
      const issue = decision.issues.find(
        item => item.reason === withdrawal.reason
      );
      if (!issue) throw invalid();
      withdrawn.push({ ...decision, issues: [issue] });
      replacements.set(id, null);
      continue;
    }
    const operation = record(row.operation);
    if (
      !operation ||
      row.withdraw !== undefined ||
      !["graphic", "style"].includes(String(operation.type))
    )
      throw scopeError();
    assertRefinementParameters(operation.type, operation.parameters);
    const compiled = compile([operation]);
    if (compiled.length !== 1) throw invalid();
    const replacement = compiled[0];
    if (replacement.type !== operation.type) throw scopeError();
    // Reject unsafe controls; never rely on normalization silently dropping or
    // clamping them, or allow compilation to add a new control after this check.
    assertRefinementParameters(replacement.type, replacement.parameters);
    if (
      replacement.start < prior.start - 0.001 ||
      replacement.end > prior.end + 0.001 ||
      replacement.targetClipIds.some(
        target => !prior.targetClipIds.includes(target)
      ) ||
      (prior.parameters?.graphicMode === "update" &&
        (replacement.type !== "graphic" ||
          replacement.parameters?.graphicMode !== "update" ||
          JSON.stringify(replacement.targetClipIds) !==
            JSON.stringify(prior.targetClipIds))) ||
      (prior.parameters?.graphicMode !== "update" &&
        replacement.parameters?.graphicMode === "update")
    )
      throw scopeError();
    // Keeping the original object is insufficient if a replacement overwrites
    // the same accepted control later in execution. Additive visual treatment
    // may use other controls, but cannot undo a validated grade or framing.
    if (
      replacement.type === "style" &&
      original.some(
        accepted =>
          !rejected.some(item => item.operationId === accepted.id) &&
          accepted.type === "style" &&
          accepted.start < replacement.end &&
          accepted.end > replacement.start &&
          accepted.targetClipIds.some(target =>
            replacement.targetClipIds.includes(target)
          ) &&
          Object.keys(replacement.parameters ?? {}).some(
            key => key in (accepted.parameters ?? {})
          )
      )
    )
      throw scopeError();
    replacements.set(id, { ...replacement, id });
  }
  return {
    changes: original.flatMap(operation =>
      replacements.has(operation.id)
        ? replacements.get(operation.id)
          ? [replacements.get(operation.id)!]
          : []
        : [operation]
    ),
    summary: output.summary.trim(),
    qualityReview: {
      repairedOperationIds: [...replacements]
        .filter(([, operation]) => operation)
        .map(([id]) => id),
      withdrawn,
    },
  };
}

export const EDIT_PLAN_GRAPHIC_REFINEMENT_DIRECTION = `The draft has failed the editor's deterministic graphic preflight. Make one bounded correction, not a new plan. Return JSON only {"summary":"accurate final proposal summary", "editorialNotes":[], "corrections":[{"operationId":"exact rejected ID","operation":{...complete replacement operation...}} OR {"operationId":"exact rejected ID","withdraw":{"reason":"one of this ID's exact reported reason codes"}}]}. Account for every rejected ID exactly once. Immutable changes and the prepared captions must remain unchanged; do not return them or add new operations. Prefer a useful source-supported graphic repair; a subtle color-only style treatment may replace it on the same targets and within the original interval. If the source already communicates the point, or no useful safe treatment fits, explicitly withdraw that rejected graphic with its actual reported reason. Do not force a graphic quota or claim withdrawn work was applied. Replacements may only be graphic or style, within the original interval and target IDs. Never create media, sounds, captions, speech, structural edits, new targets, or spending. Keep graphicMode=create unless repairing an existing update. For graphic parameters use only graphic and graphicMode; style accepts only finite color controls within these inclusive bounds: ${JSON.stringify(refinementColorBounds)}. Never use visual, fit, position, scale, rotation, crop, masks, keyframes, opacity, fades or transitions as a graphic replacement. Rejecting a graphic never authorizes hiding or removing its source. Do not overwrite any immutable style control on an overlapping target and interval; add a different supported control instead. Use exact contiguous source speech/OCR phrases overlapping the graphic interval; never paraphrase a medical claim or invent text. Place the actual painted shape clear of all protected regions and concurrent text across its full motion, preserve readability time, and respect source aspect/fit/crop/transform. Source evidence, source coordinates and timeline clocks in the request remain authoritative. A generated command's general instruction to use graphics is not permission to cover source content. When editorialCoverage identifies a content objective for a rejected operationId, prefer a useful source-supported graphic repair that still serves that objective within the existing scope. A color fallback or withdrawal leaves that content objective unresolved; do not describe it as fulfilled or add unrelated operations to compensate. Summary must describe the final proposal, including important deliberate withdrawals, and never claim execution.`;
