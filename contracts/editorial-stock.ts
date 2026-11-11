import type { Asset, EditOperation } from "./workspace";
import type { EditPlanningContext } from "./edit-planning-context";
import type { StockMedia } from "./stock-media";

export interface EditorialStockPurpose {
  sceneId: string;
  start: number;
  end: number;
  purpose: string;
}
export interface EditorialStockSearch {
  kind: "video" | "image";
  query: string;
  purposes: EditorialStockPurpose[];
}
export interface EditorialStockCandidate {
  media: StockMedia;
  assetId: string;
  searches: Array<{ query: string; purposes: EditorialStockPurpose[] }>;
  /** Actual saved source observations, never a timestamp inferred from a poster. */
  verifiedSourceRanges: Array<{
    assetId: string;
    start: number;
    end: number;
    visualEvidence: string;
  }>;
}
export interface EditorialStockReview {
  omitted: Array<{
    operationId: string;
    reason:
      "unavailable-stock" | "unverified-excerpt" | "duration-out-of-bounds";
  }>;
}
const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
const stockId = (item: StockMedia) => `stock:${item.provider}:${item.id}`;

/** One provider query can serve several actual beats. Deduplicate requests while
 * retaining every supplied purpose; old unscoped requests stay visibly unscoped. */
export function editorialStockSearches(
  raw: unknown,
  context: Pick<EditPlanningContext, "scenes">
): EditorialStockSearch[] {
  if (!Array.isArray(raw)) return [];
  const searches = new Map<string, EditorialStockSearch>();
  for (const value of raw) {
    const row = record(value);
    if (
      !row ||
      !["video", "image"].includes(String(row.kind)) ||
      typeof row.query !== "string"
    )
      continue;
    const query = row.query.trim().slice(0, 120);
    if (!query) continue;
    const scene = context.scenes.find(scene => scene.id === row.sceneId);
    const purpose =
      typeof row.purpose === "string" ? row.purpose.trim().slice(0, 300) : "";
    const key = `${row.kind}:${query.toLocaleLowerCase("en")}`;
    const search = searches.get(key) ?? {
      kind: row.kind as "video" | "image",
      query,
      purposes: [],
    };
    if (
      scene &&
      purpose &&
      !search.purposes.some(
        value => value.sceneId === scene.id && value.purpose === purpose
      )
    )
      search.purposes.push({
        sceneId: scene.id,
        start: scene.start,
        end: scene.end,
        purpose,
      });
    searches.set(key, search);
  }
  return [...searches.values()];
}

/** Associate complete provider result pages with their requested story jobs.
 * No result-count quota or new source inspection/model call is introduced. */
export function associateEditorialStock(
  results: Array<{ search: EditorialStockSearch; media: StockMedia[] }>,
  context: Pick<EditPlanningContext, "mediaExcerpts">,
  assets: Asset[]
): EditorialStockCandidate[] {
  const candidates = new Map<string, EditorialStockCandidate>();
  for (const { search, media } of results)
    for (const item of media) {
      if (item.kind !== search.kind) continue;
      const id = stockId(item);
      const candidate = candidates.get(id) ?? {
        media: item,
        assetId: id,
        searches: [],
        verifiedSourceRanges: [],
      };
      candidate.searches.push({
        query: search.query,
        purposes: search.purposes.map(purpose => ({ ...purpose })),
      });
      candidates.set(id, candidate);
    }
  for (const candidate of candidates.values()) {
    const ownedIds = new Set(
      assets
        .filter(
          asset =>
            asset.status === "ready" &&
            asset.stock?.provider === candidate.media.provider &&
            asset.stock.id === candidate.media.id &&
            asset.stock.url === candidate.media.url
        )
        .map(asset => asset.id)
    );
    candidate.verifiedSourceRanges = context.mediaExcerpts
      .filter(excerpt => ownedIds.has(excerpt.assetId))
      .map(excerpt => ({
        assetId: excerpt.assetId,
        start: excerpt.sourceIn,
        end: excerpt.sourceOut,
        visualEvidence: excerpt.visualEvidence,
      }));
  }
  return [...candidates.values()];
}

/** Keep valid work when a supporting insert invents an unavailable asset or
 * source-clock event. Never turn a proposed offset into zero behind the user's
 * back. The caller retains original operation indexes for coverage accounting. */
export function reviewEditorialStockOperations(
  changes: EditOperation[],
  candidates: EditorialStockCandidate[],
  rawOperations?: unknown[]
): { changes: EditOperation[]; review: EditorialStockReview } {
  const omitted: EditorialStockReview["omitted"] = [];
  const retained = changes.filter((operation, index) => {
    const id = operation.parameters?.assetId;
    if (!id?.startsWith("stock:")) return true;
    const candidate = candidates.find(candidate => candidate.assetId === id);
    let reason: EditorialStockReview["omitted"][number]["reason"] | undefined;
    const raw = rawOperations ? record(rawOperations[index]) : undefined;
    const offset = rawOperations
      ? record(raw?.parameters)?.sourceIn
      : operation.parameters?.sourceIn;
    const seconds = operation.end - operation.start;
    if (
      !candidate ||
      operation.type !== "broll" ||
      !["image", "video"].includes(candidate.media.kind)
    )
      reason = "unavailable-stock";
    else if (candidate.media.kind === "image") {
      if (offset !== undefined && offset !== 0) reason = "unverified-excerpt";
    } else if (
      typeof offset !== "number" ||
      !Number.isFinite(offset) ||
      offset < 0 ||
      (offset > 0 &&
        !candidate.verifiedSourceRanges.some(
          range =>
            offset >= range.start && offset + seconds <= range.end + 0.000001
        ))
    )
      reason = "unverified-excerpt";
    else if (
      candidate.media.duration !== undefined &&
      (!Number.isFinite(candidate.media.duration) ||
        offset + seconds > candidate.media.duration + 0.000001)
    )
      reason = "duration-out-of-bounds";
    if (!reason) return true;
    omitted.push({ operationId: operation.id, reason });
    return false;
  });
  return { changes: retained, review: { omitted } };
}

export const EDITORIAL_STOCK_SEARCH_DIRECTION = `Each stockSearches entry is {query,kind,sceneId,purpose}. sceneId identifies the supplied scene needing a visual; purpose says what that picture helps the viewer understand beyond the current source. Reuse a query for multiple scenes when useful. These are retrieval purposes, not shot quotas. A fixed frame, texture or transition finishes the picture but does not demonstrate the topic.`;
export const EDITORIAL_STOCK_REFINEMENT_DIRECTION = `Stock candidates retain their search queries and scene-specific purposes in stockCandidates. Evaluate each candidate against that actual job and its visible thumbnail; availability alone is not a reason to insert it. Keep relevant original demonstrations visible. Prefer a still if it communicates the point without needing an unobserved video event. A thumbnail establishes appearance only, not motion or when an event happens. For a new stock video without verifiedSourceRanges, choose sourceIn:0 explicitly only as a generic illustration; never invent a nonzero source offset, gesture, reveal or demonstration from a poster. Nonzero sourceIn is allowed only when the entire selected interval fits a supplied verifiedSourceRange. Use current timeline speech/scene cues to time the insert's entrance and exit; sourceIn is a different source-media clock. Never claim these illustrative clips prove source assertions. Keep a useful fallback edit when no candidate serves the purpose. Unavailable assets or unverified offsets are omitted from execution and leave their content need unresolved, without another model call.`;
