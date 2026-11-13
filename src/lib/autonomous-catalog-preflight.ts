import type { Asset, EditOperation, EditProject } from "@contracts/workspace";
import { catalogEffectForAsset } from "@contracts/editor-effect-catalog";
import {
  draftAutonomousPlan,
  type AutonomousGraphicDecision,
} from "@contracts/autonomous-execution";
import {
  catalogOverlayDraftBinding,
  preflightCatalogOverlays,
} from "./catalog-overlay-preflight";

/** Inspect the final composed pixels, then rebuild after any omitted insert.
 * Removing one layer changes stacking and may expose another. Signed proposals
 * remain immutable, and every withheld insert is retained in the receipt. */
export async function preflightAutonomousCatalogMedia(options: {
  project: EditProject;
  changes: EditOperation[];
  assets: Asset[];
  signal: AbortSignal;
  checkpoint: () => void;
  onProgress?: (message: string) => void;
  inspect?: typeof preflightCatalogOverlays;
}) {
  let changes = options.changes;
  const omitted: AutonomousGraphicDecision[] = [];
  const assets = new Map(options.assets.map(asset => [asset.id, asset]));
  const inspect = options.inspect ?? preflightCatalogOverlays;
  for (;;) {
    options.signal.throwIfAborted();
    options.checkpoint();
    const candidates = changes.filter(operation => {
      const asset = assets.get(operation.parameters?.assetId ?? "");
      return (
        operation.type === "broll" &&
        Boolean(asset && (asset.catalog || catalogEffectForAsset(asset))) &&
        (asset?.kind === "image" || asset?.kind === "video")
      );
    });
    if (!candidates.length) return { changes, omitted };
    const { draft, mediaOwners } = draftAutonomousPlan(
      options.project,
      changes,
      options.assets,
      options.checkpoint
    );
    const operationClipIds = Object.fromEntries(
      candidates.map(operation => [
        operation.id,
        draft.clips
          .filter(clip => mediaOwners.get(clip.id) === operation.id)
          .map(clip => clip.id),
      ])
    );
    const request = {
      project: draft,
      assets: options.assets,
      operationClipIds,
      signal: options.signal,
      onProgress: options.onProgress,
    };
    const binding = catalogOverlayDraftBinding(request);
    const review = await inspect(request);
    options.signal.throwIfAborted();
    options.checkpoint();
    const blocked = new Set(review.blockedOperationIds);
    const unverified = new Set(review.unverifiedOperationIds);
    const checked = new Set(review.checkedOperationIds);
    for (const operation of candidates)
      if (
        !operationClipIds[operation.id].length ||
        review.draftBinding !== binding ||
        !checked.has(operation.id)
      )
        unverified.add(operation.id);
    const removed = candidates.filter(
      operation => blocked.has(operation.id) || unverified.has(operation.id)
    );
    if (!removed.length) return { changes, omitted };
    for (const operation of removed) {
      const obstructs = blocked.has(operation.id);
      omitted.push({
        operationId: operation.id,
        label: operation.label,
        issues: [
          {
            reason: obstructs ? "source-overlap" : "unknown-source-layout",
            uncertain: !obstructs,
            detail: obstructs
              ? "The selected overlay would obscure protected source content. Its file is available in Library."
              : "This overlay could not be fully checked against the source. Its file is available in Library.",
          },
        ],
      });
    }
    const ids = new Set(removed.map(operation => operation.id));
    changes = changes.filter(operation => !ids.has(operation.id));
    // Each repeat removes at least one candidate; no inference or retries.
  }
}
