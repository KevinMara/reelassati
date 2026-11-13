import type {
  Asset,
  EditProject,
  TimelineClip,
  TranscriptSegment,
} from "./workspace";
import { visualFrame } from "./clip-visual";
import {
  graphicFrame,
  normalizeGraphic,
  type MotionGraphic,
} from "./motion-graphics";
import { graphicShapes, graphicShapePixels } from "./graphic-layout";
import { graphicSelectionBounds } from "./graphic-selection";
import { effectiveTimelineClips } from "./timeline-mixer";
import { normalizeSourceVisualEvidence } from "./source-visual-evidence";
import { sourcePointToCanvas } from "./source-canvas-point";
import {
  captionLineWidth,
  getCaptionPreset,
  type CaptionPreset,
} from "./editor-presets";
import { captionMotion, captionRuns } from "./caption-runs";
import { captionMotionFrame } from "./caption-motion";
import { normalizeTranscriptWords } from "./transcript-timing";

export type AutomaticGraphicIntent = "automatic" | "requested" | "replace";
export type AutomaticGraphicPolicy =
  AutomaticGraphicIntent | { request: string };
export type GraphicProtectionReason =
  | "source-overlap"
  | "unknown-source-layout"
  | "repeated-source-text"
  | "competing-text"
  | "reading-time"
  | "unsupported-source-copy";
export interface GraphicProtectionIssue {
  reason: GraphicProtectionReason;
  detail: string;
  uncertain?: boolean;
}
type Rect = { x: number; y: number; width: number; height: number };
type Point = [number, number];
type PaintArea = Rect & { polygon?: Point[] };
const intersection = (a: Rect, b: Rect): Rect | undefined => {
  const x = Math.max(a.x, b.x),
    y = Math.max(a.y, b.y),
    right = Math.min(a.x + a.width, b.x + b.width),
    bottom = Math.min(a.y + a.height, b.y + b.height);
  return right > x + 0.00001 && bottom > y + 0.00001
    ? { x, y, width: right - x, height: bottom - y }
    : undefined;
};
const corners = (rect: Rect): Point[] => [
  [rect.x, rect.y],
  [rect.x + rect.width, rect.y],
  [rect.x + rect.width, rect.y + rect.height],
  [rect.x, rect.y + rect.height],
];
/** Broad bounds reject distant shapes; actual polygon edges preserve the empty
 * interior of rotated outlines. Text retains its conservative layout envelope. */
function paintIntersects(a: PaintArea, b: PaintArea): boolean {
  if (!intersection(a, b)) return false;
  if (!a.polygon && !b.polygon) return true;
  const first = a.polygon ?? corners(a),
    second = b.polygon ?? corners(b);
  const cross = (a: Point, b: Point, c: Point) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const onSegment = (a: Point, b: Point, p: Point) =>
    Math.abs(cross(a, b, p)) <= 1e-7 &&
    p[0] >= Math.min(a[0], b[0]) - 1e-7 &&
    p[0] <= Math.max(a[0], b[0]) + 1e-7 &&
    p[1] >= Math.min(a[1], b[1]) - 1e-7 &&
    p[1] <= Math.max(a[1], b[1]) + 1e-7;
  const inside = (point: Point, polygon: Point[]) => {
    let contained = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i],
        b = polygon[j];
      if (onSegment(a, b, point)) return true;
      if (
        a[1] > point[1] !== b[1] > point[1] &&
        point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        contained = !contained;
    }
    return contained;
  };
  if (first.some(p => inside(p, second)) || second.some(p => inside(p, first)))
    return true;
  return first.some((a, i) => {
    const b = first[(i + 1) % first.length];
    return second.some((c, j) => {
      const d = second[(j + 1) % second.length];
      const abC = cross(a, b, c),
        abD = cross(a, b, d),
        cdA = cross(c, d, a),
        cdB = cross(c, d, b);
      return (
        (abC * abD < 0 && cdA * cdB < 0) ||
        onSegment(a, b, c) ||
        onSegment(a, b, d) ||
        onSegment(c, d, a) ||
        onSegment(c, d, b)
      );
    });
  });
}
const copyKey = (text: string) =>
  (
    text
      .normalize("NFKC")
      .toLocaleLowerCase("en")
      .replace(/[–—−]/gu, "-")
      .match(/[\p{L}\p{M}]+|\p{N}+(?:[.,]\p{N}+)*|[%+-]/gu) ?? []
  ).join(" ");

