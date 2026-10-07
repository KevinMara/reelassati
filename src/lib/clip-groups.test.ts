import { describe, expect, it } from "vitest";
import {
  expandLinkedSelection,
  groupClips,
  ungroupClips,
  linkClips,
  unlinkClips,
  normalizeClipGroups,
  splitGrouping,
  remapPastedGrouping,
} from "@contracts/clip-groups";
import type { TimelineClip } from "@contracts/workspace";

const clip = (id: string, extra: Partial<TimelineClip> = {}): TimelineClip => ({
  id,
  label: id,
  track: "video",
  assetId: "source",
  lane: 1,
  start: 0,
  duration: 4,
  inPoint: 10,
  outPoint: 14,
  locked: false,
  color: "#ffffff",
  ...extra,
});
const ids = (prefix: string) => {
  let n = 0;
  return () => `${prefix}-${++n}`;
};
const av = () => ({
  clips: [
    clip("v", { linkId: "original-av" }),
    clip("a", { track: "audio", linkId: "original-av" }),
  ],
});
const halves = (c: TimelineClip) => ({
  original: c,
  pieces: [
    { ...c, duration: 2, outPoint: 12 },
    { ...c, id: `${c.id}-after`, start: 2, duration: 2, inPoint: 12 },
  ],
});

