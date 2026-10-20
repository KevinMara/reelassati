import type { Asset, EditProject } from "@contracts/workspace";
import { normalizeReview } from "@contracts/source-review";
import { mapChatTranscript } from "./editor-chat-execution";

type Review = Pick<
  Awaited<ReturnType<typeof import("./analyze-media").analyzeMedia>>,
  "summary" | "review" | "retention"
>;
type Transcript = Awaited<
  ReturnType<typeof import("./transcribe-media").transcribeMedia>
>;
export type AutonomousPreparationCache = {
  reviews: Map<string, Review>;
  transcripts: Map<string, Transcript>;
};
export function createAutonomousPreparationCache(): AutonomousPreparationCache {
  return { reviews: new Map(), transcripts: new Map() };
}

/** A failed later step must not repurchase completed source preparation.
 * This cache lives only in the open editor, and is scoped to its exact inputs. */
export async function prepareAutonomousSources(input: {
  project: EditProject;
  sources: Asset[];
  captions: boolean;
  context: string;
  cache: AutonomousPreparationCache;
  checkpoint: () => void;
  review: (asset: Asset) => Promise<Review>;
  transcribe: (asset: Asset) => Promise<Transcript>;
}) {
  const working = structuredClone(input.project);
  const analysis: Array<{
    assetId: string;
    summary: string;
    intervals: Review["retention"];
  }> = [];
  for (const asset of input.sources) {
    input.checkpoint();
    const key = JSON.stringify([
      input.context,
      asset.id,
      asset.size,
      asset.duration,
      asset.contentType,
      input.project.platform,
    ]);
    if (asset.kind === "video") {
      const result =
        input.cache.reviews.get(key) ?? (await input.review(asset));
      input.checkpoint();
      input.cache.reviews.set(key, result);
      working.sourceReviews = [
        ...(working.sourceReviews ?? []).filter(r => r.assetId !== asset.id),
        {
          assetId: asset.id,
          reviewedAt: new Date().toISOString(),
          summary: result.summary,
          ...normalizeReview(result.review),
          moments: result.retention,
        },
      ];
      analysis.push({
        assetId: asset.id,
        summary: result.summary,
        intervals: result.retention,
      });
    }
    const review = working.sourceReviews?.find(r => r.assetId === asset.id);
    if (
      input.captions &&
      !input.project.transcript.length &&
      review?.captions !== "present" &&
      review?.audio !== "absent"
    ) {
      const result =
        input.cache.transcripts.get(key) ?? (await input.transcribe(asset));
      input.checkpoint();
      input.cache.transcripts.set(key, result);
      if (result.provenance) working.transcriptProvenance = result.provenance;
      working.transcript.push(
        ...mapChatTranscript(input.project, asset.id, result.segments)
      );
    }
  }
  input.checkpoint();
  return { working, analysis };
}