function timedSpeechPhrases(
  segments: readonly TranscriptSegment[],
  start: number,
  end: number,
  retained: { start: number; end: number }
) {
  const phrases = segments
    .flatMap(segment => {
      if (segment.start >= end || segment.end <= start) return [];
      const words = normalizeTranscriptWords(
        segment.text,
        segment.words
      )?.filter(
        // An overlay may enter or leave during a spoken word. Its visual
        // window does not trim the source audio: overlapping measured words
        // still support exact copy. Actual source trims remain hard limits.
        word =>
          word.start < end - 0.000001 &&
          word.end > start + 0.000001 &&
          word.start >= retained.start - 0.000001 &&
          word.end <= retained.end + 0.000001
      );
      if (words)
        return words.length
          ? [
              {
                start: words[0].start,
                end: words.at(-1)!.end,
                text: words.map(word => word.text).join(" "),
              },
            ]
          : [];
      // Without word clocks a partially intersecting phrase cannot prove which
      // words occur inside the proposed graphic interval.
      return segment.start >= start - 0.000001 && segment.end <= end + 0.000001
        ? [segment]
        : [];
    })
    .sort((a, b) => a.start - b.start);
  const joined: Array<{ start: number; end: number; text: string }> = [];
  for (const phrase of phrases) {
    const previous = joined.at(-1);
    if (
      previous &&
      phrase.start >= previous.end - 0.000001 &&
      phrase.start - previous.end <= 0.15
    ) {
      previous.text += ` ${phrase.text}`;
      previous.end = phrase.end;
    } else
      joined.push({ start: phrase.start, end: phrase.end, text: phrase.text });
  }
  return [
    ...phrases.map(phrase => phrase.text),
    ...joined.map(phrase => phrase.text),
  ];
}

/** Only the human's actual request belongs here, never the generated planner
 * command, source text, prior analyzer suggestions or a generic reference style.
 * Unsupported language remains automatic; the UI can pass an explicit intent. */
