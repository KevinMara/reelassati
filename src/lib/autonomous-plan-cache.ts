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
  captionTreatment?: AutonomousCaptionTreatment;
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
    project: {
      ...input.project,
      playhead: undefined,
      activeAssetId: undefined,
      updatedAt: undefined,
      editorChat: undefined,
    },
  });
}

/** One completed response, held only in the mounted editor. Reading never starts
 * requests or retries. Clear before media/publishing side effects and on success. */
export function createAutonomousPlanCache() {
  let entry:
    | { key: string; working: EditProject; result: AutonomousPlanResult }
    | undefined;
  return {
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
