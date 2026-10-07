import { describe, expect, it } from "vitest";
import type {
  Asset,
  EditOperation,
  EditProject,
  TimelineClip,
} from "@contracts/workspace";
import { linkClips } from "@contracts/clip-groups";
import { applyAdjacentTransition } from "@contracts/adjacent-transition";
import {
  deleteClipGroup,
  detachClipAudio,
  moveClipGroup,
  pasteClipGroup,
  replaceTimelineClip,
  splitClipGroup,
} from "./editor-manual";
import {
  applyEditOperation,
  resizeTimeline,
  rippleRemove,
} from "./edit-timeline";

const clip = (id: string, extra: Partial<TimelineClip> = {}): TimelineClip => ({
  id,
  track: "video",
  assetId: "source",
  label: id,
  start: 4,
  duration: 8,
  inPoint: 0,
  outPoint: 8,
  lane: 1,
  color: "#ffffff",
  locked: false,
  ...extra,
});
const project = (clips: TimelineClip[]): EditProject => ({
  id: "p",
  title: "Test",
  template: "blank",
  status: "editing",
  platform: "instagram",
  aspectRatio: "9:16",
  duration: 30,
  playhead: 0,
  createdAt: "now",
  updatedAt: "now",
  clips,
  transcript: [
    {
      id: "cue",
      text: "Hello world",
      start: 6,
      end: 8,
      sourceClipId: "a",
      words: [
        { text: "Hello", start: 6, end: 7 },
        { text: "world", start: 7, end: 8 },
      ],
    },
  ],
  proposedChanges: [],
  qualitySignals: [],
  revisions: [],
});
const linked = (audio: Partial<TimelineClip> = {}) =>
  linkClips(
    project([clip("v"), clip("a", { track: "audio", ...audio })]),
    ["v", "a"],
    () => "av-link"
  );
const ids = () => {
  let count = 0;
  return () => `fresh-${++count}`;
};
const operation = (extra: Partial<EditOperation> = {}): EditOperation => ({
  id: "edit",
  type: "split",
  start: 7,
  end: 8,
  label: "Edit",
  reason: "Test",
  confidence: 1,
  status: "proposed",
  intensity: "balanced",
  targetClipIds: ["v", "a"],
  ...extra,
});

