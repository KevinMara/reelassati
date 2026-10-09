import { describe, expect, it, vi } from "vitest";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import type {
  SemanticSearchRequest,
  SemanticSearchResponse,
  SemanticSearchWorker,
} from "./semantic-search-protocol";
import {
  buildSemanticFootageCorpus,
  cosineSimilarity,
  rankSemanticFootage,
  SemanticFootageSearchClient,
  SEMANTIC_SEARCH_LIMITS,
} from "./semantic-footage-search";

const asset: Asset = {
  id: "source",
  name: "take.mp4",
  kind: "video",
  contentType: "video/mp4",
  size: 10,
  duration: 40,
  url: "https://private.invalid/never-fetch-this",
  status: "ready",
  createdAt: "2026-10-01T10:00:00Z",
};
const clip: TimelineClip = {
  id: "clip",
  assetId: "source",
  label: "Take",
  track: "video",
  start: 5,
  duration: 5,
  inPoint: 10,
  outPoint: 20,
  speed: 2,
  locked: false,
  color: "#fff",
};
function project(patch: Partial<EditProject> = {}): EditProject {
  return {
    id: "project",
    title: "Edit",
    template: "custom",
    status: "editing",
    platform: "instagram",
    aspectRatio: "1:1",
    duration: 30,
    playhead: 0,
    createdAt: asset.createdAt,
    updatedAt: "2026-10-02T10:00:00Z",
    clips: [clip],
    transcript: [],
    proposedChanges: [],
    qualitySignals: [],
    revisions: [],
    ...patch,
  };
}
function reviewed(patch: Partial<EditProject> = {}) {
  return project({
    sourceReviews: [
      {
        assetId: "source",
        reviewedAt: "2026-10-02T10:00:00Z",
        summary: "Observed source",
        captions: "unknown",
        captionNote: "",
        audio: "unknown",
        audioNote: "",
        moments: [
          { start: 11, end: 15, note: "A person sips a hot cup of coffee." },
        ],
      },
    ],
    ...patch,
  });
}

describe("semantic footage evidence", () => {
  it("keeps exact owners and both clocks through repeated/retimed footage without reading URLs", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const corpus = buildSemanticFootageCorpus(
      reviewed({
        clips: [
          clip,
          {
            ...clip,
            id: "again",
            start: 20,
            duration: 4,
            inPoint: 12,
            outPoint: 14,
            speed: 0.5,
          },
        ],
      }),
      [asset]
    );
    expect(
      corpus.rows
        .filter(row => row.evidence === "observed-scene")
        .map(({ clipId, start, end, sourceStart, sourceEnd }) => ({
          clipId,
          start,
          end,
          sourceStart,
          sourceEnd,
        }))
    ).toEqual([
      { clipId: "clip", start: 5.5, end: 7.5, sourceStart: 11, sourceEnd: 15 },
      { clipId: "again", start: 20, end: 24, sourceStart: 12, sourceEnd: 14 },
    ]);
    expect(
      corpus.excerpts.filter(text => text.includes("coffee"))
    ).toHaveLength(1);
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
    expect(JSON.stringify(corpus)).not.toContain("private.invalid");
  });

  it("rejects unowned speech, absent/deleted sources, stale reviews and partial untimed cues", () => {
    const p = reviewed({
      transcript: [
        { id: "unowned", start: 6, end: 7, text: "secret" },
        {
          id: "wrong",
          sourceClipId: "gone",
          start: 6,
          end: 7,
          text: "deleted",
        },
        {
          id: "partial",
          sourceClipId: "clip",
          start: 4,
          end: 7,
          text: "trimmed-away speech",
        },
      ],
      sourceReviews: [
        { ...reviewed().sourceReviews![0], reviewedAt: "2026-09-01T00:00:00Z" },
      ],
    });
    expect(
      buildSemanticFootageCorpus(p, [asset]).rows.every(
        row => row.evidence === "clip-name"
      )
    ).toBe(true);
    expect(
      buildSemanticFootageCorpus(p, [{ ...asset, status: "processing" }]).rows
    ).toEqual([]);
  });

  it("collects only retained timed words, separates pauses, and clips source bounds", () => {
    const p = project({
      transcript: [
        {
          id: "speech",
          sourceClipId: "clip",
          start: 4,
          end: 12,
          text: "outside first second outside",
          words: [
            { text: "outside", start: 4, end: 4.5 },
            { text: "first", start: 5.5, end: 6 },
            { text: "second", start: 8, end: 9 },
            { text: "outside", start: 11, end: 12 },
          ],
        },
      ],
    });
    expect(
      buildSemanticFootageCorpus(p, [asset])
        .rows.filter(row => row.evidence === "transcript")
        .map(({ snippet, start, end, sourceStart, sourceEnd }) => ({
          snippet,
          start,
          end,
          sourceStart,
          sourceEnd,
        }))
    ).toEqual([
      { snippet: "first", start: 5.5, end: 6, sourceStart: 11, sourceEnd: 12 },
      { snippet: "second", start: 8, end: 9, sourceStart: 16, sourceEnd: 18 },
    ]);
  });

  it("bounds 256 distinct 512-character excerpts and 50 returned mappings", () => {
    const clips = Array.from({ length: 350 }, (_, i) => ({
      ...clip,
      id: `c${i}`,
      label: `label ${i} ${"x".repeat(700)}`,
    }));
    const corpus = buildSemanticFootageCorpus(project({ clips }), [asset]);
    expect(corpus.excerpts).toHaveLength(256);
    expect(corpus.omittedExcerpts).toBe(true);
    expect(corpus.excerpts.every(text => text.length <= 512)).toBe(true);
    expect(
      rankSemanticFootage(
        corpus,
        corpus.excerpts.map(() => 0.5)
      )
    ).toHaveLength(50);
  });

  it("changes evidence identity on trim, review, transcript, labels, hiding, and muting", () => {
    const p = reviewed(),
      original = buildSemanticFootageCorpus(p, [asset]).fingerprint;
    for (const changed of [
      { ...clip, start: 6 },
      { ...clip, label: "Different" },
      { ...clip, hidden: true },
      { ...clip, muted: true },
    ])
      expect(
        buildSemanticFootageCorpus({ ...p, clips: [changed] }, [asset])
          .fingerprint
      ).not.toBe(original);
    expect(
      buildSemanticFootageCorpus(
        {
          ...p,
          sourceReviews: [
            {
              ...p.sourceReviews![0],
              moments: [
                { start: 12, end: 14, note: "A different observation" },
              ],
            },
          ],
        },
        [asset]
      ).fingerprint
    ).not.toBe(original);
  });

  it("rejects invalid vectors and result lengths; similarity is not a probability", () => {
    const a = new Float32Array(384).fill(1),
      b = new Float32Array(384).fill(-1);
    expect(cosineSimilarity(a, a)).toBeCloseTo(1);
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1);
    expect(() => cosineSimilarity(a, new Float32Array(3))).toThrow();
    expect(() => cosineSimilarity(a, new Float32Array(384))).toThrow();
    expect(() =>
      rankSemanticFootage(buildSemanticFootageCorpus(reviewed(), [asset]), [
        NaN,
      ])
    ).toThrow();
  });
});

