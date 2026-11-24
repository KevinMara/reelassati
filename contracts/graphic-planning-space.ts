import type { Asset, EditProject } from "./workspace";
import { effectiveTimelineClips } from "./timeline-mixer";
import { protectedSourceBounds } from "./automatic-graphic-protection";
import { normalizeSourceVisualEvidence } from "./source-visual-evidence";
import { graphicLayoutSpace } from "./graphic-layout-space";

type Interval = { start: number; end: number };
const noCheckpoint = () => {};

/** Project source observations through the same fit/crop/motion math as preflight.
 * These are composition samples, never permission to skip full-frame validation. */
export function projectedSourceRegions(
  project: EditProject,
  assets: Asset[],
  checkpoint: () => void = noCheckpoint
) {
  if (typeof project.aspectRatio !== "string") return [];
  const [width, height] = project.aspectRatio.split(":").map(Number);
  if (!(width > 0 && height > 0)) return [];
  const canvas = { width: 1000, height: (1000 * height) / width };
  const byAsset = new Map(assets.map(asset => [asset.id, asset]));
  return effectiveTimelineClips(project).flatMap(clip => {
    checkpoint();
    if (
      clip.hidden ||
      clip.graphic ||
      clip.track === "audio" ||
      clip.track === "captions"
    )
      return [];
    const asset = byAsset.get(clip.assetId ?? "");
    if (!asset?.width || !asset.height) return [];
    const evidence = normalizeSourceVisualEvidence(
      project.sourceReviews?.find(item => item.assetId === clip.assetId)
        ?.visualProtection,
      asset.duration
    );
    return evidence.regions.flatMap(region => {
      const speed = clip.speed ?? 1;
      if (!(speed > 0)) return [];
      const start = Math.max(
        clip.start,
        clip.start + (region.start - clip.inPoint) / speed
      );
      const end = Math.min(
        clip.start + clip.duration,
        clip.start + (region.end - clip.inPoint) / speed
      );
      if (end <= start) return [];
      const times = [start, (start + end) / 2, Math.max(start, end - 0.001)];
      return [
        {
          sourceClipId: clip.id,
          assetId: asset.id,
          regionId: region.id,
          kind: region.kind,
          start,
          end,
          sourceRect: region.rect,
          samples: times.map(time => {
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
          }),
        },
      ];
    });
  });
}

function covers(ranges: Interval[], start: number, end: number) {
  let through = start;
  for (const range of ranges) {
    if (range.end <= through) continue;
    if (range.start > through + 0.000001) return false;
    through = Math.max(through, range.end);
    if (through >= end - 0.000001) return true;
  }
  return false;
}

/** Give the first planning call measurable composition options. Unknown picture
 * coverage never becomes a whole-frame "clear" rectangle. This is the CURRENT
 * composition: newly proposed reframes/graphics require recomputation/preflight. */
export function graphicPlanningSpace(
  project: EditProject,
  assets: Asset[],
  intervals: Array<Interval & { id: string }>
) {
  const projected = projectedSourceRegions(project, assets);
  const byAsset = new Map(assets.map(asset => [asset.id, asset]));
  const footage = effectiveTimelineClips(project).filter(
    clip =>
      !clip.hidden &&
      !clip.graphic &&
      !clip.transitionHandle &&
      clip.track !== "audio" &&
      clip.track !== "captions"
  );
  return intervals.map(interval => {
    const movingLayout = project.clips.some(clip => {
      const native = clip.shotTransition?.native;
      return (
        native &&
        !clip.hidden &&
        clip.start - native.duration / 2 < interval.end &&
        clip.start + native.duration / 2 > interval.start
      );
    });
    const visible = footage.filter(
      clip =>
        clip.start < interval.end && clip.start + clip.duration > interval.start
    );
    const timelineCovered = covers(
      visible
        .map(clip => ({ start: clip.start, end: clip.start + clip.duration }))
        .sort((a, b) => a.start - b.start),
      interval.start,
      interval.end
    );
    const known =
      !movingLayout &&
      interval.end > interval.start &&
      timelineCovered &&
      visible.length > 0 &&
      visible.every(clip => {
        const asset = byAsset.get(clip.assetId ?? "");
        if (
          !asset?.width ||
          !asset.height ||
          !Number.isFinite(clip.speed ?? 1) ||
          (clip.speed ?? 1) <= 0
        )
          return false;
        const evidence = normalizeSourceVisualEvidence(
          project.sourceReviews?.find(item => item.assetId === clip.assetId)
            ?.visualProtection,
          asset.duration
        );
        const start =
          clip.inPoint +
          (Math.max(interval.start, clip.start) - clip.start) *
            (clip.speed ?? 1);
        const end =
          clip.inPoint +
          (Math.min(interval.end, clip.start + clip.duration) - clip.start) *
            (clip.speed ?? 1);
        return (
          evidence.coverage !== "unknown" &&
          covers(evidence.reviewedRanges, start, end)
        );
      });
    const regions = projected.filter(
      region => region.start < interval.end && region.end > interval.start
    );
    const measured =
      known &&
      regions.every(region =>
        region.samples.every(sample => sample.canvasPercent)
      );
    return {
      sceneId: interval.id,
      start: interval.start,
      end: interval.end,
      coverage: measured ? ("observed" as const) : ("unknown" as const),
      layoutCandidates: measured
        ? graphicLayoutSpace(
            regions.flatMap(region =>
              region.samples.flatMap(sample =>
                sample.canvasPercent ? [sample.canvasPercent] : []
              )
            )
          )
        : [],
    };
  });
}

export const GRAPHIC_PLANNING_SPACE_DIRECTION = `graphicLayout supplies candidate rectangles in canvas percentages for the current composition, with 2% clearance from projected source faces, text and demonstrations. Choose a useful visual explanation and fit its entire painted extent into a candidate before proposing it. For related comparison beats, prefer a common area and consistent alignment, not three different placements. These boundary/midpoint samples guide composition; they do not certify every frame, account for new reframes, or reserve space around new graphics/captions. coverage=unknown supplies no clear-space claim. Preserve all existing source evidence and run the full graphic checks after composing the plan. If no useful readable graphic fits, choose a different source-supported treatment or explain the unresolved objective in chat; do not count color or sound as delivering a requested graphic.`;
