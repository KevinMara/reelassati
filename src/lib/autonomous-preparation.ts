import type { Asset, EditProject } from "@contracts/workspace";
import {
  normalizeReview,
  normalizeSourceObservations,
  sourceReviewFacts,
  type SourceObservation,
} from "@contracts/source-review";
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
  > & { savedAt?: string };
type Transcript = {
  transcript: string;
  segments: EditProject["transcript"];
  provenance?: import("@contracts/compliance").ContentProvenance;
};
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
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
    savedAt: report.createdAt,
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
  speechTiming?: boolean;
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
    observations: SourceObservation[];
    visualProtection: ReturnType<typeof normalizeReview>["visualProtection"];
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
      const cached = input.cache.reviews.get(key);
      const saved = findSavedAutonomousReview(
        asset,
        input.project.platform,
        input.savedReports
      );
      // A newly saved review can upgrade evidence while this editor stays open.
      // Legacy/spatially-unknown reviews still reuse normally: never buy an
      // analysis merely to satisfy the optional graphic-placement guard.
      const preferSaved =
        saved &&
        (!cached ||
          (saved.savedAt &&
            (!cached.savedAt || saved.savedAt > cached.savedAt)));
      const result =
        (preferSaved ? saved : (cached ?? saved)) ??
        (await input.review(asset));
      input.checkpoint();
      input.cache.reviews.set(key, {
        ...result,
        savedAt: result.savedAt ?? new Date().toISOString(),
      });
      const observed = normalizeSourceObservations(
        result.insights,
        asset.duration
      );
      const review = sourceReviewFacts({
        assetId: asset.id,
        reviewedAt: new Date().toISOString(),
        summary: "",
        ...normalizeReview(result.review, asset.duration),
        observations: observed,
        moments: [],
      });
      working.sourceReviews = [
        ...(working.sourceReviews ?? []).filter(r => r.assetId !== asset.id),
        review,
      ];
      analysis.push({
        assetId: asset.id,
        observations: observed,
        visualProtection: normalizeReview(review, asset.duration)
          .visualProtection,
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
      (input.speechTiming || input.captions) &&
      (input.speechTiming
        ? working.clips.some(
            c => c.assetId === asset.id && !c.muted && !c.graphic
          )
        : autonomousTranscriptTargets(working, asset).length > 0) &&
      review?.audio !== "absent"
    ) {
      const result =
        input.cache.transcripts.get(key) ??
        (working.sourceSpeech?.find(s => s.assetId === asset.id)?.segments
          .length
          ? {
              segments: working.sourceSpeech.find(s => s.assetId === asset.id)!
                .segments,
              transcript: "",
              provenance: working.sourceSpeech.find(s => s.assetId === asset.id)
                ?.provenance,
            }
          : await input.transcribe(asset));
      input.checkpoint();
      input.cache.transcripts.set(key, result);
      working.sourceSpeech = [
        ...(working.sourceSpeech ?? []).filter(s => s.assetId !== asset.id),
        {
          assetId: asset.id,
          segments: result.segments,
          provenance: result.provenance,
        },
      ];
      if (!input.captions || review?.captions === "present") continue;
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