describe("persistent timeline groups and AV links", () => {
  it("merges complete existing groups, not just the clicked members", () => {
    const project = {
      clips: [
        clip("a", { groupId: "first" }),
        clip("b", { groupId: "first" }),
        clip("c", { groupId: "second" }),
        clip("d", { groupId: "second" }),
        clip("outside"),
      ],
    };
    const merged = groupClips(project, ["b", "c"], ids("group"));
    expect(merged.clips.slice(0, 4).map(c => c.groupId)).toEqual(
      Array(4).fill("group-1")
    );
    expect(merged.clips[4].groupId).toBeUndefined();
    expect(project.clips[0].groupId).toBe("first");
  });
  it("selects through a group and a link, with an explicit direct-clip option", () => {
    const project = {
      clips: [
        ...av().clips.map(c =>
          c.id === "v" ? { ...c, groupId: "bundle" } : c
        ),
        clip("title", {
          assetId: undefined,
          track: "overlay",
          groupId: "bundle",
          graphic: {
            kind: "text",
            text: "Hello",
            x: 50,
            y: 50,
            size: 6,
            color: "#ffffff",
            background: "#000000",
            animation: "none",
            from: 0,
            to: 1,
            prefix: "",
            suffix: "",
          },
        }),
      ],
    };
    expect(expandLinkedSelection(project, ["title"])).toEqual([
      "title",
      "v",
      "a",
    ]);
    expect(
      expandLinkedSelection(project, ["v"], { groups: false, links: true })
    ).toEqual(["v", "a"]);
    expect(
      expandLinkedSelection(project, ["v"], { groups: true, links: false })
    ).toEqual(["v", "title"]);
    expect(
      expandLinkedSelection(project, ["title"], { groups: false, links: false })
    ).toEqual(["title"]);
    expect(expandLinkedSelection(project, ["missing"])).toEqual([]);
  });
  it("ungroups selected members and removes singleton residue, preserving independent links", () => {
    const project = {
      clips: [
        ...av().clips.map(c => ({ ...c, groupId: "bundle" })),
        clip("title", { groupId: "bundle" }),
      ],
    };
    const partial = ungroupClips(project, ["title"]);
    expect(partial.clips.map(c => c.groupId)).toEqual([
      "bundle",
      "bundle",
      undefined,
    ]);
    expect(partial.clips.slice(0, 2).map(c => c.linkId)).toEqual([
      "original-av",
      "original-av",
    ]);
    const removed = ungroupClips(partial, ["v"]);
    expect(removed.clips.every(c => !c.groupId)).toBe(true);
    expect(removed.clips[1].linkId).toBe("original-av");
  });
  it("cleans malformed, singleton, invalid-link and generated-handle memberships", () => {
    const project = {
      clips: [
        clip("a", { groupId: "one", linkId: "solo" }),
        clip("b", { groupId: "   " }),
        clip("handle", {
          transitionHandle: true,
          groupId: "one",
          linkId: "solo",
        }),
        clip("x", { linkId: "two-videos" }),
        clip("y", { linkId: "two-videos" }),
      ],
    };
    expect(
      normalizeClipGroups(project).clips.every(c => !c.groupId && !c.linkId)
    ).toBe(true);
    const valid = av();
    expect(normalizeClipGroups(valid)).toBe(valid);
  });
  it("links only aligned explicit AV, including a different recorded audio asset", () => {
    const project = {
      clips: [
        clip("v"),
        clip("voice", {
          track: "audio",
          assetId: "voice",
          inPoint: 0,
          outPoint: 4,
        }),
      ],
    };
    const linked = linkClips(project, ["v", "voice"], ids("link"));
    expect(linked.clips.map(c => c.linkId)).toEqual(["link-1", "link-1"]);
    expect(unlinkClips(linked, ["v"]).clips.every(c => !c.linkId)).toBe(true);
    expect(() =>
      linkClips(
        { clips: [clip("v"), clip("a", { track: "audio", start: 1 })] },
        ["v", "a"],
        ids("bad")
      )
    ).toThrow(/matching timeline/);
    expect(() =>
      linkClips(
        {
          clips: [
            clip("v"),
            clip("a", { track: "audio", inPoint: 9, outPoint: 13 }),
          ],
        },
        ["v", "a"],
        ids("bad")
      )
    ).toThrow(/compatible source/);
    expect(() =>
      linkClips({ clips: [clip("v"), clip("w")] }, ["v", "w"], ids("bad"))
    ).toThrow(/video and audio/);
  });
  it("merges existing links without silently dropping an unselected member", () => {
    const project = {
      clips: [
        ...av().clips,
        clip("separate-audio", {
          track: "audio",
          assetId: "other",
          inPoint: 0,
          outPoint: 4,
        }),
      ],
    };
    const linked = linkClips(
      project,
      ["v", "separate-audio"],
      ids("merged-link")
    );
    expect(linked.clips.map(c => c.linkId)).toEqual(
      Array(3).fill("merged-link-1")
    );
  });
  it("guards locked affected members, including singleton cleanup", () => {
    expect(() =>
      groupClips(
        {
          clips: [
            clip("a", { groupId: "g", locked: true }),
            clip("b", { groupId: "g" }),
            clip("c"),
          ],
        },
        ["b", "c"],
        ids("g")
      )
    ).toThrow(/Unlock/);
    expect(() =>
      ungroupClips(
        {
          clips: [
            clip("a", { groupId: "g" }),
            clip("b", { groupId: "g", locked: true }),
          ],
        },
        ["a"]
      )
    ).toThrow(/Unlock/);
    expect(() =>
      unlinkClips(
        { clips: [av().clips[0], { ...av().clips[1], locked: true }] },
        ["v"]
      )
    ).toThrow(/Unlock/);
    expect(() =>
      linkClips(
        { clips: [clip("v"), clip("a", { track: "audio", locked: true })] },
        ["v", "a"],
        ids("link")
      )
    ).toThrow(/Unlock/);
  });
  it("does not add groups to generated handles or transition-associated shots", () => {
    expect(() =>
      groupClips(
        { clips: [clip("handle", { transitionHandle: true }), clip("other")] },
        ["handle", "other"],
        ids("g")
      )
    ).toThrow(/handles/);
    const transition = {
      outgoingId: "out",
      incomingId: "in",
      incomingEntrance: { kind: "none" as const, duration: 0.5 },
      outgoingExit: { kind: "none" as const, duration: 0.5 },
    };
    expect(() =>
      groupClips(
        {
          clips: [
            clip("out"),
            clip("in", { shotTransition: transition }),
            clip("extra"),
          ],
        },
        ["out", "extra"],
        ids("g")
      )
    ).toThrow(/Remove the transition/);
  });
  it("requires real selections and fresh identifiers", () => {
    expect(() =>
      groupClips({ clips: [clip("a"), clip("b")] }, ["a", "missing"], ids("g"))
    ).toThrow(/still on/);
    expect(() =>
      groupClips({ clips: [clip("a"), clip("b")] }, ["a", "b"], () => "a")
    ).toThrow(/fresh unique/);
  });
});

