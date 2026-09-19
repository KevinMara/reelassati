import { afterEach, describe, expect, it, vi } from "vitest";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import type { EditorChatAction } from "@contracts/editor-chat";
import {
  applyChatAction,
  canRunChatAction,
  insertChatAsset,
  mapChatTranscript,
  recordChatEdit,
} from "@/lib/editor-chat-execution";

const action = (patch: Partial<EditorChatAction> = {}) =>
  ({
    id: "a",
    kind: "seek",
    time: 1,
    label: "Go to opening",
    reason: "Requested",
    scope: "requested",
    requestExcerpt: "Go to opening",
    credits: 0,
    status: "pending",
    dependsOn: [],
    ...patch,
  }) as EditorChatAction;
const project = () =>
  ({
    id: "project",
    updatedAt: "2026-09-19T12:00:00.000Z",
    duration: 20,
    clips: [],
    transcript: [],
    proposedChanges: [],
    revisions: [],
    playhead: 0,
    aspectRatio: "9:16",
  }) as unknown as EditProject;

afterEach(() => vi.useRealTimers());

describe("chat action scheduling", () => {
  it("runs explicitly requested and necessary actions without asking, while gating extras", () => {
    expect(canRunChatAction(action(), [], "ask", 0)).toBe(true);
    expect(canRunChatAction(action({ scope: "necessary" }), [], "ask", 0)).toBe(
      true
    );
    expect(canRunChatAction(action({ scope: "extra" }), [], "ask", 0)).toBe(
      false
    );
    expect(
      canRunChatAction(
        action({ scope: "extra", runtime: { approved: true } }),
        [],
        "ask",
        0
      )
    ).toBe(true);
  });
  it("automatic extras still respect the remaining credit cap", () => {
    const optional = action({ scope: "extra", credits: 20 });
    expect(canRunChatAction(optional, [], "auto", 19)).toBe(false);
    expect(canRunChatAction(optional, [], "auto", 20)).toBe(true);
  });
  it("waits for completed dependencies, not skipped or failed dependencies", () => {
    const dependent = action({ id: "after", dependsOn: ["before"] });
    for (const status of [
      "pending",
      "failed",
      "skipped",
      "interrupted",
    ] as const) {
      expect(
        canRunChatAction(
          dependent,
          [action({ id: "before", status })],
          "auto",
          100
        )
      ).toBe(false);
    }
    expect(
      canRunChatAction(
        dependent,
        [action({ id: "before", status: "completed" })],
        "auto",
        100
      )
    ).toBe(true);
  });
  it("rejects corrupt persisted prices instead of increasing the run budget", () => {
    expect(canRunChatAction(action({ credits: -10 }), [], "auto", 0)).toBe(
      false
    );
    expect(canRunChatAction(action({ credits: 0.1 }), [], "auto", 1)).toBe(
      false
    );
    expect(canRunChatAction(action(), [], "auto", Number.NaN)).toBe(false);
  });
});

describe("chat timeline execution", () => {
  it("adds a very short sound once at the requested time, without changing other media", () => {
    const source = project();
    const asset = {
      id: "sound",
      name: "Tick",
      kind: "audio",
      status: "ready",
      duration: 0.126032,
    } as Asset;
    const first = insertChatAsset(source, asset, "insert-sound", 3.75);
    expect(first.clips[0]).toMatchObject({
      start: 3.75,
      duration: 0.126032,
      track: "audio",
    });
    expect(insertChatAsset(first, asset, "insert-sound", 3.75)).toBe(first);
    expect(source.clips).toEqual([]);
  });
  it("maps trimmed and retimed source words to the visible clip without muted duplicates", () => {
    const source = project();
    const clip = {
      id: "clip",
      assetId: "video",
      start: 10,
      duration: 3,
      inPoint: 2,
      outPoint: 8,
      speed: 2,
      track: "video",
    } as TimelineClip;
    source.clips = [clip, { ...clip, id: "muted", muted: true }];
    const mapped = mapChatTranscript(source, "video", [
      { id: "outside", start: 0, end: 2, text: "Outside" },
      { id: "inside", start: 3, end: 5, text: "Inside" },
      { id: "edge", start: 7, end: 10, text: "End" },
    ]);
    expect(
      mapped.map(({ start, end, text }) => ({ start, end, text }))
    ).toEqual([
      { start: 10.5, end: 11.5, text: "Inside" },
      { start: 12.5, end: 13, text: "End" },
    ]);
  });
  it("marks undo as a new timeline version so a concurrent old plan becomes stale", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-19T12:00:02.000Z"));
    const before = project();
    const changed = recordChatEdit(
      before,
      { ...before, aspectRatio: "1:1" },
      "ratio",
      "Square"
    );
    vi.setSystemTime(new Date("2026-09-19T12:00:03.000Z"));
    const undone = applyChatAction(
      changed,
      action({ kind: "history", direction: "undo" }),
      []
    );
    expect(undone.aspectRatio).toBe("9:16");
    expect(undone.updatedAt).not.toBe(changed.updatedAt);
    expect(undone.revisions).toHaveLength(2);
  });
});

describe("story section clip division", () => {
  it("cuts source offsets at evidence boundaries, preserves outer fades and leaves upper layers and locked clips alone", () => {
    const source = project();
    const base = {
      id: "main",
      assetId: "video",
      label: "Original",
      track: "video",
      lane: 1,
      start: 0,
      duration: 10,
      inPoint: 2,
      outPoint: 22,
      speed: 2,
      fadeIn: 0.3,
      fadeOut: 0.4,
    } as TimelineClip;
    source.clips = [
      base,
      { ...base, id: "upper", lane: 2 },
      { ...base, id: "locked", locked: true },
    ];
    const beats = [
      {
        id: "hook",
        kind: "hook",
        label: "Hook",
        start: 0,
        end: 3,
        evidenceIds: ["word1"],
      },
      {
        id: "body",
        kind: "body",
        label: "Body",
        start: 3,
        end: 10,
        evidenceIds: ["word2"],
      },
    ];
    const split = applyChatAction(
      source,
      action({
        kind: "story-beats",
        beats,
        splitClips: true,
      } as Partial<EditorChatAction>),
      []
    );
    expect(
      split.clips
        .slice(0, 2)
        .map(c => ({
          start: c.start,
          duration: c.duration,
          inPoint: c.inPoint,
          outPoint: c.outPoint,
          fadeIn: c.fadeIn,
          fadeOut: c.fadeOut,
          label: c.label,
        }))
    ).toEqual([
      {
        start: 0,
        duration: 3,
        inPoint: 2,
        outPoint: 8,
        fadeIn: 0.3,
        fadeOut: 0,
        label: "Hook",
      },
      {
        start: 3,
        duration: 7,
        inPoint: 8,
        outPoint: 22,
        fadeIn: 0,
        fadeOut: 0.4,
        label: "Body",
      },
    ]);
    expect(split.clips.slice(2)).toEqual(source.clips.slice(1));
    expect(source.clips).toHaveLength(3);
    expect(split.revisions).toHaveLength(2);
  });
});
