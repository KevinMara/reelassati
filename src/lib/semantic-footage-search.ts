import type { Asset, EditProject } from "@contracts/workspace";
import {
  collectProjectFootageEvidence,
  type ProjectFootageMatch,
} from "./project-footage-search";

import {
  SEMANTIC_SEARCH_LIMITS,
  type SemanticSearchWorker,
} from "./semantic-search-protocol";
export {
  SEMANTIC_SEARCH_LIMITS,
  cosineSimilarity,
} from "./semantic-search-protocol";
export type {
  SemanticSearchRequest,
  SemanticSearchResponse,
  SemanticSearchWorker,
} from "./semantic-search-protocol";

export interface SemanticFootageCorpus {
  /** Exact bounded evidence identity, not a collision-prone hash. */
  fingerprint: string;
  excerpts: string[];
  rows: (ProjectFootageMatch & { excerpt: number })[];
  omittedExcerpts: boolean;
}

export function buildSemanticFootageCorpus(
  project: EditProject,
  assets: readonly Asset[]
): SemanticFootageCorpus {
  const evidence = collectProjectFootageEvidence(
    project,
    assets,
    SEMANTIC_SEARCH_LIMITS.excerptCharacters
  );
  const excerpts: string[] = [],
    byText = new Map<string, number>();
  const rows: SemanticFootageCorpus["rows"] = [];
  let omittedExcerpts = false;
  for (const row of evidence) {
    let excerpt = byText.get(row.snippet);
    if (excerpt === undefined) {
      if (excerpts.length >= SEMANTIC_SEARCH_LIMITS.excerpts) {
        omittedExcerpts = true;
        continue;
      }
      excerpt = excerpts.length;
      byText.set(row.snippet, excerpt);
      excerpts.push(row.snippet);
    }
    rows.push({ ...row, excerpt });
  }
  return { excerpts, rows, omittedExcerpts, fingerprint: JSON.stringify(rows) };
}

export function rankSemanticFootage(
  corpus: SemanticFootageCorpus,
  similarities: readonly number[]
): ProjectFootageMatch[] {
  if (
    similarities.length !== corpus.excerpts.length ||
    similarities.some(
      score => !Number.isFinite(score) || score < -1 || score > 1
    )
  )
    throw new Error("Invalid semantic search results");
  return corpus.rows
    .flatMap(({ excerpt, ...row }) =>
      similarities[excerpt] >= SEMANTIC_SEARCH_LIMITS.minimumSimilarity
        ? [{ ...row, score: similarities[excerpt] }]
        : []
    )
    .sort(
      (a, b) =>
        b.score - a.score || a.start - b.start || a.id.localeCompare(b.id)
    )
    .slice(0, SEMANTIC_SEARCH_LIMITS.results);
}

/** One component-owned worker. All excerpt vectors live only in that worker;
 * cancel/identity changes destroy its model session and pending evidence. */
export class SemanticFootageSearchClient {
  private worker: SemanticSearchWorker | undefined;
  private nextId = 0;
  private pending:
    | {
        id: number;
        resolve: (value: number[]) => void;
        reject: (reason: Error) => void;
        progress: (message: string) => void;
      }
    | undefined;
  private readonly createWorker: () => SemanticSearchWorker;
  constructor(
    createWorker: () => SemanticSearchWorker = () =>
      new Worker(
        new URL("../workers/semantic-search.worker.ts", import.meta.url),
        { type: "module" }
      )
  ) {
    this.createWorker = createWorker;
  }

  search(
    corpus: SemanticFootageCorpus,
    query: string,
    progress: (message: string) => void = () => {}
  ): Promise<number[]> {
    if (this.pending) this.cancel();
    const trimmed = query.trim().slice(0, 500);
    if (!trimmed || !corpus.excerpts.length) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
      try {
        this.worker ??= this.createWorker();
        const id = ++this.nextId;
        this.pending = { id, resolve, reject, progress };
        this.worker.onmessage = event => {
          const result = event.data,
            pending = this.pending;
          if (!pending || result.id !== pending.id) return;
          if (result.type === "progress") {
            pending.progress(result.message);
            return;
          }
          this.pending = undefined;
          if (result.type === "result") pending.resolve(result.similarities);
          else pending.reject(new Error(result.message));
        };
        this.worker.onerror = () => {
          this.pending?.reject(
            new Error(
              "Local meaning search could not start. Try literal search."
            )
          );
          this.pending = undefined;
          this.cancel();
        };
        this.worker.postMessage({
          type: "search",
          id,
          fingerprint: corpus.fingerprint,
          query: trimmed,
          excerpts: corpus.excerpts,
        });
      } catch {
        this.pending = undefined;
        reject(
          new Error(
            "Local meaning search is unavailable in this browser. Try literal search."
          )
        );
        this.cancel();
      }
    });
  }
  cancel() {
    this.pending?.reject(new DOMException("Search cancelled", "AbortError"));
    this.pending = undefined;
    this.worker?.terminate();
    this.worker = undefined;
  }
}