describe("structural group and linked AV projection", () => {
  it("links before video only to before audio and after only to after", () => {
    const project = av();
    const result = splitGrouping(
      project,
      project.clips.map(halves),
      ids("split-link")
    );
    expect(result.clips.map(c => [c.id, c.linkId])).toEqual([
      ["v", "original-av"],
      ["v-after", "split-link-1"],
      ["a", "original-av"],
      ["a-after", "split-link-1"],
    ]);
    expect(expandLinkedSelection(result, ["v"], { groups: false })).toEqual([
      "v",
      "a",
    ]);
    expect(
      expandLinkedSelection(result, ["a-after"], { groups: false })
    ).toEqual(["a-after", "v-after"]);
    expect(project.clips).toHaveLength(2);
  });
  it("retains a whole persistent group while partitioning its independent AV links", () => {
    const project = {
      clips: [
        ...av().clips.map(c => ({ ...c, groupId: "bundle" })),
        clip("title", { groupId: "bundle" }),
      ],
    };
    const result = splitGrouping(
      project,
      project.clips.slice(0, 2).map(halves),
      ids("split-link")
    );
    expect(result.clips.every(c => c.groupId === "bundle")).toBe(true);
    expect(
      result.clips.filter(c => c.linkId === "split-link-1").map(c => c.id)
    ).toEqual(["v-after", "a-after"]);
  });
  it("clears a one-sided link instead of pairing a half with full-length audio", () => {
    const result = splitGrouping(av(), [halves(av().clips[0])], ids("unused"));
    expect(result.clips.every(c => !c.linkId)).toBe(true);
  });
  it("prevents a split from indirectly unlinking a locked uncut partner", () => {
    const project = {
      clips: [av().clips[0], { ...av().clips[1], locked: true }],
    };
    expect(() =>
      splitGrouping(project, [halves(project.clips[0])], ids("split"))
    ).toThrow(/Unlock/);
  });
  it("rejects duplicate piece identifiers and generated transition pieces", () => {
    const source = clip("source");
    const duplicate = halves(source);
    duplicate.pieces[1].id = source.id;
    expect(() =>
      splitGrouping({ clips: [source] }, [duplicate], ids("g"))
    ).toThrow(/unique clip/);
    expect(() =>
      splitGrouping(
        { clips: [source] },
        [{ original: source, pieces: [{ ...source, transitionHandle: true }] }],
        ids("g")
      )
    ).toThrow(/generated transition/);
  });
  it("copies complete relationships under fresh IDs, isolated from originals", () => {
    const source = av().clips.map(c => ({ ...c, groupId: "original-group" }));
    const copied = remapPastedGrouping(
      source,
      source.map(c => ({ ...c, id: `copy-${c.id}`, start: 8 })),
      ids("copy-membership"),
      source
    );
    expect(copied.map(c => c.groupId)).toEqual([
      "copy-membership-1",
      "copy-membership-1",
    ]);
    expect(copied.map(c => c.linkId)).toEqual([
      "copy-membership-2",
      "copy-membership-2",
    ]);
    const project = { clips: [...source, ...copied] };
    expect(expandLinkedSelection(project, ["copy-v"])).toEqual([
      "copy-v",
      "copy-a",
    ]);
    expect(expandLinkedSelection(project, ["v"])).toEqual(["v", "a"]);
  });
  it("drops partial copied memberships without retaining original IDs", () => {
    const source = { ...av().clips[0], groupId: "original-group" };
    const [copy] = remapPastedGrouping(
      [source],
      [{ ...source, id: "copy-v" }],
      () => {
        throw new Error("No new membership needed");
      }
    );
    expect(copy.groupId).toBeUndefined();
    expect(copy.linkId).toBeUndefined();
  });
  it("keeps a copied two-member subset grouped independently from a larger source group", () => {
    const originals = [
      clip("a", { groupId: "g" }),
      clip("b", { groupId: "g" }),
      clip("c", { groupId: "g" }),
    ];
    const source = originals.slice(0, 2);
    const copies = remapPastedGrouping(
      source,
      source.map(c => ({ ...c, id: `copy-${c.id}` })),
      ids("fresh"),
      originals
    );
    expect(copies.map(c => c.groupId)).toEqual(["fresh-1", "fresh-1"]);
    expect(originals.map(c => c.groupId)).toEqual(["g", "g", "g"]);
  });
  it("rejects copy identifiers that collide with originals or existing relations", () => {
    const source = av().clips;
    expect(() => remapPastedGrouping(source, source, ids("g"))).toThrow(
      /fresh unique clip/
    );
    expect(() =>
      remapPastedGrouping(
        source,
        source.map(c => ({ ...c, id: `copy-${c.id}` })),
        () => "original-av"
      )
    ).toThrow(/fresh unique/);
  });
});
