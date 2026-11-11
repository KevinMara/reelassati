import type { ClipColorLut } from "./color-lut";
import type { SharedMediaCatalogItem } from "./shared-media-catalog";

export interface CatalogColorLutCandidate {
  id: string;
  name: string;
  sha256: string;
  group: string;
  tags: string[];
}

/** The planning context contains ready catalog records supplied by the server. */
export function catalogColorLutCandidates(items: SharedMediaCatalogItem[]) {
  return items
    .filter(item => item.kind === "lut" && item.lut?.dimension === 3)
    .map(({ id, name, group, tags, media }) => ({
      id,
      name,
      group,
      tags,
      sha256: media.sha256,
    }));
}

/** Models choose an identity and intensity; canonical bytes/name come from the
 * same catalog as manual selection, never a generated URL or guessed hash. */
export function resolveCatalogColorLut(
  value: unknown,
  candidates: readonly CatalogColorLutCandidate[]
): ClipColorLut | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(
      "Choose an available catalog color look and its intensity."
    );
  const row = value as Record<string, unknown>;
  const candidate = candidates.find(item => item.id === row.id);
  if (
    !candidate ||
    Object.keys(row).some(
      key => !["id", "name", "sha256", "amount"].includes(key)
    ) ||
    (row.sha256 !== undefined && row.sha256 !== candidate.sha256) ||
    typeof row.amount !== "number" ||
    !Number.isFinite(row.amount) ||
    row.amount < 0 ||
    row.amount > 1
  )
    throw new Error(
      "This color look is unavailable or its intensity is invalid."
    );
  return {
    id: candidate.id,
    name: candidate.name,
    sha256: candidate.sha256,
    amount: row.amount,
  };
}

export const CATALOG_COLOR_LUT_GUIDANCE = `The supplied catalogColorLooks are actual licensed 3D color tables, available without media-generation credits. To apply one, use type=style with parameters.colorLut:{id:the exact supplied catalog ID,amount:0..1} on explicit visible footage targetClipIds and the requested timeline range. The server resolves its canonical name and SHA; never invent a LUT ID, URL, title, hash, or approximate named preset. Use parameters.colorLut:null only to explicitly remove an existing look. Keep ordinary numeric grade controls independent and preserve them unless requested. A LUT is a color treatment, not a media asset or a generated clip. Names and tags describe a catalog category, not proof that a look will suit the footage; avoid claiming an unobserved visual result. Preserve source legibility, skin detail and the user's intended style.`;
