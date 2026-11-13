import type { ModelContentPart } from "./model-content";

/** Request-local labels avoid asking a model to reproduce long hashes.
 * Only exact, complete responses can be rebound to the original assets. */
export function catalogReviewIdentity(kind: "sound" | "visual", ids: string[], parts: ModelContentPart[]) {
  if (!ids.length || new Set(ids).size !== ids.length)
    throw new Error("Invalid catalog review identities.");
  const labels = ids.map((_, i) => `asset-${i + 1}`);
  const aliases = new Map(ids.map((id, i) => [id, labels[i]]));
  const bound = new Map(labels.map((label, i) => [label, ids[i]]));
  const key = kind === "sound" ? "sounds" : "visuals";
  const requestParts = parts.map(part => {
    if (part.type !== "text") return part;
    const metadata = JSON.parse(part.text);
    if (!metadata || !aliases.has(metadata.id))
      throw new Error("Invalid catalog review identities.");
    return {...part, text: JSON.stringify({...metadata, id: aliases.get(metadata.id)})};
  });
  return {
    ids: labels,
    parts: requestParts,
    bind(value: unknown): Record<string, unknown> {
      const raw = value as Record<string, unknown> | null;
      const rows = raw?.[key];
      const fail = () => { throw new Error(kind === "sound"
        ? "Sound observation identities do not match."
        : "Visual observation identities do not match."); };
      if (!Array.isArray(rows) || rows.length !== ids.length) return fail();
      const seen = new Set<string>();
      const rebound = rows.map(row => {
        if (!row || typeof row !== "object" || typeof row.id !== "string" ||
            !bound.has(row.id) || seen.has(row.id)) return fail();
        seen.add(row.id);
        return {...row, id: bound.get(row.id)!};
      });
      return {...raw, [key]: rebound};
    },
  };
}
