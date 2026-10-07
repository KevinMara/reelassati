import { describe, expect, it } from "vitest";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import type { SourceReview } from "@contracts/source-review";
import {
  PROJECT_FOOTAGE_SEARCH_LIMITS,
  searchProjectFootage,
} from "./project-footage-search";

function asset(patch: Partial<Asset> = {}): Asset {
  return {
    id: "source",
    name: "take.mp4",
    kind: "video",
    contentType: "video/mp4",
    size: 100,
    duration: 40,
    url: "/media/take.mp4",
    status: "ready",
    createdAt: "2026-10-01T10:00:00Z",
    ...patch,
  };
}
function clip(patch: Partial<TimelineClip> = {}): TimelineClip {
  return {
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
    ...patch,
  };
}
function review(
  moments: SourceReview["moments"],
  patch: Partial<SourceReview> = {}
): SourceReview {
  return {
    assetId: "source",
    reviewedAt: "2026-10-02T10:00:00Z",
    summary: "Source observations",
    captions: "unknown",
    captionNote: "",
    audio: "unknown",
    audioNote: "",
    moments,
    ...patch,
  };
}
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
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-02T10:00:00Z",
    clips: [clip()],
    transcript: [],
    proposedChanges: [],
    qualitySignals: [],
    revisions: [],
    ...patch,
  };
}