class FakeWorker implements SemanticSearchWorker {
  onmessage: ((event: MessageEvent<SemanticSearchResponse>) => void) | null =
    null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  requests: SemanticSearchRequest[] = [];
  postMessage(request: SemanticSearchRequest) {
    this.requests.push(request);
  }
  terminate() {
    this.terminated = true;
  }
  result(scores: number[], id = this.requests.at(-1)!.id) {
    this.onmessage?.({
      data: { type: "result", id, similarities: scores },
    } as MessageEvent<SemanticSearchResponse>);
  }
}
describe("component-owned semantic worker", () => {
  it("terminates and rejects pending evidence on cancellation and ignores stale responses", async () => {
    const workers: FakeWorker[] = [],
      client = new SemanticFootageSearchClient(() => {
        const w = new FakeWorker();
        workers.push(w);
        return w;
      });
    const corpus = buildSemanticFootageCorpus(reviewed(), [asset]);
    const old = client.search(corpus, "a warm drink");
    const rejection = expect(old).rejects.toMatchObject({ name: "AbortError" });
    client.cancel();
    await rejection;
    expect(workers[0].terminated).toBe(true);
    const next = client.search(corpus, "pet dog");
    workers[0].result([1]);
    workers[1].result(corpus.excerpts.map(() => 0.1));
    await expect(next).resolves.toEqual(corpus.excerpts.map(() => 0.1));
    client.cancel();
    expect(workers[1].terminated).toBe(true);
  });

  it("transmits only bounded text evidence and safely handles worker failure", async () => {
    const worker = new FakeWorker(),
      client = new SemanticFootageSearchClient(() => worker);
    const pending = client.search(
      buildSemanticFootageCorpus(reviewed(), [asset]),
      "a warm drink"
    );
    expect(JSON.stringify(worker.requests)).not.toContain(asset.url);
    expect(worker.requests[0].excerpts.length).toBeLessThanOrEqual(
      SEMANTIC_SEARCH_LIMITS.excerpts
    );
    worker.onerror?.({} as ErrorEvent);
    await expect(pending).rejects.toThrow(
      "Local meaning search could not start"
    );
    expect(worker.terminated).toBe(true);
  });
});