export function automaticGraphicIntent(
  request: string,
  candidate?: MotionGraphic
): AutomaticGraphicIntent {
  const text = request
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en");
  const names: Partial<Record<MotionGraphic["kind"], RegExp>> = {
    arrow:
      /\b(?:arrow|arrows|frecci[ae]|fleche|fleches|flecha|flechas|pfeil|pfeile)\b/u,
    highlight:
      /\b(?:highlight|outline|evidenziazione|riquadro|surlignage|resaltado|marco|hervorhebung)\b/u,
    rectangle:
      /\b(?:rectangle|rectangular|rettangolo|riquadro|rectangulo|rechteck|outline|frame)\b/u,
    ellipse: /\b(?:circle|ellipse|cerchio|ellisse|cercle|circulo|kreis)\b/u,
    star: /\b(?:star|stella|etoile|estrella|stern)\b/u,
    line: /\b(?:line|linea|ligne|linie)\b/u,
    counter: /\b(?:counter|count|contatore|compteur|contador|zahler)\b/u,
    countdown:
      /\b(?:countdown|count down|conto alla rovescia|compte a rebours|cuenta atras)\b/u,
    callout:
      /\b(?:title|titles|text|label|labels|callout|titolo|titoli|testo|etichett[ae]|titre|titres|texte|etiquette|titulo|titulos|texto|etiqueta|titel|beschriftung)\b/u,
    text: /\b(?:title|titles|text|titolo|titoli|testo|titre|titres|texte|titulo|titulos|texto|titel)\b/u,
  };
  const general =
    /\b(?:overlay|graphic|graphics|grafic[aohe]+|graphique|grafico|grafik)\b/u;
  const graphic = candidate
    ? (names[candidate.kind === "spatial-title" ? "text" : candidate.kind] ??
      general)
    : new RegExp(
        `${Object.values(names)
          .map(pattern => pattern.source)
          .join("|")}|${general.source}`,
        "u"
      );
  const actions =
    /\b(?:add|insert|put|place|create|show|write|replace|cover|hide|aggiungi|inserisci|metti|posiziona|crea|mostra|scrivi|sostituisci|copri|nascondi|ajoute|ajoutez|insere|ecris|remplace|anade|agrega|inserta|pon|escribe|reemplaza|fuge|hinzufugen|erstelle|schreibe|ersetze|adicione|insira)\b/u;
  const sentences = text
    .split(/[.!?;\n]/u)
    .filter(
      part =>
        actions.test(part) &&
        graphic.test(part) &&
        !/\b(?:no|not|never|without|avoid|non|senza|evita|nessun[ao]|pas|sans|sin|nunca|kein|keine|ohne|nao)\b/u.test(
          part
        )
    );
  if (!sentences.length) return "automatic";
  if (candidate) {
    const suppliedCopy = [
      ...request.matchAll(/["“«]([^"”»]+)["”»]|(?:^|\s)'([^']+)'/gu),
    ].map(match => copyKey(match[1] ?? match[2]));
    const textKinds = [
      "text",
      "callout",
      "spatial-title",
      "counter",
      "countdown",
    ];
    const displayed = [
      textKinds.includes(candidate.kind) ? candidate.text : "",
      candidate.secondaryText ?? "",
    ]
      .map(copyKey)
      .filter(Boolean);
    // Exact human-supplied wording scopes the exception. Asking for the title
    // “Workshop” cannot authorize a different same-kind claim or extra subtitle.
    if (
      suppliedCopy.length &&
      displayed.some(copy => !suppliedCopy.includes(copy))
    )
      return "automatic";
  }
  // An explicit replacement/cover instruction is materially different from
  // merely asking for a title, or supplying a style containing overlays.
  if (
    sentences.some(
      part =>
        /\b(?:replace|cover|hide|sostituisci|copri|nascondi|remplace|reemplaza|ersetze)\b/u.test(
          part
        ) &&
        /\b(?:original|existing|source|originale|originali|esistente|esistenti|sorgente|existant|existente|vorhandene)\b/u.test(
          part
        )
    )
  )
    return "replace";
  return "requested";
}

/** Raw requests scope exceptions per kind; requesting an arrow cannot authorize
 * unrelated commentary. Named source text scopes a replacement to its region. */
export function graphicRequestScope(
  project: EditProject,
  graphic: MotionGraphic,
  policy: AutomaticGraphicPolicy
) {
  const intent =
    typeof policy === "string"
      ? policy
      : automaticGraphicIntent(policy.request, graphic);
  const replacementRegions =
    typeof policy !== "string" && intent === "replace"
      ? new Set(
          project.sourceReviews?.flatMap(review =>
            (review.visualProtection?.observedText ?? [])
              .filter(
                text =>
                  text.regionId &&
                  ` ${copyKey(policy.request)} `.includes(
                    ` ${copyKey(text.text)} `
                  )
              )
              .map(text => `${review.assetId}:${text.regionId}`)
          ) ?? []
        )
      : undefined;
  return { intent, replacementRegions };
}

function graphicPaintBounds(
  clip: TimelineClip,
  time: number,
  canvas: { width: number; height: number }
): PaintArea[] {
  const g = normalizeGraphic(clip.graphic)!;
  const whole = graphicSelectionBounds(clip, time, canvas.width, canvas.height);
  if (!whole) return [];
  if (
    g.secondaryText ||
    !["rectangle", "highlight", "line", "ellipse", "star"].includes(g.kind)
  )
    return [whole];
  const elapsed = clip.inPoint + (time - clip.start) * (clip.speed ?? 1);
  const duration = clip.graphicDuration ?? clip.outPoint;
  const frame = graphicFrame(g, elapsed, duration);
  const shapes = graphicShapes(
    g,
    elapsed,
    duration,
    canvas.height / canvas.width
  ).map(shape => shape.points);
  return shapes.map(shape => {
    const points = graphicShapePixels(
      shape,
      frame,
      canvas.width,
      canvas.height
    );
    const x = Math.min(...points.map(point => point[0])),
      y = Math.min(...points.map(point => point[1]));
    return {
      x,
      y,
      width: Math.max(...points.map(point => point[0])) - x,
      height: Math.max(...points.map(point => point[1])) - y,
      polygon: points,
    };
  });
}

/** Match CaptionLayer's stacked blocks and the same per-unit motion frame used
 * by ASS. Blur/glow expand the envelope, rather than inventing clear space. */
function motionCaptionBounds(
  segments: readonly TranscriptSegment[],
  preset: CaptionPreset,
  time: number,
  frameRate: number,
  canvas: { width: number; height: number }
): Rect[] {
  const blocks = segments.map(segment => {
    const frame = captionMotionFrame(segment, preset, time, frameRate);
    const lines = captionRuns(segment, preset, time)
      .map(run => run.text)
      .join("")
      .split("\n");
    return {
      frame,
      lines,
      height:
        frame?.height ??
        lines.length * preset.size * 1.2 +
          (preset.background ? 2 * preset.outline : 0),
    };
  });
  const unit = canvas.width / 100;
  const totalHeight = blocks.reduce((sum, b) => sum + b.height * unit, 0);
  const vertical =
    preset.motion?.verticalAnchor && preset.motion.verticalAnchor !== "auto"
      ? preset.motion.verticalAnchor
      : preset.position;
  const anchor = preset.motion?.anchor ?? "center";
  const x =
    canvas.width * (anchor === "left" ? 0.08 : anchor === "right" ? 0.92 : 0.5);
  let top =
    vertical === "center"
      ? (canvas.height - totalHeight) / 2
      : vertical === "top"
        ? (canvas.height * preset.margin) / 100
        : canvas.height * (1 - preset.margin / 100) - totalHeight;
  return blocks.flatMap(block => {
    const blockTop = top;
    top += block.height * unit;
    if (block.frame)
      return block.frame.units
        .filter(part => part.opacity > 0.05)
        .map(part => {
          const fringe =
            (preset.outline * part.scale + part.blur * 3 + part.glow * 2) *
            unit;
          const height = preset.size * 1.2 * part.scale * unit;
          return {
            x: x + part.x * unit - fringe,
            y: blockTop + part.y * unit - height / 2 - fringe,
            width: part.width * part.scale * unit + 2 * fringe,
            height: height + 2 * fringe,
          };
        });
    const width =
      (Math.max(...block.lines.map(line => captionLineWidth(line, preset))) +
        2 * preset.outline) *
      unit;
    return [
      {
        x: x - (anchor === "left" ? 0 : anchor === "right" ? width : width / 2),
        y: blockTop - preset.outline * unit,
        width,
        height: block.height * unit + 2 * preset.outline * unit,
      },
    ];
  });
}

/** Conservative visible envelope. Crop is in the fitted canvas BEFORE the
 * shared pose; transition reveal is in canvas coordinates AFTER the pose.
 * Nonrectangular masks retain their bounding envelope: they can cause cautious
 * omissions, never an invented clear area. Returned units are canvas pixels. */
export function protectedSourceBounds(
  clip: TimelineClip,
  time: number,
  rect: Rect,
  sourceSize: { width: number; height: number },
  canvas: { width: number; height: number }
): Rect | undefined {
  const frame = visualFrame(clip, time);
  const elapsed = time - clip.start;
  const opacity =
    Math.min(
      1,
      clip.fadeIn ? elapsed / clip.fadeIn : 1,
      clip.fadeOut ? (clip.duration - elapsed) / clip.fadeOut : 1
    ) * frame.opacity;
  if (clip.hidden || opacity <= 0.001) return undefined;
  const ratio = (clip.fit === "cover" ? Math.max : Math.min)(
    canvas.width / sourceSize.width,
    canvas.height / sourceSize.height
  );
  const fitWidth = sourceSize.width * ratio,
    fitHeight = sourceSize.height * ratio,
    offsetX = (canvas.width - fitWidth) / 2,
    offsetY = (canvas.height - fitHeight) / 2;
  const crop = frame.visual.crop;
  const fitted = intersection(
    {
      x: offsetX + rect.x * fitWidth,
      y: offsetY + rect.y * fitHeight,
      width: rect.width * fitWidth,
      height: rect.height * fitHeight,
    },
    {
      x: (canvas.width * crop.left) / 100,
      y: (canvas.height * crop.top) / 100,
      width: canvas.width * (1 - (crop.left + crop.right) / 100),
      height: canvas.height * (1 - (crop.top + crop.bottom) / 100),
    }
  );
  if (!fitted) return undefined;
  const corners = [
    [fitted.x, fitted.y],
    [fitted.x + fitted.width, fitted.y],
    [fitted.x + fitted.width, fitted.y + fitted.height],
    [fitted.x, fitted.y + fitted.height],
  ].map(([x, y]) => {
    const point = sourcePointToCanvas(
      clip,
      time,
      { x: (x - offsetX) / fitWidth, y: (y - offsetY) / fitHeight },
      sourceSize,
      canvas
    );
    return {
      x: (point.x * canvas.width) / 100,
      y: (point.y * canvas.height) / 100,
    };
  });
  const x = Math.min(...corners.map(p => p.x)),
    y = Math.min(...corners.map(p => p.y));
  return intersection(
    {
      x,
      y,
      width: Math.max(...corners.map(p => p.x)) - x,
      height: Math.max(...corners.map(p => p.y)) - y,
    },
    {
      x: (canvas.width * frame.reveal.left) / 100,
      y: (canvas.height * frame.reveal.top) / 100,
      width:
        canvas.width * (1 - (frame.reveal.left + frame.reveal.right) / 100),
      height:
        canvas.height * (1 - (frame.reveal.top + frame.reveal.bottom) / 100),
    }
  );
}

function covered(
  ranges: Array<{ start: number; end: number }>,
  start: number,
  end: number
) {
  let cursor = start;
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    if (range.end <= cursor) continue;
    if (range.start > cursor + 0.000001) return false;
    cursor = Math.max(cursor, range.end);
    if (cursor >= end - 0.000001) return true;
  }
  return false;
}

