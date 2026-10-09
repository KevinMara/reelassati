export const SEMANTIC_SEARCH_LIMITS = {
  excerpts: 256,
  excerptCharacters: 512,
  dimension: 384,
  batchSize: 8,
  minimumSimilarity: 0.28,
  results: 50,
} as const;

export function cosineSimilarity(
  a: ArrayLike<number>,
  b: ArrayLike<number>
): number {
  if (a.length !== SEMANTIC_SEARCH_LIMITS.dimension || b.length !== a.length)
    throw new Error("Invalid embedding dimensions");
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i]))
      throw new Error("Invalid embedding values");
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  if (aa <= 0 || bb <= 0) throw new Error("Empty embedding");
  return Math.max(-1, Math.min(1, dot / Math.sqrt(aa * bb)));
}

export interface SemanticSearchRequest {
  type: "search";
  id: number;
  fingerprint: string;
  query: string;
  excerpts: string[];
}
export type SemanticSearchResponse =
  | { type: "progress"; id: number; message: string }
  | { type: "result"; id: number; similarities: number[] }
  | { type: "error"; id: number; message: string };

export interface SemanticSearchWorker {
  postMessage: (request: SemanticSearchRequest) => void;
  terminate: () => void;
  onmessage: ((event: MessageEvent<SemanticSearchResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}
