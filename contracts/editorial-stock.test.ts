import { describe, expect, it } from "vitest";
import { buildEditPlanningContext } from "./edit-planning-context";
import type { Asset, EditOperation, EditProject } from "./workspace";
import type { StockMedia } from "./stock-media";
import {
  associateEditorialStock,
  editorialStockSearches,
  reviewEditorialStockOperations,
} from "./editorial-stock";

const source = {
  id: "source",
  kind: "video",
  status: "ready",
  duration: 20,
} as Asset;
const project = {
  duration: 20,
  clips: [0, 10].map((start, index) => ({
    id: `clip-${index}`,
    assetId: source.id,
    track: "video",
    start,
    duration: 10,
    inPoint: start,
    outPoint: start + 10,
  })),
  transcript: [],
} as unknown as EditProject;
const context = buildEditPlanningContext(project, [source]);
const media = (id = "1", kind: StockMedia["kind"] = "video"): StockMedia => ({
  id,
  kind,
  provider: "commons",
  title: "A general demonstration",
  creator: "Creator",
  source: "https://commons.wikimedia.org/wiki/File:Example.webm",
  license: "CC0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  url: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${id}.webm`,
  duration: 20,
});
const searches = () =>
  editorialStockSearches(
    [
      {
        kind: "video",
        query: "red prop",
        sceneId: context.scenes[0].id,
        purpose: "Introduce the demonstrated object",
      },
      {
        kind: "video",
        query: "result",
        sceneId: context.scenes[1].id,
        purpose: "Clarify the final result",
      },
    ],
    context
  );
const operation = (id: string, sourceIn?: number): EditOperation => ({
  id,
  type: "broll",
  label: "Illustration",
  reason: "Clarify the object",
  confidence: 0.9,
  intensity: "balanced",
  targetClipIds: [],
  start: 2,
  end: 5,
  parameters: {
    assetId: "stock:commons:1",
    ...(sourceIn === undefined ? {} : { sourceIn }),
  },
});
const candidate = () =>
  associateEditorialStock(
    [{ search: searches()[0], media: [media()] }],
    context,
    []
  );

describe("scene-specific stock planning", () => {
  it("deduplicates a provider query without losing its different scene purposes", () => {
    const result = editorialStockSearches(
      [
        {
          kind: "video",
          query: " Red prop ",
          sceneId: context.scenes[0].id,
          purpose: "Establish the prop",
        },
        {
          kind: "video",
          query: "red PROP",
          sceneId: context.scenes[1].id,
          purpose: "Explain the result",
        },
        {
          kind: "image",
          query: "unscoped",
          sceneId: "invented",
          purpose: "Not a measured scene",
        },
      ],
      context
    );
    expect(result).toHaveLength(2);
    expect(result[0].purposes).toEqual([
      {
        sceneId: context.scenes[0].id,
        start: 0,
        end: 10,
        purpose: "Establish the prop",
      },
      {
        sceneId: context.scenes[1].id,
        start: 10,
        end: 20,
        purpose: "Explain the result",
      },
    ]);
    expect(result[1].purposes).toEqual([]);
  });
  it("retains the complete result page and every query association for overlapping results", () => {
    const requests = searches();
    const result = associateEditorialStock(
      [
        {
          search: requests[0],
          media: Array.from({ length: 7 }, (_, index) => media(String(index))),
        },
        { search: requests[1], media: [media("1")] },
      ],
      context,
      []
    );
    expect(result).toHaveLength(7);
    expect(
      result.find(item => item.assetId === "stock:commons:1")?.searches
    ).toEqual(
      requests.map(search => ({
        query: search.query,
        purposes: search.purposes,
      }))
    );
    expect(result.every(item => item.verifiedSourceRanges.length === 0)).toBe(
      true
    );
  });
  it("grants source ranges only to the same reviewed owned stock media, never a filename or changed URL", () => {
    const excerpt = {
      id: "excerpt:owned:0",
      assetId: "owned",
      sourceIn: 5,
      sourceOut: 9,
      duration: 4,
      visualEvidence: "The result remains visible",
      confidence: 0.9,
    };
    const owned = { ...source, id: "owned", stock: media() };
    const result = associateEditorialStock(
      [{ search: searches()[0], media: [media()] }],
      { mediaExcerpts: [excerpt] },
      [owned]
    );
    expect(result[0].verifiedSourceRanges).toEqual([
      {
        assetId: "owned",
        start: 5,
        end: 9,
        visualEvidence: excerpt.visualEvidence,
      },
    ]);
    expect(
      associateEditorialStock(
        [{ search: searches()[0], media: [media()] }],
        { mediaExcerpts: [excerpt] },
        [{ ...owned, stock: { ...media(), url: `${media().url}?different` } }]
      )[0].verifiedSourceRanges
    ).toEqual([]);
  });
  it("keeps an explicitly chosen generic start and valid surrounding work, without inventing a source timestamp", () => {
    const zero = operation("zero", 0);
    const grade = {
      ...operation("grade"),
      type: "style",
      parameters: { contrast: 1.03 },
    } as EditOperation;
    const result = reviewEditorialStockOperations(
      [zero, operation("guessed", 5), grade, operation("unspecified")],
      candidate()
    );
    expect(result.changes).toEqual([zero, grade]);
    expect(result.changes[0]).toBe(zero);
    expect(result.review.omitted).toEqual([
      { operationId: "guessed", reason: "unverified-excerpt" },
      { operationId: "unspecified", reason: "unverified-excerpt" },
    ]);
  });
  it.each([-1, "0", undefined, Number.NaN])(
    "does not let normalized zero hide an unsupported raw offset: %s",
    sourceIn => {
      const result = reviewEditorialStockOperations(
        [operation("bad", 0)],
        candidate(),
        [{ parameters: { sourceIn } }]
      );
      expect(result.changes).toEqual([]);
      expect(result.review.omitted[0].reason).toBe("unverified-excerpt");
    }
  );
  it("accepts a fully evidenced interval and rejects overrun without moving it to zero", () => {
    const candidates = candidate();
    candidates[0].verifiedSourceRanges = [
      {
        assetId: "owned",
        start: 5,
        end: 9,
        visualEvidence: "The object is visible",
      },
    ];
    const allowed = operation("allowed", 5);
    const result = reviewEditorialStockOperations(
      [allowed, operation("outside", 7)],
      candidates
    );
    expect(result.changes).toEqual([allowed]);
    expect(result.review.omitted).toEqual([
      { operationId: "outside", reason: "unverified-excerpt" },
    ]);
    candidates[0].media.duration = 7;
    expect(
      reviewEditorialStockOperations([allowed], candidates).review.omitted[0]
        .reason
    ).toBe("duration-out-of-bounds");
  });
  it("allows a still without a video offset and rejects unknown media or invented still motion", () => {
    const candidates = associateEditorialStock(
      [
        {
          search: { ...searches()[0], kind: "image" },
          media: [media("1", "image")],
        },
      ],
      context,
      []
    );
    const still = operation("still");
    const unknown = {
      ...operation("unknown", 0),
      parameters: { assetId: "stock:commons:missing", sourceIn: 0 },
    };
    const result = reviewEditorialStockOperations(
      [still, operation("motion", 2), unknown],
      candidates
    );
    expect(result.changes).toEqual([still]);
    expect(result.review.omitted.map(item => item.reason)).toEqual([
      "unverified-excerpt",
      "unavailable-stock",
    ]);
  });
});