/** Exact delivery-frame times plus each 30 Hz graphic source-clock state. This
 * includes entrance/hold/exit, retained animation clocks, speed and trims.
 * A bounded scan that exceeds its budget reports uncertainty, never success. */
function graphicSampleTimes(clip: TimelineClip, frameRate: number) {
  const start = clip.start,
    end = clip.start + clip.duration,
    speed = clip.speed ?? 1;
  const estimated = clip.duration * (frameRate + 30 * speed);
  if (estimated > 36_000) return undefined;
  const times = new Set([start, Math.max(start, end - 0.000001)]);
  for (let n = Math.ceil(start * frameRate); n / frameRate < end; n++)
    times.add(n / frameRate);
  for (
    let n = Math.ceil(clip.inPoint * 30);
    n / 30 < clip.inPoint + clip.duration * speed;
    n++
  ) {
    const time = start + (n / 30 - clip.inPoint) / speed;
    if (time >= start && time < end)
      times.add(time + Math.min(0.000001, (end - time) / 2));
  }
  return [...times].sort((a, b) => a - b);
}

/** Evidence-backed placement checks for a NEW automatic graphic. Existing
 * manual graphics are never passed here. No network, OCR or inference calls. */
export function automaticGraphicProblems(
  project: EditProject,
  graphicClip: TimelineClip,
  assets: Asset[],
  intent: AutomaticGraphicIntent = "automatic",
  checkpoint: () => void = () => undefined,
  replacementRegions?: ReadonlySet<string>
): GraphicProtectionIssue[] {
  const graphic = normalizeGraphic(graphicClip.graphic);
  if (!graphic || graphicClip.hidden) return [];
  const canvas = {
    width: 1000,
    height:
      project.aspectRatio === "16:9"
        ? 562.5
        : project.aspectRatio === "1:1"
          ? 1000
          : 16000 / 9,
  };
  const times = graphicSampleTimes(graphicClip, project.frameRate ?? 30);
  const unknown = (detail: string): GraphicProtectionIssue => ({
    reason: "unknown-source-layout",
    detail,
    uncertain: true,
  });
  if (!times)
    return [
      unknown(
        "The graphic's complete motion exceeds the local placement-check limit."
      ),
    ];
  const effective = effectiveTimelineClips(project);
  const sources = effective
    .filter(
      clip =>
        !clip.hidden &&
        !clip.graphic &&
        clip.track !== "audio" &&
        clip.track !== "captions" &&
        clip.start < graphicClip.start + graphicClip.duration &&
        clip.start + clip.duration > graphicClip.start
    )
    .map(clip => {
      const asset = assets.find(a => a.id === clip.assetId);
      const evidence = normalizeSourceVisualEvidence(
        project.sourceReviews?.find(r => r.assetId === clip.assetId)
          ?.visualProtection,
        asset?.duration
      );
      const start = Math.max(clip.start, graphicClip.start),
        end = Math.min(
          clip.start + clip.duration,
          graphicClip.start + graphicClip.duration
        ),
        speed = clip.speed ?? 1;
      return {
        clip,
        asset,
        evidence,
        covered:
          evidence.coverage !== "unknown" &&
          covered(
            evidence.reviewedRanges,
            clip.inPoint + (start - clip.start) * speed,
            Math.min(clip.outPoint, clip.inPoint + (end - clip.start) * speed)
          ),
      };
    });
  const problems = new Map<GraphicProtectionReason, GraphicProtectionIssue>();
  const record = (issue: GraphicProtectionIssue) => {
    if (!problems.has(issue.reason)) problems.set(issue.reason, issue);
  };
  if (intent === "automatic") {
    const sourceCopy = timedSpeechPhrases(
      project.transcript,
      graphicClip.start,
      graphicClip.start + graphicClip.duration,
      { start: 0, end: project.duration }
    );
    for (const { clip, evidence } of sources) {
      const speed = clip.speed ?? 1;
      const start =
        clip.inPoint + Math.max(0, graphicClip.start - clip.start) * speed;
      const end = Math.min(
        clip.outPoint,
        clip.inPoint +
          (Math.min(
            clip.start + clip.duration,
            graphicClip.start + graphicClip.duration
          ) -
            clip.start) *
            speed
      );
      sourceCopy.push(
        ...evidence.observedText
          .filter(text => text.start < end && text.end > start)
          .map(text => text.text)
      );
      sourceCopy.push(
        ...timedSpeechPhrases(
          project.sourceSpeech?.find(speech => speech.assetId === clip.assetId)
            ?.segments ?? [],
          start,
          end,
          {
            start: clip.inPoint,
            end: Math.min(clip.outPoint, clip.inPoint + clip.duration * speed),
          }
        )
      );
    }
    const observed = sourceCopy.map(copyKey);
    const primaryIsVisible = ![
      "arrow",
      "highlight",
      "rectangle",
      "ellipse",
      "star",
      "line",
      "spatial-cube",
      "spatial-orbit",
    ].includes(graphic.kind);
    const primaryCopy =
      primaryIsVisible && graphic.kind === "countdown"
        ? [
            ...new Set(
              times
                .map(time =>
                  graphicFrame(
                    graphic,
                    graphicClip.inPoint +
                      (time - graphicClip.start) * (graphicClip.speed ?? 1),
                    graphicClip.graphicDuration ?? graphicClip.outPoint
                  )
                )
                .filter(frame => frame.opacity > 0.05)
                .map(frame => frame.text)
            ),
          ]
        : [
            primaryIsVisible
              ? graphic.kind === "counter"
                ? graphicFrame(
                    graphic,
                    graphicClip.graphicDuration ?? graphicClip.outPoint,
                    graphicClip.graphicDuration ?? graphicClip.outPoint
                  ).text
                : graphic.text
              : "",
          ];
    const parts = [...primaryCopy, graphic.secondaryText ?? ""]
      .map(copyKey)
      .filter(Boolean);
    if (
      parts.some(
        part => !observed.some(text => ` ${text} `.includes(` ${part} `))
      )
    )
      record({
        reason: "unsupported-source-copy",
        detail:
          "Automatic graphic copy was not found in the source's timed text or speech evidence.",
      });
  }
  let visibleTime = 0;
  for (let index = 0; index < times.length; index++) {
    if (index % 120 === 0) checkpoint();
    const time = times[index];
    const elapsed =
      graphicClip.inPoint +
      (time - graphicClip.start) * (graphicClip.speed ?? 1);
    const frame = graphicFrame(
      graphic,
      elapsed,
      graphicClip.graphicDuration ??
        graphicClip.outPoint ??
        graphicClip.duration
    );
    if (frame.opacity <= 0.05) continue;
    const bounds = graphicSelectionBounds(
      graphicClip,
      time,
      canvas.width,
      canvas.height
    );
    if (!bounds) continue;
    const painted = graphicPaintBounds(graphicClip, time, canvas);
    if (frame.opacity >= 0.75) visibleTime += (times[index + 1] ?? time) - time;
    for (const { clip, asset, evidence, covered: hasCoverage } of sources) {
      if (time < clip.start || time >= clip.start + clip.duration) continue;
      const sourceTime = clip.inPoint + (time - clip.start) * (clip.speed ?? 1);
      const sourceSize =
        asset &&
        Number.isFinite(asset.width) &&
        Number.isFinite(asset.height) &&
        asset.width! > 0 &&
        asset.height! > 0
          ? { width: asset.width!, height: asset.height! }
          : undefined;
      if (!sourceSize) {
        record(unknown(`Source dimensions are unavailable for ${clip.label}.`));
        continue;
      }
      const sourceBounds = protectedSourceBounds(
        clip,
        time,
        { x: 0, y: 0, width: 1, height: 1 },
        sourceSize,
        canvas
      );
      if (!sourceBounds || !intersection(bounds, sourceBounds)) continue;
      if (!hasCoverage)
        record(
          unknown(
            `Spatial evidence does not cover the complete graphic interval on ${clip.label}.`
          )
        );
      for (const region of evidence.regions) {
        if (sourceTime < region.start || sourceTime >= region.end) continue;
        const protectedBounds = protectedSourceBounds(
          clip,
          time,
          region.rect,
          sourceSize,
          canvas
        );
        // A requested text replacement may cover existing text. It is not
        // blanket permission to cover faces, demonstrations or other graphics.
        if (
          protectedBounds &&
          painted.some(area => paintIntersects(area, protectedBounds)) &&
          !(
            intent === "replace" &&
            region.kind === "text" &&
            (replacementRegions === undefined ||
              replacementRegions.has(`${clip.assetId}:${region.id}`))
          )
        )
          record({
            reason: "source-overlap",
            detail: `The graphic can cover observed ${region.kind} in ${clip.label}.`,
          });
      }
      if (intent === "automatic" && graphic.text.trim()) {
        // OCR often includes the entire caption line ("queste 30 domande")
        // while the added label repeats only its subject ("30 domande").
        // Compare complete tokens, not whole lines or raw substrings: 4 is
        // not 40, and "risk" is not "brisk". Only currently visible source
        // text is relevant; speech alone does not imply a visible duplicate.
        const key = copyKey(frame.text);
        if (
          key &&
          evidence.observedText.some(
            text =>
              sourceTime >= text.start &&
              sourceTime < text.end &&
              ` ${copyKey(text.text)} `.includes(` ${key} `)
          )
        )
          record({
            reason: "repeated-source-text",
            detail: "The graphic repeats text already visible in the source.",
          });
      }
    }
    for (const peer of effective) {
      if (peer.id === graphicClip.id || !peer.graphic || peer.hidden) continue;
      const peerBounds = graphicSelectionBounds(
        peer,
        time,
        canvas.width,
        canvas.height
      );
      const peerGraphic = normalizeGraphic(peer.graphic);
      if (!peerBounds || !peerGraphic) continue;
      const peerFrame = graphicFrame(
        peerGraphic,
        peer.inPoint + (time - peer.start) * (peer.speed ?? 1),
        peer.graphicDuration ?? peer.outPoint ?? peer.duration
      );
      if (
        peerFrame.opacity > 0.05 &&
        painted.some(area =>
          graphicPaintBounds(peer, time, canvas).some(peerArea =>
            paintIntersects(area, peerArea)
          )
        )
      )
        record({
          reason: "competing-text",
          detail: "The graphic overlaps another visible graphic.",
        });
    }
    const preset = getCaptionPreset(
      project.captionStyle,
      project.captionAppearance
    );
    const captions = project.transcript.filter(
      segment =>
        segment.start <= time && segment.end > time && segment.text.trim()
    );
    if (preset.animation === "motion") {
      const captionsPaint = motionCaptionBounds(
        captions,
        preset,
        time,
        project.frameRate ?? 30,
        canvas
      );
      if (
        painted.some(area =>
          captionsPaint.some(caption => paintIntersects(area, caption))
        )
      )
        record({
          reason: "competing-text",
          detail: "The graphic overlaps the editable caption layer.",
        });
      continue;
    }
    let captionWidth = 0,
      captionHeight = 0,
      captionShift = 0;
    for (const segment of captions) {
      const runs = captionRuns(segment, preset, time);
      const motion = captionMotion(
        segment,
        preset,
        time,
        project.frameRate ?? 30
      );
      if (!runs.length || motion.opacity <= 0.05) continue;
      const lines = runs
        .map(run => run.text)
        .join("")
        .split("\n");
      captionWidth = Math.max(
        captionWidth,
        (((Math.max(...lines.map(line => captionLineWidth(line, preset))) +
          2 * preset.outline) *
          canvas.width) /
          100) *
          motion.scale
      );
      captionHeight +=
        (((lines.length * preset.size * 1.2 + 2 * preset.outline) *
          canvas.width) /
          100) *
        Math.max(1, motion.scale);
      captionShift = Math.max(
        captionShift,
        (Math.abs(motion.y) * canvas.width) / 100
      );
    }
    if (captionWidth && captionHeight) {
      const captionBounds = {
        x: (canvas.width - captionWidth) / 2,
        y:
          (preset.position === "top"
            ? (canvas.height * preset.margin) / 100
            : canvas.height * (1 - preset.margin / 100) - captionHeight) -
          captionShift,
        width: captionWidth,
        height: captionHeight + 2 * captionShift,
      };
      if (painted.some(area => paintIntersects(area, captionBounds)))
        record({
          reason: "competing-text",
          detail: "The graphic overlaps the editable caption layer.",
        });
    }
  }
  if (intent === "automatic" && ["text", "callout"].includes(graphic.kind)) {
    const words = `${graphic.text} ${graphic.secondaryText ?? ""}`
      .trim()
      .split(/\s+/u)
      .filter(Boolean).length;
    if (visibleTime + 1 / 30 < Math.max(0.6, words / 4))
      record({
        reason: "reading-time",
        detail: "The graphic has too little settled reading time for its copy.",
      });
  }
  return [...problems.values()];
}
