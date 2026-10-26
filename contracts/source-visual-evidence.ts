/** Model observations in the ORIGINAL source frame and source-media seconds.
 * A region is the conservative union of its object's bounds throughout its
 * interval, not a sampled midpoint. This is evidence, never pixel verification. */
export interface SourceVisualEvidence {
  version: 1;
  sourceDuration: number | null;
  coverage: "unknown" | "partial" | "complete";
  reviewedRanges: Array<{ start: number; end: number }>;
  regions: Array<{
    id: string;
    start: number;
    end: number;
    kind: "text" | "face" | "demonstration";
    rect: { x: number; y: number; width: number; height: number };
    confidence: number;
  }>;
  observedText: Array<{
    id: string;
    start: number;
    end: number;
    text: string;
    confidence: number;
    regionId?: string;
  }>;
}

export function unknownSourceVisualEvidence(): SourceVisualEvidence {
  return {
    version: 1,
    sourceDuration: null,
    coverage: "unknown",
    reviewedRanges: [],
    regions: [],
    observedText: [],
  };
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const confidence = (value: unknown): value is number =>
  finite(value) && value >= 0 && value <= 1;

/** Legacy reports remain useful but cannot acquire spatial coverage merely by
 * being loaded again. Malformed/dropped regions invalidate any clear-area claim. */
export function normalizeSourceVisualEvidence(
  value: unknown,
  duration?: number
): SourceVisualEvidence {
  const row = record(value);
  if (row.version !== 1) return unknownSourceVisualEvidence();
  const sourceDuration =
    finite(row.sourceDuration) && row.sourceDuration > 0
      ? row.sourceDuration
      : null;
  if (
    !sourceDuration ||
    (duration !== undefined &&
      (!finite(duration) || Math.abs(duration - sourceDuration) > 0.001))
  )
    return unknownSourceVisualEvidence();
  let validCoverage =
    Array.isArray(row.reviewedRanges) &&
    Array.isArray(row.regions) &&
    row.reviewedRanges.length <= 180 &&
    row.regions.length <= 120;
  const interval = (item: Record<string, unknown>) =>
    finite(item.start) &&
    finite(item.end) &&
    item.start >= 0 &&
    item.end > item.start &&
    item.end <= sourceDuration + 0.000001;
  const reviewedRanges = (
    Array.isArray(row.reviewedRanges) ? row.reviewedRanges.slice(0, 180) : []
  )
    .flatMap(value => {
      const item = record(value);
      if (!interval(item)) {
        validCoverage = false;
        return [];
      }
      return [{ start: item.start as number, end: item.end as number }];
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const ids = new Set<string>();
  const regions: SourceVisualEvidence["regions"] = (
    Array.isArray(row.regions) ? row.regions.slice(0, 120) : []
  ).flatMap(value => {
    const item = record(value),
      rect = record(item.rect);
    if (
      !interval(item) ||
      typeof item.id !== "string" ||
      !item.id.trim() ||
      item.id.length > 80 ||
      ids.has(item.id) ||
      !["text", "face", "demonstration"].includes(String(item.kind)) ||
      !confidence(item.confidence) ||
      !finite(rect.x) ||
      !finite(rect.y) ||
      !finite(rect.width) ||
      !finite(rect.height) ||
      rect.x < 0 ||
      rect.y < 0 ||
      rect.width <= 0 ||
      rect.height <= 0 ||
      rect.x + rect.width > 1.000001 ||
      rect.y + rect.height > 1.000001
    ) {
      validCoverage = false;
      return [];
    }
    ids.add(item.id);
    return [
      {
        id: item.id,
        start: item.start as number,
        end: item.end as number,
        kind: item.kind as SourceVisualEvidence["regions"][number]["kind"],
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        confidence: item.confidence,
      },
    ];
  });
  const textIds = new Set<string>();
  const observedText: SourceVisualEvidence["observedText"] = (
    Array.isArray(row.observedText) ? row.observedText.slice(0, 180) : []
  ).flatMap(value => {
    const item = record(value);
    if (
      !interval(item) ||
      typeof item.id !== "string" ||
      !item.id.trim() ||
      item.id.length > 80 ||
      textIds.has(item.id) ||
      typeof item.text !== "string" ||
      !item.text.trim() ||
      item.text.length > 1000 ||
      !confidence(item.confidence)
    )
      return [];
    textIds.add(item.id);
    return [
      {
        id: item.id,
        start: item.start as number,
        end: item.end as number,
        text: item.text.trim(),
        confidence: item.confidence,
        ...(typeof item.regionId === "string" && ids.has(item.regionId)
          ? { regionId: item.regionId }
          : {}),
      },
    ];
  });
  let through = 0;
  for (const range of reviewedRanges) {
    if (range.start > through + 0.000001) break;
    through = Math.max(through, range.end);
  }
  const coverage =
    !validCoverage || !reviewedRanges.length || row.coverage === "unknown"
      ? "unknown"
      : row.coverage === "complete" && through >= sourceDuration - 0.000001
        ? "complete"
        : row.coverage === "complete" || row.coverage === "partial"
          ? "partial"
          : "unknown";
  return {
    version: 1,
    sourceDuration,
    coverage,
    reviewedRanges,
    regions,
    observedText,
  };
}

export const SOURCE_VISUAL_EVIDENCE_GUIDANCE = `
Return review.visualProtection version 1 with sourceDuration equal to the supplied source duration.
Record exact readable on-screen text separately in observedText {id,start,end,text,confidence,regionId:null|string}.
Text is what the source visibly contains, never a correction, interpretation, missing range, fact check or proposed addition.
Protect existing text/captions, faces and meaningful demonstrations/products/props with regions {id,start,end,kind:text|face|demonstration,rect:{x,y,width,height},confidence}.
All times use SOURCE seconds. Rect coordinates use 0..1 of the ORIGINAL source frame (origin top left), not a crop or output canvas.
Each rectangle conservatively encloses the object throughout its full interval; split moving objects into shorter intervals or enlarge the union. Include readable physical labels as text regions and their exact observedText.
reviewedRanges contains only intervals where you established the protected areas across the interval. coverage is complete only if this covers the entire source; use partial for limited spatial coverage and unknown when bounds/motion cannot be established.
Never interpret an empty regions array as verified clear footage without established coverage. Sparse sampled frames cannot establish clear areas between samples; retain known conservative regions/text but leave uncovered ranges unreviewed.
Use no invented positions or text. Unreadable text and unseen areas remain unknown. These model observations are not pixel tracking or rendered validation.
`.trim();

export function sourceVisualEvidenceSchema(duration: number) {
  const object = (properties: Record<string, unknown>) => ({
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  });
  const time = { type: "number", minimum: 0, maximum: duration };
  const confidence = { type: "number", minimum: 0, maximum: 1 };
  const string = { type: "string" };
  const coordinate = { type: "number", minimum: 0, maximum: 1 };
  return object({
    version: { type: "integer", minimum: 1, maximum: 1 },
    sourceDuration: { type: "number", minimum: duration, maximum: duration },
    coverage: { type: "string", enum: ["unknown", "partial", "complete"] },
    reviewedRanges: {
      type: "array",
      maxItems: 180,
      items: object({ start: time, end: time }),
    },
    regions: {
      type: "array",
      maxItems: 120,
      items: object({
        id: string,
        start: time,
        end: time,
        kind: { type: "string", enum: ["text", "face", "demonstration"] },
        rect: object({
          x: coordinate,
          y: coordinate,
          width: coordinate,
          height: coordinate,
        }),
        confidence,
      }),
    },
    observedText: {
      type: "array",
      maxItems: 180,
      items: object({
        id: string,
        start: time,
        end: time,
        text: string,
        confidence,
        regionId: { type: ["string", "null"] },
      }),
    },
  });
}
