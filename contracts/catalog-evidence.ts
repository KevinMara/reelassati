import type { SharedMediaCatalogItem } from "./shared-media-catalog";

export interface EvidenceBlob {
  data: string;
  sha256: string;
  contentType: "image/jpeg" | "audio/mpeg";
  bytes: number;
}
export interface CatalogEvidence {
  schemaVersion: 1;
  catalogId: string;
  mediaSha256: string;
  kind: SharedMediaCatalogItem["kind"];
  duration: number;
  visual?: EvidenceBlob & {
    width: number;
    height: number;
    columns: number;
    frameTimes: number[];
    sourceWidth: number;
    sourceHeight: number;
    coverage: "sampled-motion" | "complete-image";
  };
  audio?: EvidenceBlob & {
    segments: { sourceStart: number; sourceEnd: number; sampleStart: number }[];
    coverage: "complete-audio" | "sampled-audio";
    measured: {
      duration: number;
      peakDb: number;
      rmsDb: number;
      activeStart: number | null;
      activeEnd: number | null;
      onsets: number[];
      envelope: number[];
    };
  };
  lut?: {
    neutralCurve: number[][];
    colorSamples: { input: number[]; output: number[] }[];
    clippedSamples: number;
    gridSamples: number;
    coverage: "measured-lut";
    domainMin: number[];
    domainMax: number[];
  };
}
export interface CatalogSoundObservation {
  schemaVersion: 1;
  mediaSha256: string;
  sampleSha256: string;
  character: string;
  role: "music" | "effect" | "ambience" | "speech" | "mixed" | "unclear";
  audibleEvents: string[];
  suitableUses: string[];
  avoidUses: string[];
  containsSpeech: boolean;
  intensity: "subtle" | "moderate" | "strong";
  confidence: number;
  coverage: "complete-audio" | "sampled-audio";
}
/** Verified server-side planning sidecar; never stored in public asset metadata. */
export interface CatalogSoundPlanningObservation extends CatalogSoundObservation {
  sourceRanges: { start: number; end: number }[];
}
export interface CatalogVisualObservation {
  schemaVersion: 1;
  mediaSha256: string;
  sampleSha256: string;
  description: string;
  visibleElements: string[];
  sampledChanges: string[];
  composition: string;
  suitableUses: string[];
  avoidUses: string[];
  visibleText: string[];
  confidence: number;
  coverage: "complete-image" | "sampled-motion";
}
const object = (v: unknown): Record<string, any> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("Invalid catalog evidence.");
  return v as Record<string, any>;
};
const keys = (v: Record<string, any>, allowed: string[]) => {
  if (Object.keys(v).some(k => !allowed.includes(k)))
    throw new Error("Unsupported catalog evidence fields.");
};
const number = (v: unknown, min: number, max: number) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw new Error("Invalid measured evidence.");
  return v;
};
const vector = (v: unknown, count: number, min: number, max: number) => {
  if (!Array.isArray(v) || v.length !== count)
    throw new Error("Invalid evidence samples.");
  return v.map(x => number(x, min, max));
};
const list = (v: unknown, max: number, minValue: number, maxValue: number) => {
  if (!Array.isArray(v) || v.length > max)
    throw new Error("Invalid evidence sequence.");
  return v.map(x => number(x, minValue, maxValue));
};
function binary(
  v: Record<string, any>,
  mime: EvidenceBlob["contentType"]
): EvidenceBlob {
  if (
    v.contentType !== mime ||
    !Number.isInteger(v.bytes) ||
    v.bytes < 8 ||
    v.bytes > 1024 * 1024 ||
    typeof v.data !== "string" ||
    v.data.length !== 4 * Math.ceil(v.bytes / 3) ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(v.data) ||
    !/^[a-f0-9]{64}$/.test(v.sha256)
  )
    throw new Error("Invalid evidence media.");
  return { data: v.data, sha256: v.sha256, contentType: mime, bytes: v.bytes };
}
/** Sidecars cannot add supplier paths, remote URLs or unbounded prompt text. */
export function normalizeCatalogEvidence(
  value: unknown,
  item: SharedMediaCatalogItem
): CatalogEvidence {
  const v = object(value);
  keys(v, [
    "schemaVersion",
    "catalogId",
    "mediaSha256",
    "kind",
    "duration",
    "visual",
    "audio",
    "lut",
  ]);
  if (
    v.schemaVersion !== 1 ||
    v.catalogId !== item.id ||
    v.mediaSha256 !== item.media.sha256 ||
    v.kind !== item.kind ||
    v.duration !== item.duration
  )
    throw new Error("Evidence does not match immutable catalog media.");
  const out: CatalogEvidence = {
    schemaVersion: 1,
    catalogId: item.id,
    mediaSha256: item.media.sha256,
    kind: item.kind,
    duration: item.duration,
  };
  if (item.kind === "video" || item.kind === "image") {
    if (v.audio || v.lut) throw new Error("Wrong evidence type.");
    const s = object(v.visual);
    keys(s, [
      "data",
      "sha256",
      "contentType",
      "bytes",
      "width",
      "height",
      "columns",
      "frameTimes",
      "sourceWidth",
      "sourceHeight",
      "coverage",
    ]);
    if (
      s.sourceWidth !== item.width ||
      s.sourceHeight !== item.height ||
      s.coverage !==
        (item.kind === "video" ? "sampled-motion" : "complete-image")
    )
      throw new Error("Wrong visual evidence dimensions.");
    const times = list(s.frameTimes, 64, 0, item.duration);
    if (
      !times.length ||
      times.some((t, i) => i > 0 && t <= times[i - 1]) ||
      (item.kind === "image" && (times.length !== 1 || times[0] !== 0))
    )
      throw new Error("Invalid frame sequence.");
    out.visual = {
      ...binary(s, "image/jpeg"),
      width: number(s.width, 1, 4096),
      height: number(s.height, 1, 4096),
      columns: number(s.columns, 1, 8),
      sourceWidth: s.sourceWidth,
      sourceHeight: s.sourceHeight,
      frameTimes: times,
      coverage: s.coverage,
    };
  } else if (item.kind === "audio") {
    if (v.visual || v.lut) throw new Error("Wrong evidence type.");
    const s = object(v.audio);
    keys(s, [
      "data",
      "sha256",
      "contentType",
      "bytes",
      "segments",
      "coverage",
      "measured",
    ]);
    if (
      !["complete-audio", "sampled-audio"].includes(s.coverage) ||
      !Array.isArray(s.segments) ||
      !s.segments.length ||
      s.segments.length > 3
    )
      throw new Error("Invalid audio coverage.");
    let cursor = 0,
      previousEnd = 0;
    const segments = s.segments.map((x: unknown) => {
      const a = object(x);
      keys(a, ["sourceStart", "sourceEnd", "sampleStart"]);
      const start = number(a.sourceStart, 0, item.duration),
        end = number(a.sourceEnd, start, item.duration + 0.1);
      if (
        end <= start ||
        start < previousEnd - 0.001 ||
        Math.abs(number(a.sampleStart, 0, 31) - cursor) > 0.005
      )
        throw new Error("Invalid audio segment mapping.");
      cursor += end - start;
      previousEnd = end;
      return { sourceStart: start, sourceEnd: end, sampleStart: a.sampleStart };
    });
    if (
      cursor > 30.1 ||
      (s.coverage === "complete-audio" &&
        (segments.length !== 1 ||
          segments[0].sourceStart !== 0 ||
          Math.abs(segments[0].sourceEnd - item.duration) > 0.1))
    )
      throw new Error("Audio coverage exceeds its sample.");
    const m = object(s.measured);
    keys(m, [
      "duration",
      "peakDb",
      "rmsDb",
      "activeStart",
      "activeEnd",
      "onsets",
      "envelope",
    ]);
    out.audio = {
      ...binary(s, "audio/mpeg"),
      coverage: s.coverage,
      segments,
      measured: {
        duration: number(
          m.duration,
          Math.max(0, item.duration - 0.1),
          item.duration + 0.1
        ),
        peakDb: number(m.peakDb, -160, 24),
        rmsDb: number(m.rmsDb, -160, 24),
        activeStart:
          m.activeStart === null
            ? null
            : number(m.activeStart, 0, item.duration + 0.1),
        activeEnd:
          m.activeEnd === null
            ? null
            : number(m.activeEnd, 0, item.duration + 0.1),
        onsets: list(m.onsets, 128, 0, item.duration + 0.1),
        envelope: vector(m.envelope, 64, 0, 16),
      },
    };
  } else {
    if (v.visual || v.audio) throw new Error("Wrong evidence type.");
    const s = object(v.lut);
    keys(s, [
      "neutralCurve",
      "colorSamples",
      "clippedSamples",
      "gridSamples",
      "coverage",
      "domainMin",
      "domainMax",
    ]);
    if (
      s.coverage !== "measured-lut" ||
      s.gridSamples !== item.lut!.size ** 3 ||
      !Array.isArray(s.neutralCurve) ||
      s.neutralCurve.length !== 17 ||
      !Array.isArray(s.colorSamples) ||
      s.colorSamples.length !== 9
    )
      throw new Error("Invalid measured color look.");
    out.lut = {
      coverage: "measured-lut",
      neutralCurve: s.neutralCurve.map((x: unknown) => vector(x, 3, 0, 1)),
      colorSamples: s.colorSamples.map((x: unknown) => {
        const c = object(x);
        keys(c, ["input", "output"]);
        return {
          input: vector(c.input, 3, 0, 1),
          output: vector(c.output, 3, 0, 1),
        };
      }),
      gridSamples: s.gridSamples,
      clippedSamples: number(s.clippedSamples, 0, s.gridSamples),
      domainMin: vector(s.domainMin, 3, -65536, 65536),
      domainMax: vector(s.domainMax, 3, -65536, 65536),
    };
    if (
      JSON.stringify(out.lut.domainMin) !==
        JSON.stringify(item.lut!.domainMin) ||
      JSON.stringify(out.lut.domainMax) !== JSON.stringify(item.lut!.domainMax)
    )
      throw new Error("Color domains do not match.");
  }
  return out;
}