describe("manual operations preserve explicit AV links", () => {
  it("links detached audio and moves or deletes either member together", () => {
    const p = project([clip("v")]);
    p.transcript = p.transcript.map(c => ({ ...c, sourceClipId: "v" }));
    const detached = detachClipAudio(
      p,
      "v",
      [{ id: "source", kind: "video" } as Asset],
      "a"
    );
    expect(detached.clips[0].linkId).toBe(detached.clips[1].linkId);
    const moved = moveClipGroup(detached, ["a"], "a", 7, 2);
    expect(moved.clips.map(c => c.start)).toEqual([7, 7]);
    expect(moved.clips[0]).toMatchObject({ primaryFootage: true, lane: 1 });
    expect(moved.transcript[0]).toMatchObject({
      sourceClipId: "a",
      start: 9,
      end: 11,
    });
    expect(deleteClipGroup(detached, ["v"]).clips).toEqual([]);
    expect(deleteClipGroup(detached, ["a"]).transcript).toEqual([]);
  });
  it("still detaches source audio on a transitioned shot without introducing a forbidden edit link", () => {
    const p = project([
      clip("v"),
      clip("next", { start: 12, inPoint: 2, outPoint: 10 }),
    ]);
    const assets = [
      { id: "source", kind: "video", status: "ready", duration: 20 },
    ] as Asset[];
    const transitioned = applyAdjacentTransition(
      p,
      assets,
      "v",
      "next",
      "dissolve",
      0.4
    );
    const detached = detachClipAudio(transitioned, "v", assets, "a");
    expect(detached.clips.find(c => c.id === "v")?.muted).toBe(true);
    expect(detached.clips.find(c => c.id === "a")).toMatchObject({
      track: "audio",
      start: 4,
      duration: 8,
    });
    expect(detached.clips.find(c => c.id === "a")?.linkId).toBeUndefined();
    expect(detached.clips.filter(c => c.transitionHandle)).toHaveLength(2);
  });
  it("splits both source clocks, partitions AV pairs, and preserves a persistent group", () => {
    const p = linked();
    p.clips = p.clips.map(c => ({ ...c, groupId: "collection" }));
    const split = splitClipGroup(p, ["v"], 7, ids()).project;
    expect(split.clips).toHaveLength(4);
    const before = split.clips.filter(c => c.start === 4),
      after = split.clips.filter(c => c.start === 7);
    expect(new Set(before.map(c => c.linkId)).size).toBe(1);
    expect(new Set(after.map(c => c.linkId)).size).toBe(1);
    expect(after[0].linkId).not.toBe(before[0].linkId);
    expect(split.clips.every(c => c.groupId === "collection")).toBe(true);
    expect(split.transcript.map(c => c.text)).toEqual(["Hello", "world"]);
    expect(split.transcript.map(c => c.sourceClipId)).toEqual([
      "a",
      after.find(c => c.track === "audio")!.id,
    ]);
  });
  it("copies links and groups under fresh identities, while isolated copies stay independent", () => {
    const p = linked();
    p.clips = p.clips.map(c => ({ ...c, groupId: "collection" }));
    const pasted = pasteClipGroup(p, p.clips, 16, ids()).project;
    const copies = pasted.clips.slice(2);
    expect(copies[0].linkId).toBe(copies[1].linkId);
    expect(copies[0].groupId).toBe(copies[1].groupId);
    expect(copies[0].linkId).not.toBe("av-link");
    expect(copies[0].groupId).not.toBe("collection");
    expect(deleteClipGroup(pasted, [copies[0].id]).clips).toEqual(p.clips);
    const isolated = pasteClipGroup(p, [p.clips[0]], 16, ids()).project
      .clips[2];
    expect(isolated.linkId).toBeUndefined();
    expect(isolated.groupId).toBeUndefined();
  });
  it("retimes linked AV and owned measured words once, and keeps style edits local", () => {
    const p = linked();
    const trimmed = replaceTimelineClip(p, "v", {
      ...p.clips[0],
      start: 10,
      duration: 3,
      inPoint: 2,
      outPoint: 8,
      speed: 2,
    });
    expect(
      trimmed.clips.map(c => [
        c.start,
        c.duration,
        c.inPoint,
        c.outPoint,
        c.speed,
      ])
    ).toEqual([
      [10, 3, 2, 8, 2],
      [10, 3, 2, 8, 2],
    ]);
    expect(trimmed.clips[0].linkId).toBe(trimmed.clips[1].linkId);
    expect(trimmed.transcript[0]).toMatchObject({
      start: 10,
      end: 11,
      sourceClipId: "a",
    });
    expect(trimmed.transcript[0].words).toEqual([
      { text: "Hello", start: 10, end: 10.5 },
      { text: "world", start: 10.5, end: 11 },
    ]);
    const styled = replaceTimelineClip(p, "v", {
      ...p.clips[0],
      brightness: 0.1,
      label: "Picture",
    });
    expect(styled.clips[1]).toEqual(p.clips[1]);
    expect(styled.transcript).toEqual(p.transcript);
  });
  it("uses each different source clock and rejects an unmeasured extension atomically", () => {
    const p = linked({ assetId: "speech", inPoint: 3, outPoint: 19, speed: 2 });
    const trimmed = replaceTimelineClip(p, "v", {
      ...p.clips[0],
      inPoint: 2,
      duration: 6,
    });
    expect(trimmed.clips[1]).toMatchObject({
      inPoint: 7,
      outPoint: 19,
      speed: 2,
      duration: 6,
    });
    const extension = { ...p.clips[0], duration: 10, outPoint: 10 };
    expect(() => replaceTimelineClip(p, "v", extension)).toThrow(
      /measured bounds/
    );
    expect(p.clips[1]).toMatchObject({ duration: 8, outPoint: 19 });
    const extended = replaceTimelineClip(p, "v", extension, [
      { id: "source", duration: 12 },
      { id: "speech", duration: 30 },
    ] as Asset[]);
    expect(extended.clips[1]).toMatchObject({ duration: 10, outPoint: 23 });
    expect(extended.clips[0].linkId).toBe(extended.clips[1].linkId);
  });
  it("guards locked peers and clears the old link and speech evidence on source replacement", () => {
    const p = linked();
    p.clips[1].locked = true;
    expect(() => moveClipGroup(p, ["v"], "v", 8, 1)).toThrow(/Unlock/);
    expect(() => deleteClipGroup(p, ["v"])).toThrow(/Unlock/);
    expect(() => splitClipGroup(p, ["v"], 7, ids())).toThrow(/Unlock/);
    expect(() =>
      replaceTimelineClip(p, "v", { ...p.clips[0], start: 8 })
    ).toThrow(/Unlock/);
    expect(() =>
      replaceTimelineClip(p, "v", { ...p.clips[0], assetId: "other" })
    ).toThrow(/Unlock/);
    p.clips[1].locked = false;
    const changed = replaceTimelineClip(p, "a", {
      ...p.clips[1],
      assetId: "other",
    });
    expect(changed.clips.every(c => !c.linkId)).toBe(true);
    expect(changed.transcript).toEqual([]);
  });
  it("normalizes a remaining singleton group after deletion and preserves primary footage on a lane move", () => {
    const p = project([
      clip("v", { groupId: "g" }),
      clip("upper", { lane: 2, groupId: "g" }),
    ]);
    const deleted = deleteClipGroup(p, ["upper"]);
    expect(deleted.clips[0].groupId).toBeUndefined();
    expect(moveClipGroup(p, ["v"], "v", 4, 3).clips[0]).toMatchObject({
      lane: 3,
      primaryFootage: true,
    });
  });
});

