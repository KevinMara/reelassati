import type { Asset, EditProject } from "@contracts/workspace";
import { normalizeReview } from "@contracts/source-review";
import { mapChatTranscript } from "./editor-chat-execution";
import { captionOwner } from "@contracts/caption-ownership";
import {
  normalizeSavedAnalyzerReports,
  type SavedAnalyzerReport,
} from "@contracts/analyzer-report";
import { normalizeVideoStructure } from "@contracts/video-analysis";

/** Captions on another source are not evidence that this source was transcribed.
 * Linked picture/sound share a speech clock; do not buy it twice. */
export function autonomousTranscriptTargets(
  project: EditProject,
  asset: Asset
) {
  const review = project.sourceReviews?.find(r => r.assetId === asset.id);
  if (review?.captions === "present" || review?.audio === "absent") return [];
  return project.clips.filter(
    clip =>
      clip.assetId === asset.id &&
      !clip.muted &&
      !clip.graphic &&
      !clip.transitionHandle &&
      !project.clips.some(
        peer =>
          peer.linkId &&
          peer.linkId === clip.linkId &&
          project.sourceReviews?.some(
            r => r.assetId === peer.assetId && r.captions === "present"
          )
      ) &&
      !project.transcript.some(segment => {
        const owner = captionOwner(project, segment);
        return (
          owner?.id === clip.id ||
          Boolean(owner?.linkId && owner.linkId === clip.linkId)
        );
      })
  );
}

type Review = Pick<
  Awaited<ReturnType<typeof import("./analyze-media").analyzeMedia>>,
  "summary" | "review" | "retention"
> &
  Partial<
    Pick<
      Awaited<ReturnType<typeof import("./analyze-media").analyzeMedia>>,
      "insights"
    >
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

/** Reuse only a complete review of this immutable owned source and platform.
 * A saved note never authorizes inference, creates evidence, or changes billing. */
export function findSavedAutonomousReview(
  asset: Asset,
  platform: EditProject["platform"],
  reports: SavedAnalyzerReport[] | undefined
): Review | undefined {
  if (asset.kind !== "video" || !asset.duration) return;
  const candidates = reports
    ?.slice(0, 6)
    .filter(
      candidate =>
        candidate?.assetId === asset.id &&
        candidate.platform === platform &&
        Math.abs(candidate.duration - asset.duration!) <= 0.001
    );
  const report = normalizeSavedAnalyzerReports(candidates).find(
    candidate =>
      candidate.result.review &&
      normalizeVideoStructure(
        candidate.result.structure,
        candidate.result.insights
      ).length === 5
  );
  if (!report) return;
  const review = normalizeReview(report.result.review, asset.duration);
  return {
    summary: report.result.summary,
    review,
    insights: structuredClone(report.result.insights),
    retention: report.result.insights.map(interval => ({
      start: interval.start,
      end: interval.end,
      score: interval.attention!,
      note: interval.rationale,
    })),
  };
}

/** A failed later step must not repurchase completed source preparation.
 * This cache lives only in the open editor, and is scoped to its exact inputs. */
export async function prepareAutonomousSources(input: {
  project: EditProject;
  sources: Asset[];
  captions: boolean;
  context: string;
  savedReports?: SavedAnalyzerReport[];
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
    observations: NonNullable<Review["insights"]>;
  }> = [];
  const keys = new Map<string, string>();
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
    keys.set(asset.id, key);
    if (asset.kind === "video") {
      const result =
        input.cache.reviews.get(key) ??
        findSavedAutonomousReview(
          asset,
          input.project.platform,
          input.savedReports
        ) ??
        (await input.review(asset));
      input.checkpoint();
      input.cache.reviews.set(key, result);
      working.sourceReviews = [
        ...(working.sourceReviews ?? []).filter(r => r.assetId !== asset.id),
        {
          assetId: asset.id,
          reviewedAt: new Date().toISOString(),
          summary: result.summary,
          ...normalizeReview(result.review),
          moments: result.insights?.length
            ? result.insights.map(interval => ({
                start: interval.start,
                end: interval.end,
                note: [
                  interval.visualEvidence &&
                    `Observed picture: ${interval.visualEvidence}`,
                  interval.audioEvidence &&
                    `Observed audio: ${interval.audioEvidence}`,
                  `Editorial interpretation (${interval.role}): ${interval.rationale}`,
                ]
                  .filter(Boolean)
                  .join("\n"),
              }))
            : result.retention,
        },
      ];
      analysis.push({
        assetId: asset.id,
        summary: result.summary,
        intervals: result.retention,
        observations: result.insights ?? [],
      });
    }
  }
  // Review every picture source before deciding which speech clocks are needed.
  // Library order must not make linked sound buy duplicate burned-in captions.
  for (const asset of input.sources) {
    input.checkpoint();
    const key = keys.get(asset.id)!;
    const review = working.sourceReviews?.find(r => r.assetId === asset.id);
    if (
      input.captions &&
      autonomousTranscriptTargets(working, asset).length > 0 &&
      review?.captions !== "present" &&
      review?.audio !== "absent"
    ) {
      const result =
        input.cache.transcripts.get(key) ?? (await input.transcribe(asset));
      input.checkpoint();
      input.cache.transcripts.set(key, result);
      if (result.provenance) working.transcriptProvenance = result.provenance;
      working.transcript.push(
        ...mapChatTranscript(
          { ...working, clips: autonomousTranscriptTargets(working, asset) },
          asset.id,
          result.segments
        )
      );
    }
  }
  input.checkpoint();
  return { working, analysis };
}
