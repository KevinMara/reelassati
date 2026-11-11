import { paintEffectCatalog } from "./editor-effect-catalog-data";
import { normalizeVisual } from "./clip-visual";
import type { Asset, TimelineClip } from "./workspace";

export interface EditorEffectCatalogEntry {
  id: string;
  name: string;
  category: string;
  file: string;
  poster: string;
  duration: number;
  width: number;
  height: number;
  sha256: string;
  bytes: number;
  blendMode: "screen";
  tags: readonly string[];
  creditCost: 0;
  license: "platform-licensed";
}

export const editorEffectCatalog: readonly EditorEffectCatalogEntry[] =
  paintEffectCatalog;

export const editorEffectUrl = (
  entry: Pick<EditorEffectCatalogEntry, "file">
) => `/shared-assets/effects/${entry.file}`;
export const editorEffectPoster = (
  entry: Pick<EditorEffectCatalogEntry, "poster">
) => `/shared-assets/effects/${entry.poster}`;

export function findCatalogEffect(id: unknown): EditorEffectCatalogEntry {
  const entry = editorEffectCatalog.find(item => item.id === id);
  if (!entry || entry.creditCost !== 0 || entry.license !== "platform-licensed")
    throw new Error("Choose an effect from the available media catalog.");
  return entry;
}

export function catalogEffectForAsset(
  asset: Pick<Asset, "kind" | "variantGroupId">
) {
  if (
    asset.kind !== "video" ||
    !asset.variantGroupId?.startsWith("builtin-effect:")
  )
    return undefined;
  return editorEffectCatalog.find(
    entry => asset.variantGroupId === `builtin-effect:${entry.id}`
  );
}

/** Black is removed by the same screen blend in preview and export. This is a
 * silent overlay, not a source replacement or an adjacent-shot transition. */
export function catalogEffectClipDefaults(asset: Asset): Partial<TimelineClip> {
  const entry = catalogEffectForAsset(asset);
  return entry
    ? {
        track: "overlay",
        primaryFootage: false,
        muted: true,
        fit: "contain",
        visual: normalizeVisual({ blendMode: entry.blendMode }),
      }
    : {};
}

export function catalogEffectPlacement(
  entry: EditorEffectCatalogEntry,
  raw: unknown,
  duration: number,
  range?: { start: number; end: number }
): { start: number; duration: number } | undefined {
  if (raw === undefined) return;
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("An effect placement needs a valid timeline position.");
  const value = raw as Record<string, unknown>;
  const lower = range?.start ?? 0;
  const upper = Math.min(duration, range?.end ?? duration);
  const start = value.start;
  if (
    typeof start !== "number" ||
    !Number.isFinite(start) ||
    start < lower ||
    start >= upper
  )
    throw new Error(
      "The effect starts outside the current edit or selected range."
    );
  const seconds = value.duration ?? Math.min(entry.duration, upper - start);
  if (
    typeof seconds !== "number" ||
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    seconds > entry.duration + 0.000001 ||
    start + seconds > upper + 0.000001
  )
    throw new Error(
      "The effect must fit its actual source duration and the selected range."
    );
  return { start, duration: Math.min(seconds, entry.duration) };
}
