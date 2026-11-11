import type { ContentProvenance } from "@contracts/compliance";
import type { StockMedia } from "@contracts/stock-media";
import type { AutonomousCaptionTreatment } from "@contracts/editorial-captions";
import type {
  EditOperation,
  EditProject,
  WorkspaceDocument,
} from "@contracts/workspace";

export interface AutonomousPlanResult {
  changes: EditOperation[];
  stockMedia?: StockMedia[];
  sharedCatalog?: import("@contracts/shared-media-catalog").SharedMediaCatalogItem[];
  captionTreatment?: AutonomousCaptionTreatment;
  qualityReview?: import("@contracts/edit-plan-quality").EditPlanQualityReview;
  editorialNotes?: import("@contracts/editorial-notes").EditorialNote[];
  editorialCoverage?: import("@contracts/editorial-coverage").EditorialCoverageReview;
  stockReview?: import("@contracts/editorial-stock").EditorialStockReview;
  summary: string;
  provenance: ContentProvenance;
}

export interface AutonomousPlanCacheInput {
  scope: { ownerId: string; ownerEmail: string; brandId: string };
  project: EditProject;
  assets: WorkspaceDocument["assets"];
  brandKit: WorkspaceDocument["brandKit"];
  savedReports: WorkspaceDocument["analyzerReports"];
  contentLanguage: string;
  uiLocale: string;
  options: Record<string, string | number | boolean>;
}

/** Use the original inputs, before preparation adds fresh review timestamps.
 * Navigation and save timestamps do not change the edit. All evidence, history,
 * source records and explicit options do; false misses are safer than stale reuse. */
export function autonomousPlanCacheKey(input: AutonomousPlanCacheInput) {
  return JSON.stringify({
    ...input,
    planningContract: "scene-stock-lut-v2",
    project: {
      ...input.project,
      playhead: undefined,
      activeAssetId: undefined,
      updatedAt: undefined,
      editorChat: undefined,
    },
  });
}

/** Quotes belong to the inputs that produced the plan, including only its own
 * evidence checkpoints. Never stamp an old result with a newer workspace. */
export function autonomousQuoteKey(planKey: string): string {
  const accepted = JSON.parse(planKey) as AutonomousPlanCacheInput;
  return JSON.stringify({
    ...accepted,
    scope: { ...accepted.scope, ownerId: accepted.scope.ownerEmail },
  });
}

/** One completed response, held only in the mounted editor. Reading never starts
 * requests or retries. Clear before media/publishing side effects and on success. */
export function createAutonomousPlanCache() {
  let entry:
    | { key: string; working: EditProject; result: AutonomousPlanResult }
    | undefined;
  return {
    has(key: string) {
      return entry?.key === key;
    },
    read(key: string) {
      if (entry?.key !== key) {
        entry = undefined;
        return undefined;
      }
      return structuredClone(entry);
    },
    write(key: string, working: EditProject, result: AutonomousPlanResult) {
      entry = structuredClone({ key, working, result });
    },
    clear() {
      entry = undefined;
    },
  };
}
