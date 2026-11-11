import type { Asset, TimelineClip } from "./workspace";
import { normalizeVisual, type ClipVisual } from "./clip-visual";

export const CATALOG_OBJECT_MAX_BYTES = 96 * 1024 * 1024;
export interface CatalogObject {
  file: string;
  sha256: string;
  bytes: number;
  contentType:
    | "video/mp4"
    | "video/webm"
    | "audio/wav"
    | "audio/mpeg"
    | "image/png"
    | "image/jpeg"
    | "image/webp"
    | "application/x-cube";
}
/** Public metadata only. Original supplier, archive paths and rights evidence stay private. */
export interface SharedMediaCatalogItem {
  id: string;
  name: string;
  group: string;
  designId: string;
  variant: string;
  kind: "video" | "audio" | "image" | "lut";
  tags: string[];
  duration: number;
  width?: number;
  height?: number;
  blendMode?: ClipVisual["blendMode"];
  alpha?: true;
  waveform?: number[];
  lut?: {
    dimension: 1 | 3;
    size: number;
    domainMin: [number, number, number];
    domainMax: [number, number, number];
  };
  media: CatalogObject;
  poster?: CatalogObject;
  license: "platform-licensed";
  credits: 0;
}
export interface SharedMediaCatalogPage {
  items: SharedMediaCatalogItem[];
  variants: Record<string, SharedMediaCatalogItem[]>;
  total: number;
  page: number;
  pageSize: number;
  groups: Array<{ name: string; count: number }>;
}
export interface SharedMediaCatalogManifest {
  schemaVersion: 1;
  items: SharedMediaCatalogItem[];
}
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("Invalid catalog record.");
  return v as Record<string, unknown>;
};
const text = (v: unknown, maximum: number) => {
  if (
    typeof v !== "string" ||
    !v.trim() ||
    v.length > maximum ||
    [...v].some(character => character.charCodeAt(0) < 32) ||
    /four[\s_-]*editors/i.test(v)
  )
    throw new Error("Catalog labels must be neutral public text.");
  return v.trim();
};
const positive = (v: unknown, maximum: number) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > maximum)
    throw new Error("Invalid measured catalog dimensions or duration.");
  return v;
};
const keys = (v: Record<string, unknown>, allowed: string[]) => {
  if (Object.keys(v).some(key => !allowed.includes(key)))
    throw new Error("Private or unsupported catalog fields are not allowed.");
};
function object(v: unknown): CatalogObject {
  const row = record(v);
  keys(row, ["file", "sha256", "bytes", "contentType"]);
  if (typeof row.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(row.sha256))
    throw new Error("Invalid catalog object digest.");
  const formats: Record<string, string> = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/wav": "wav",
    "audio/mpeg": "mp3",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "application/x-cube": "cube",
  };
  const extension = formats[String(row.contentType)];
  if (!extension || row.file !== `media/${row.sha256}.${extension}`)
    throw new Error("Invalid catalog object path or format.");
  const bytes = positive(row.bytes, CATALOG_OBJECT_MAX_BYTES);
  if (!Number.isInteger(bytes)) throw new Error("Invalid catalog object size.");
  return {
    file: row.file as string,
    sha256: row.sha256,
    bytes,
    contentType: row.contentType as CatalogObject["contentType"],
  };
}
export function normalizeSharedCatalogItem(v: unknown): SharedMediaCatalogItem {
  const row = record(v);
  keys(row, [
    "id",
    "name",
    "group",
    "designId",
    "variant",
    "kind",
    "tags",
    "duration",
    "width",
    "height",
    "blendMode",
    "alpha",
    "waveform",
    "lut",
    "media",
    "poster",
    "license",
    "credits",
  ]);
  const media = object(row.media);
  if (
    row.id !== `stock-${media.sha256.slice(0, 24)}` ||
    !/^[a-z0-9-]{1,100}$/.test(String(row.designId))
  )
    throw new Error("Invalid catalog identity.");
  if (
    !["audio", "video", "image", "lut"].includes(String(row.kind)) ||
    !(row.kind === "lut"
      ? media.contentType === "application/x-cube"
      : media.contentType.startsWith(`${row.kind}/`))
  )
    throw new Error("Catalog kind and file do not agree.");
  if (row.license !== "platform-licensed" || row.credits !== 0)
    throw new Error("Invalid catalog availability or license.");
  if (!Array.isArray(row.tags) || row.tags.length > 20)
    throw new Error("Invalid catalog tags.");
  const item: SharedMediaCatalogItem = {
    id: row.id as string,
    name: text(row.name, 100),
    group: text(row.group, 60),
    designId: row.designId as string,
    variant: text(row.variant, 60),
    kind: row.kind as SharedMediaCatalogItem["kind"],
    tags: row.tags.map(tag => text(tag, 40)),
    duration:
      row.kind === "lut" && row.duration === 0
        ? 0
        : positive(row.duration, 86400),
    media,
    license: "platform-licensed",
    credits: 0,
  };
  if (row.alpha !== undefined) {
    if (
      row.alpha !== true ||
      item.kind !== "video" ||
      media.contentType !== "video/webm"
    )
      throw new Error("Alpha delivery requires verified VP9 WebM.");
    item.alpha = true;
  }
  if (item.kind === "lut") {
    const lut = record(row.lut);
    keys(lut, ["dimension", "size", "domainMin", "domainMax"]);
    if (
      lut.dimension !== 3 ||
      !Number.isInteger(lut.size) ||
      Number(lut.size) < 2 ||
      Number(lut.size) > 64
    )
      throw new Error("Invalid LUT grid.");
    const min = lut.domainMin,
      max = lut.domainMax;
    if (
      !Array.isArray(min) ||
      !Array.isArray(max) ||
      min.length !== 3 ||
      max.length !== 3 ||
      min.some(
        (v, i) =>
          typeof v !== "number" ||
          !Number.isFinite(v) ||
          typeof max[i] !== "number" ||
          !Number.isFinite(max[i]) ||
          v >= max[i]
      )
    )
      throw new Error("Invalid LUT domain.");
    item.lut = {
      dimension: 3,
      size: Number(lut.size),
      domainMin: min as [number, number, number],
      domainMax: max as [number, number, number],
    };
    if (
      row.poster !== undefined ||
      row.blendMode !== undefined ||
      row.waveform !== undefined ||
      row.width !== undefined ||
      row.height !== undefined
    )
      throw new Error("LUT has no media placement metadata.");
  } else if (item.kind !== "audio") {
    item.width = positive(row.width, 16384);
    item.height = positive(row.height, 16384);
    if (!Number.isInteger(item.width) || !Number.isInteger(item.height))
      throw new Error("Catalog dimensions must be whole pixels.");
    if (
      ![
        "normal",
        "screen",
        "overlay",
        "multiply",
        "darken",
        "lighten",
        "difference",
      ].includes(String(row.blendMode))
    )
      throw new Error("Choose a supported compositing mode.");
    item.blendMode = row.blendMode as ClipVisual["blendMode"];
    item.poster = object(row.poster);
    if (!item.poster.contentType.startsWith("image/"))
      throw new Error("Catalog poster must be an image.");
  } else {
    if (
      !Array.isArray(row.waveform) ||
      row.waveform.length !== 64 ||
      row.waveform.some(
        v => typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1
      )
    )
      throw new Error("Audio needs its measured 64-bin waveform.");
    item.waveform = row.waveform;
    if (
      row.poster !== undefined ||
      row.blendMode !== undefined ||
      row.width !== undefined ||
      row.height !== undefined
    )
      throw new Error("Audio cannot contain visual metadata.");
  }
  return item;
}
export function sharedCatalogPlacement(
  item: SharedMediaCatalogItem,
  raw: unknown,
  duration: number,
  range?: { start: number; end: number }
) {
  if (raw === undefined) return undefined;
  if (item.kind === "lut")
    throw new Error("Apply a LUT through color controls.");
  const row = record(raw);
  const lower = range?.start ?? 0,
    upper = Math.min(duration, range?.end ?? duration);
  const start = row.start;
  if (
    typeof start !== "number" ||
    !Number.isFinite(start) ||
    start < lower ||
    start >= upper
  )
    throw new Error("The catalog placement starts outside the selected edit.");
  const seconds = positive(
    row.duration ?? Math.min(item.duration, upper - start),
    item.kind === "image" ? 86400 : item.duration
  );
  if (start + seconds > upper + 0.000001)
    throw new Error("The catalog placement extends outside the selected edit.");
  return { start, duration: seconds };
}
export const sharedCatalogMediaPath = (
  id: string,
  role: "media" | "poster" = "media"
) => `/api/catalog/media/${encodeURIComponent(id)}/${role}`;
export function sharedCatalogPlanningAssets(
  items: SharedMediaCatalogItem[]
): Asset[] {
  return items
    .filter(
      (
        item
      ): item is SharedMediaCatalogItem & {
        kind: "audio" | "video" | "image";
      } => item.kind !== "lut"
    )
    .map(item => ({
      id: `shared:${item.id}`,
      name: item.name,
      kind: item.kind,
      contentType: item.media.contentType,
      size: item.media.bytes,
      duration: item.duration,
      width: item.width,
      height: item.height,
      url: "",
      status: "ready",
      createdAt: "",
      catalog: item,
      variantGroupId: `shared-catalog:${item.id}`,
    }));
}
export function sharedCatalogClipDefaults(asset: Asset): Partial<TimelineClip> {
  const item = asset.catalog;
  return item && item.kind !== "audio" && item.kind !== "lut"
    ? {
        track: "overlay",
        primaryFootage: false,
        muted: true,
        fit: "contain",
        visual: normalizeVisual({ blendMode: item.blendMode }),
      }
    : {};
}
