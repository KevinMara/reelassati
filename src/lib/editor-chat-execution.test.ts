import { afterEach, describe, expect, it, vi } from "vitest";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import type { EditorChatAction } from "@contracts/editor-chat";
import { normalizeVisual } from "@contracts/clip-visual";
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
  it("retains only visible measured words when the clip trims both ends of a cue", () => {
    const source = project();
    source.clips = [
      {
        id: "clip",
        assetId: "video",
        track: "video",
        start: 10,
        duration: 1,
        inPoint: 2,
        outPoint: 4,
        speed: 2,
      } as TimelineClip,
    ];
    const mapped = mapChatTranscript(source, "video", [
      {
        id: "cue",
        start: 0,
        end: 6,
        text: "Outside retained end",
        words: [
          { text: "Outside", start: 0, end: 1 },
          { text: "retained", start: 2.2, end: 3.8 },
          { text: "end", start: 5, end: 6 },
        ],
      },
    ]);
    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({
      text: "retained",
      start: 10,
      end: 11,
      words: [{ text: "retained", start: 10.1, end: 10.9 }],
    });
  });
  it("revalidates source excerpts at execution if a saved Library asset becomes unavailable", () => {
    const source = project();
    const edit = action({
      kind: "edit",
      operation: {
        id: "broll",
        type: "broll",
        label: "Detail",
        start: 0,
        end: 2,
        targetClipIds: [],
        parameters: { assetId: "support", sourceIn: 8 },
      } as never,
    });
    const support = {
      id: "support",
      kind: "video",
      duration: 10,
      status: "ready",
      name: "Detail",
    } as Asset;
    expect(applyChatAction(source, edit, [support]).clips[0]).toMatchObject({
      inPoint: 8,
      outPoint: 10,
    });
    expect(() =>
      applyChatAction(source, edit, [{ ...support, duration: 9 }])
    ).toThrow(/source interval/);
    expect(() =>
      applyChatAction(source, edit, [{ ...support, status: "failed" }])
    ).toThrow(/unavailable/);
  });
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
      split.clips.slice(0, 2).map(c => ({
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

  const footage = (patch: Partial<TimelineClip> = {}): TimelineClip => ({
    id: "main",
    assetId: "video",
    label: "Original",
    color: "#6553BE",
    track: "video",
    lane: 1,
    start: 0,
    duration: 10,
    inPoint: 2,
    outPoint: 22,
    speed: 2,
    locked: false,
    ...patch,
  });
  const sections = () =>
    action({
      kind: "story-beats",
      splitClips: true,
      beats: [
        {
          id: "hook",
          kind: "hook",
          label: "Hook",
          start: 0,
          end: 3,
          evidenceIds: ["first"],
        },
        {
          id: "body",
          kind: "body",
          label: "Body",
          start: 3,
          end: 10,
          evidenceIds: ["second"],
        },
      ],
    } as Partial<EditorChatAction>);

  it("rejects one-sided linked story cuts atomically, including a locked audio peer, while markers remain available", () => {
    for (const locked of [false, true]) {
      const source = project();
      source.clips = [
        footage({ linkId: "av" }),
        footage({ id: "audio", track: "audio", linkId: "av", locked }),
      ];
      const before = structuredClone(source);
      expect(() => applyChatAction(source, sections(), [])).toThrow(
        /Include linked audio|Unlock linked/
      );
      expect(source).toEqual(before);
      const markers = applyChatAction(
        source,
        { ...sections(), splitClips: false } as EditorChatAction,
        []
      );
      expect(markers.clips).toEqual(source.clips);
      expect(markers.storyBeats).toHaveLength(2);
    }
  });

  it("keeps saved clip selection and range authoritative even with another linked primary source", () => {
    const source = project(),
      step = sections();
    source.clips = [
      footage(),
      footage({
        id: "other",
        assetId: "other-video",
        lane: 2,
        primaryFootage: true,
        linkId: "other-av",
      }),
      footage({
        id: "other-audio",
        assetId: "other-video",
        track: "audio",
        linkId: "other-av",
      }),
    ];
    source.editorChat = {
      mode: "auto",
      maxCredits: 0,
      messages: [
        {
          id: "message",
          role: "assistant",
          text: "Divide selected footage",
          createdAt: source.updatedAt,
          request: {
            requestId: "request",
            projectId: source.id,
            prompt: "Divide selected footage",
            mode: "auto",
            maxCredits: 0,
            selectedClipIds: ["main"],
            range: { start: 0, end: 10 },
          },
          plan: {
            assistant: "Reel",
            requestId: "request",
            projectId: source.id,
            message: "Sections",
            planCredits: 0,
            totalCredits: 0,
            maxCredits: 0,
            budgetExceeded: false,
            actions: [step],
            blockedReasons: [],
            projectUpdatedAt: source.updatedAt,
          },
        },
      ],
    };
    const split = applyChatAction(source, step, []);
    expect(split.clips.filter(c => c.assetId === "video")).toHaveLength(2);
    expect(split.clips.filter(c => c.assetId === "other-video")).toEqual(
      source.clips.slice(1)
    );
    source.editorChat.messages[0].request!.range = { start: 0, end: 3 };
    expect(() => applyChatAction(source, step, [])).toThrow(
      /outside your selected range/
    );
  });

  it("preserves persistent groups, visual/audio source clocks and measured words through section splits and undo", () => {
    const source = project();
    source.clips = [
      footage({
        groupId: "collection",
        visual: normalizeVisual({
          keyframes: [
            { at: 0, x: 0 },
            { at: 1, x: 20 },
          ],
        }),
        audioMix: {
          pan: 0.3,
          gainKeys: [
            { at: 2, gain: 0.2 },
            { at: 22, gain: 1 },
          ],
        },
      }),
      footage({ id: "upper", lane: 2, groupId: "collection" }),
    ];
    source.transcript = [
      {
        id: "phrase",
        sourceClipId: "main",
        start: 2,
        end: 4,
        text: "First second",
        words: [
          { text: "First", start: 2, end: 2.8 },
          { text: "second", start: 3.1, end: 4 },
        ],
      },
    ];
    const split = applyChatAction(source, sections(), []);
    expect(
      split.clips
        .slice(0, 2)
        .map(c => [c.groupId, c.visualStart, c.visualDuration, c.audioMix])
    ).toEqual([
      ["collection", 2, 20, source.clips[0].audioMix],
      ["collection", 2, 20, source.clips[0].audioMix],
    ]);
    expect(split.transcript.map(c => [c.sourceClipId, c.text])).toEqual([
      ["main", "First"],
      ["main-a-1", "second"],
    ]);
    const words = split.transcript.flatMap(c => c.words ?? []);
    expect(words.map(word => word.text)).toEqual(
      source.transcript[0].words!.map(word => word.text)
    );
    words.forEach((word, index) => {
      expect(word.start).toBeCloseTo(
        source.transcript[0].words![index].start,
        9
      );
      expect(word.end).toBeCloseTo(source.transcript[0].words![index].end, 9);
    });
    const restored = applyChatAction(
      split,
      action({ kind: "history", direction: "undo" }),
      []
    );
    expect(restored.clips).toEqual(source.clips);
    expect(restored.transcript).toEqual(source.transcript);
  });

  it("rejects a section cut through a generated transition before adding markers", () => {
    const source = project();
    source.clips = [
      footage({
        shotTransition: {
          outgoingId: "main",
          incomingId: "next",
          incomingEntrance: { kind: "none", duration: 0.5 },
          outgoingExit: { kind: "none", duration: 0.5 },
        },
      }),
    ];
    expect(() => applyChatAction(source, sections(), [])).toThrow(
      /Remove the transition/
    );
    expect(source.storyBeats).toBeUndefined();
    expect(source.revisions).toEqual([]);
  });
});