describe("literal project footage search", () => {
  it("maps observed source intervals through speed, each trim, and repeated footage", () => {
    const p = project({
      clips: [
        clip(),
        clip({
          id: "copy",
          start: 20,
          duration: 4,
          inPoint: 12,
          outPoint: 14,
          speed: 0.5,
        }),
      ],
      sourceReviews: [
        review([{ start: 11, end: 15, note: "A coffee cup is on the table." }]),
      ],
    });
    const matches = searchProjectFootage(p, [asset()], "coffee cup");
    expect(
      matches.map(
        ({ clipId, start, end, sourceStart, sourceEnd, evidence }) => ({
          clipId,
          start,
          end,
          sourceStart,
          sourceEnd,
          evidence,
        })
      )
    ).toEqual([
      {
        clipId: "clip",
        start: 5.5,
        end: 7.5,
        sourceStart: 11,
        sourceEnd: 15,
        evidence: "observed-scene",
      },
      {
        clipId: "copy",
        start: 20,
        end: 24,
        sourceStart: 12,
        sourceEnd: 14,
        evidence: "observed-scene",
      },
    ]);
  });

  it("omits moments outside trims and clamps source ends to outPoint, asset duration, and project end", () => {
    const p = project({
      duration: 7,
      clips: [clip({ outPoint: 13 })],
      sourceReviews: [
        review([
          { start: 0, end: 10, note: "Coffee cup before the trim" },
          { start: 13, end: 20, note: "Coffee cup after the trim" },
          { start: 12, end: 14, note: "Coffee cup partly retained" },
          { start: 39, end: 45, note: "Coffee cup outside the actual file" },
        ]),
      ],
    });
    const matches = searchProjectFootage(
      p,
      [asset({ duration: 13 })],
      "coffee cup"
    );
    // A review interval beyond actual duration is stale rather than silently repaired.
    expect(matches).toEqual([]);
    p.sourceReviews = [
      review([{ start: 12, end: 13, note: "Coffee cup retained" }]),
    ];
    expect(
      searchProjectFootage(p, [asset({ duration: 13 })], "coffee cup")[0]
    ).toMatchObject({
      start: 6,
      end: 6.5,
      sourceStart: 12,
      sourceEnd: 13,
    });
    p.clips[0].outPoint = 20;
    expect(searchProjectFootage(p, [asset()], "coffee cup")[0]).toMatchObject({
      start: 6,
      end: 6.5,
    });
    p.sourceReviews = [
      review([{ start: 12, end: 16, note: "Coffee cup crosses project end" }]),
    ];
    expect(searchProjectFootage(p, [asset()], "coffee cup")[0]).toMatchObject({
      start: 6,
      end: 7,
      sourceStart: 12,
      sourceEnd: 14,
    });
  });

  it("uses only exact transcript owners and never guesses footage for unsourced captions", () => {
    const p = project({
      clips: [clip(), clip({ id: "copy", start: 5 })],
      transcript: [
        {
          id: "owned",
          sourceClipId: "clip",
          start: 6,
          end: 7,
          text: "Pour coffee slowly",
        },
        { id: "unsourced", start: 6, end: 7, text: "Coffee appears unsourced" },
        {
          id: "old-owner",
          sourceClipId: "clip:split",
          start: 6,
          end: 7,
          text: "Coffee stale owner",
        },
        {
          id: "outside",
          sourceClipId: "clip",
          start: 11,
          end: 12,
          text: "Coffee outside source",
        },
      ],
    });
    const matches = searchProjectFootage(p, [asset()], "coffee");
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      clipId: "clip",
      evidence: "transcript",
      start: 6,
      end: 7,
      sourceStart: 12,
      sourceEnd: 14,
      snippet: "Pour coffee slowly",
    });
  });

  it("keeps hidden and muted source evidence searchable and identifies their playback state", () => {
    const p = project({
      clips: [clip({ hidden: true, muted: true })],
      sourceReviews: [review([{ start: 10, end: 12, note: "Coffee cup" }])],
      transcript: [
        {
          id: "cue",
          sourceClipId: "clip",
          start: 5,
          end: 6,
          text: "Coffee cup",
        },
      ],
    });
    const matches = searchProjectFootage(p, [asset()], "coffee cup");
    expect(matches.map(row => row.evidence)).toEqual([
      "transcript",
      "observed-scene",
    ]);
    expect(matches.every(row => row.hidden && row.muted)).toBe(true);
  });

  it("seeks to a retained timed phrase and excludes words trimmed out of the source clip", () => {
    const p = project({
      transcript: [
        {
          id: "words",
          sourceClipId: "clip",
          start: 4,
          end: 8,
          text: "Removed opener. Pour coffee slowly.",
          words: [
            { text: "Removed", start: 4, end: 4.3 },
            { text: "opener", start: 4.3, end: 4.9 },
            { text: "Pour", start: 6, end: 6.2 },
            { text: "coffee", start: 6.2, end: 6.6 },
            { text: "slowly", start: 6.6, end: 7 },
          ],
        },
      ],
    });
    expect(searchProjectFootage(p, [asset()], "removed")).toEqual([]);
    expect(
      searchProjectFootage(p, [asset()], "coffee slowly")[0]
    ).toMatchObject({
      start: 6.2,
      end: 7,
      sourceStart: 12.4,
      sourceEnd: 14,
      evidence: "transcript",
    });
  });

  it("distinguishes name matches from pixels and does not invent visual descriptions", () => {
    const p = project({ clips: [clip({ label: "Coffee cup take" })] });
    const matches = searchProjectFootage(
      p,
      [asset({ name: "coffee-cup.mp4" })],
      "coffee cup"
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      evidence: "clip-name",
      snippet: "Coffee cup take",
    });
    expect(searchProjectFootage(p, [asset()], "steam rising")).toEqual([]);
    p.sourceReviews = [review([], { summary: "Steam rising from a cup" })];
    expect(searchProjectFootage(p, [asset()], "steam rising")).toEqual([]);
  });

  it("drops missing, processing, failed, stale, and duration-unbound reviewed sources", () => {
    const p = project({
      sourceReviews: [review([{ start: 10, end: 12, note: "Coffee cup" }])],
    });
    expect(searchProjectFootage(p, [], "coffee")).toEqual([]);
    for (const status of ["processing", "failed"] as const)
      expect(searchProjectFootage(p, [asset({ status })], "coffee")).toEqual(
        []
      );
    expect(
      searchProjectFootage(p, [asset({ duration: undefined })], "coffee")
    ).toEqual([]);
    expect(
      searchProjectFootage(
        p,
        [asset({ createdAt: "2026-10-03T10:00:00Z" })],
        "coffee"
      )
    ).toEqual([]);
    p.sourceReviews = [
      review([{ start: 10, end: 12, note: "Coffee cup" }], {
        assetId: "old-source",
      }),
    ];
    expect(searchProjectFootage(p, [asset()], "coffee")).toEqual([]);
  });

  it("normalizes Unicode and punctuation, favors exact phrases, and treats query metacharacters literally", () => {
    const p = project({
      transcript: [
        {
          id: "scattered",
          sourceClipId: "clip",
          start: 5,
          end: 6,
          text: "Café beside another cup",
        },
        {
          id: "phrase",
          sourceClipId: "clip",
          start: 6,
          end: 7,
          text: "CAFÉ—cup",
        },
      ],
    });
    const matches = searchProjectFootage(p, [asset()], "ｃａｆé / CUP");
    expect(matches.map(row => row.start)).toEqual([6, 5]);
    expect(
      searchProjectFootage(p, [asset()], "cafe\u0301 (cup).*[a-z]")
    ).toEqual([]);
    expect(searchProjectFootage(p, [asset()], ".*\\[]^$ ; \u0000")).toEqual([]);
    expect(searchProjectFootage(p, [asset()], " ")).toEqual([]);
    expect(searchProjectFootage(p, [asset()], "café cup missing")).toEqual([]);
  });

  it("deduplicates normalized repeated observations and preserves stable result ids", () => {
    const p = project({
      sourceReviews: [
        review([
          { start: 10, end: 12, note: "Coffee—cup." },
          { start: 10, end: 12, note: "coffee cup" },
        ]),
      ],
    });
    const first = searchProjectFootage(p, [asset()], "coffee");
    expect(first).toHaveLength(1);
    expect(searchProjectFootage(p, [asset()], "cup")[0].id).toBe(first[0].id);
    p.sourceReviews!.push(
      review([{ start: 10, end: 12, note: "Coffee cup beside spoon" }], {
        reviewedAt: "2026-10-03T10:00:00Z",
      })
    );
    const latest = searchProjectFootage(p, [asset()], "spoon");
    expect(latest).toHaveLength(1);
    expect(latest[0].snippet).toBe("Coffee cup beside spoon");
  });

  it("bounds query processing and returned matches on a large project", () => {
    const p = project({
      duration: 2000,
      clips: Array.from({ length: 1200 }, (_, i) =>
        clip({
          id: `clip-${String(i).padStart(4, "0")}`,
          start: i,
          duration: 1,
          inPoint: 10,
          outPoint: 12,
        })
      ),
    });
    p.sourceReviews = [review([{ start: 10, end: 12, note: "Coffee cup" }])];
    const matches = searchProjectFootage(p, [asset()], "coffee");
    expect(matches).toHaveLength(PROJECT_FOOTAGE_SEARCH_LIMITS.results);
    expect(matches[0].clipId).toBe("clip-0000");
    expect(matches.at(-1)?.clipId).toBe("clip-0049");
    expect(
      searchProjectFootage(p, [asset()], `${" ".repeat(500)}coffee`)
    ).toEqual([]);
    // Unicode normalization is bounded before expensive candidate work.
    expect(
      searchProjectFootage(p, [asset()], `${"noise ".repeat(100)}coffee`)
    ).toEqual([]);
  });
});