describe("structural executor keeps linked clocks and exact targets", () => {
  it("rejects one-sided AI timing, deletion and partial look changes without expanding IDs", () => {
    const p = linked();
    for (const type of [
      "trim",
      "move",
      "pacing",
      "split",
      "delete",
      "style",
      "audio",
    ] as const) {
      const op = operation({
        type,
        targetClipIds: ["v"],
        parameters: { sourceIn: 1, destination: 8, speed: 2, brightness: 0.1 },
      });
      expect(() => applyEditOperation(p, op)).toThrow(
        /Include linked audio or unlink first/
      );
      expect(op.targetClipIds).toEqual(["v"]);
      expect(p.clips.map(c => c.start)).toEqual([4, 4]);
    }
    const styled = applyEditOperation(
      p,
      operation({
        type: "style",
        start: 4,
        end: 12,
        targetClipIds: ["v"],
        parameters: { brightness: 0.1 },
      })
    );
    expect(styled.clips[0].brightness).toBe(0.1);
    expect(styled.clips[1].brightness).toBeUndefined();
    expect(styled.clips[0].linkId).toBe(styled.clips[1].linkId);
  });
  it("retains valid explicit pairs through trim, movement and pacing and projects words once", () => {
    const p = linked();
    for (const op of [
      operation({
        type: "trim",
        start: 5,
        end: 11,
        parameters: { sourceIn: 1 },
      }),
      operation({ type: "move", parameters: { destination: 8 } }),
      operation({ type: "pacing", parameters: { speed: 2 } }),
    ]) {
      const changed = applyEditOperation(p, op);
      expect(changed.clips[0].linkId).toBe("av-link");
      expect(changed.clips[1].linkId).toBe("av-link");
      expect(changed.clips[0].start).toBe(changed.clips[1].start);
      expect(changed.clips[0].duration).toBe(changed.clips[1].duration);
      expect(changed.transcript[0].words?.[0].start).toBe(
        changed.transcript[0].start
      );
    }
    expect(applyEditOperation(p, operation({ type: "delete" })).clips).toEqual(
      []
    );
    expect(
      applyEditOperation(p, operation({ type: "delete" })).transcript
    ).toEqual([]);
  });
  it("splits and segments complete AV pairs under distinct per-span links with persistent groups", () => {
    const p = linked();
    p.clips = p.clips.map(c => ({ ...c, groupId: "collection" }));
    for (const op of [
      operation(),
      operation({
        type: "style",
        start: 6,
        end: 8,
        parameters: { brightness: 0.1 },
      }),
    ]) {
      const changed = applyEditOperation(p, op);
      const families = new Map<string, TimelineClip[]>();
      for (const c of changed.clips)
        families.set(c.linkId!, [...(families.get(c.linkId!) ?? []), c]);
      expect(families.size).toBe(op.type === "split" ? 2 : 3);
      for (const [id, members] of families) {
        expect(id).toBeTruthy();
        expect(members).toHaveLength(2);
        expect(members[0].start).toBe(members[1].start);
        expect(members[0].duration).toBe(members[1].duration);
      }
      expect(changed.clips.every(c => c.groupId === "collection")).toBe(true);
      expect(
        changed.transcript.every(c =>
          changed.clips.some(
            clip => clip.id === c.sourceClipId && clip.track === "audio"
          )
        )
      ).toBe(true);
    }
  });
  it("rejects locked explicit peers and unequal source-bound trims instead of silently unlinking", () => {
    const p = linked();
    p.clips[1].locked = true;
    expect(() => applyEditOperation(p, operation())).toThrow(/Unlock linked/);
    const different = linked({
      assetId: "speech",
      inPoint: 3,
      outPoint: 19,
      speed: 2,
    });
    expect(() =>
      applyEditOperation(
        different,
        operation({
          type: "trim",
          start: 4,
          end: 11,
          parameters: { sourceIn: 3 },
        })
      )
    ).toThrow(/matching valid timing/);
    expect(different.clips.every(c => c.linkId === "av-link")).toBe(true);
  });
  it("ripple-removes both AV clocks, partitions before/after links, and retains caption ownership", () => {
    const p = linked();
    p.clips = p.clips.map(c => ({ ...c, groupId: "collection" }));
    p.transcript = [
      {
        id: "spoken",
        sourceClipId: "a",
        text: "Before cut after",
        start: 4,
        end: 12,
        words: [
          { text: "Before", start: 4, end: 5 },
          { text: "cut", start: 6, end: 7 },
          { text: "after", start: 9, end: 10 },
        ],
      },
    ];
    const cut = rippleRemove(p, 6, 8);
    expect(cut.clips).toHaveLength(4);
    const before = cut.clips.filter(c => c.start === 4),
      after = cut.clips.filter(c => c.start === 6);
    expect(before[0].linkId).toBe(before[1].linkId);
    expect(after[0].linkId).toBe(after[1].linkId);
    expect(after[0].linkId).not.toBe(before[0].linkId);
    expect(cut.clips.every(c => c.groupId === "collection")).toBe(true);
    expect(cut.transcript.map(c => c.text)).toEqual(["Before", "after"]);
    expect(cut.transcript[1]).toMatchObject({
      sourceClipId: "a-after-8",
      words: [{ text: "after", start: 7, end: 8 }],
    });
    const silence = applyEditOperation(
      p,
      operation({ type: "silence", start: 6, end: 8, targetClipIds: ["v"] })
    );
    expect(silence.clips.every(c => c.linkId)).toBe(true);
  });
  it("normalizes fully removed families and keeps links when resizing every track", () => {
    const p = linked();
    p.clips = p.clips.map(c => ({ ...c, groupId: "collection" }));
    p.clips.push(clip("later", { start: 20, groupId: "collection" }));
    const removed = rippleRemove(p, 4, 12);
    expect(removed.clips).toHaveLength(1);
    expect(removed.clips[0]).toMatchObject({ id: "later", start: 12 });
    expect(removed.clips[0].groupId).toBeUndefined();
    const resized = resizeTimeline(p, 7);
    expect(resized.clips).toHaveLength(2);
    expect(
      resized.clips.every(c => c.duration === 3 && c.linkId === "av-link")
    ).toBe(true);
    expect(resized.clips.every(c => c.groupId === "collection")).toBe(true);
  });
});
