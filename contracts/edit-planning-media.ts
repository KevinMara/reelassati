import type { Asset, EditProject } from "./workspace";
import { sourceReviewFacts } from "./source-review";

/** The caller supplies only the authenticated brand's workspace. Asset names
 * identify files; only saved observations establish their contents. No private
 * download URLs, provenance tokens or unrelated project text enter the prompt. */
export function editPlanningMedia(
  assets: Asset[],
  projects: Pick<EditProject, "sourceReviews">[]
) {
  const reviews = new Map<
    string,
    NonNullable<EditProject["sourceReviews"]>[number]
  >();
  for (const project of projects) {
    for (const review of project.sourceReviews ?? []) {
      const previous = reviews.get(review.assetId);
      if (
        !previous ||
        Date.parse(review.reviewedAt) > Date.parse(previous.reviewedAt)
      )
        reviews.set(review.assetId, review);
    }
  }
  return assets
    .filter(
      asset =>
        asset.status === "ready" &&
        ["video", "image", "audio", "export"].includes(asset.kind)
    )
    .map(({ id, name, kind, duration, width, height }) => ({
      assetId: id,
      name,
      kind,
      duration,
      width,
      height,
      ...(reviews.has(id)
        ? { evidence: sourceReviewFacts(reviews.get(id)!) }
        : {}),
    }));
}
