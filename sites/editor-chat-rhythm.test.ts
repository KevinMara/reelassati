import { describe, expect, it } from "vitest";
import type { Asset, EditProject, TimelineClip } from "../contracts/workspace";
import type { EditorChatAction } from "../contracts/editor-chat";
import { normalizeEditorChatState } from "../contracts/editor-chat-state";
import { normalizeEditorChatPlan, type EditorChatContext } from "./editor-chat";
import {
  applyChatAction,
  applyMeasuredBeatAction,
} from "../src/lib/editor-chat-execution";
import { normalizeVisual } from "../contracts/clip-visual";
const clip = (
  id: string,
  track: TimelineClip["track"] = "video"
): TimelineClip => ({
  id,
  label: id,
  track,
  assetId: id === "music" ? "music-source" : "source",
  start: 0,
  duration: 8,
  inPoint: 0,
  outPoint: 8,
  lane: 1,
  linkId: id === "music" ? undefined : "av",
  locked: false,
  color: "#ffffff",
});
const project = (): EditProject => ({
  id: "p",
  title: "QA",
  template: "blank",
  status: "editing",
  platform: "instagram",
  aspectRatio: "9:16",
  duration: 8,
  playhead: 0,
  createdAt: "now",
  updatedAt: "now",
  clips: [
    clip("v"),
    clip("a", "audio"),
    { ...clip("music", "audio"), lane: 2 },
  ],
  transcript: [
    {
      id: "cue",
      text: "First phrase Second phrase",
      start: 0,
      end: 6,
      sourceClipId: "a",
      words: [
        { text: "First", start: 0, end: 0.5 },
        { text: "phrase", start: 0.6, end: 1 },
        { text: "Second", start: 3, end: 3.5 },
        { text: "phrase", start: 3.6, end: 4 },
      ],
    },
  ],
  proposedChanges: [],
  qualitySignals: [],
  revisions: [],
});
const context = (): EditorChatContext => ({
  request: {
    requestId: "request-123456789",
    projectId: "p",
    prompt: "Cut my clips to the beats and add speech zoom",
    mode: "ask",
    maxCredits: 5,
  },
  project: project(),
  assets: [
    {
      id: "music-source",
      name: "Music",
      kind: "audio",
      status: "ready",
      duration: 8,
      size: 100000,
      contentType: "audio/wav",
    } as Asset,
  ],
  normalizeOperations: () => [],
  quoteAudio: () => {
    throw new Error("No paid generation");
  },
  capability: () => false,
  makeId: () => "step",
});
const beat = {
  id: "beat",
  kind: "beat-cuts",
  label: "Beat cuts",
  reason: "Requested",
  scope: "requested",
  requestExcerpt: "Cut my clips to the beats",
  dependsOn: [],
  sourceClipId: "music",
  targetClipIds: ["v", "a"],
  every: 1,
  minimumGap: 0.4,
  sensitivity: 1,
};
const zoom = {
  ...beat,
  id: "zoom",
  kind: "speech-zoom",
  targetClipIds: ["v"],
  amount: 1.12,
  replacePath: false,
  requestExcerpt: "add speech zoom",
};
const normalize = (action: unknown, ctx = context()) =>
  normalizeEditorChatPlan(
    { message: "Requested rhythm edits", actions: [action] },
    ctx
  );
const persist = (action: EditorChatAction) =>
  normalizeEditorChatState({
    mode: "ask",
    maxCredits: 5,
    messages: [
      {
        id: "m",
        role: "assistant",
        text: "Requested rhythm",
        createdAt: "2026-10-09T10:00:00.000Z",
        plan: {
          assistant: "Reel",
          requestId: "request-123456789",
          projectId: "p",
          message: "Rhythm",
          planCredits: 5,
          totalCredits: 5,
          maxCredits: 5,
          budgetExceeded: false,
          blockedReasons: [],
          projectUpdatedAt: "now",
          actions: [action],
        },
      },
    ],
  })?.messages[0]?.plan?.actions[0];
describe("Reel rhythm planning, persistence and exact application", () => {
  it("plans local rhythm actions with zero extra credits and keeps their exact controls through recovery", () => {
    for (const row of [beat, zoom]) {
      const plan = normalize(row);
      expect(plan.blockedReasons).toEqual([]);
      expect(plan.totalCredits).toBe(5);
      expect(plan.budgetExceeded).toBe(false);
      expect(plan.actions[0].credits).toBe(0);
      expect(persist(plan.actions[0])).toEqual(plan.actions[0]);
    }
  });
  it("rejects one-sided linked cuts, unrelated targets, locks, ranges and unsupported source bounds", () => {
    expect(normalize({ ...beat, targetClipIds: ["v"] }).actions).toEqual([]);
    expect(
      normalize({ ...beat, targetClipIds: ["v", "a", "music"] }).actions
    ).toEqual([]);
    const ranged = context();
    ranged.request.range = { start: 0, end: 4 };
    expect(normalize(beat, ranged).actions).toEqual([]);
    const selected = context();
    selected.request.selectedClipIds = ["v"];
    expect(normalize(beat, selected).actions).toEqual([]);
    const locked = context();
    locked.project.clips[1].locked = true;
    expect(normalize(beat, locked).actions).toEqual([]);
    const large = context();
    large.assets[0].size = 17 * 1024 * 1024;
    expect(normalize(beat, large).actions).toEqual([]);
    expect(normalize({ ...beat, every: NaN }).actions).toEqual([]);
    expect(normalize({ ...zoom, amount: Infinity }).actions).toEqual([]);
  });
  it("requires explicit motion replacement and rejects corrupt stored controls", () => {
    const ctx = context();
    ctx.project.clips[0].visual = normalizeVisual({
      keyframes: [
        { at: 0, scale: 1 },
        { at: 1, scale: 1.1 },
      ],
    });
    expect(normalize(zoom, ctx).actions).toEqual([]);
    expect(normalize({ ...zoom, replacePath: true }, ctx).actions).toHaveLength(
      1
    );
    const valid = normalize(beat).actions[0];
    expect(
      persist({ ...valid, every: NaN } as EditorChatAction)
    ).toBeUndefined();
    expect(
      persist({ ...valid, targetClipIds: ["v", "v"] } as EditorChatAction)
    ).toBeUndefined();
  });
  it("applies measured cuts once, preserves independent music and blocks newly linked peers", () => {
    const action = normalize(beat).actions[0];
    if (action.kind !== "beat-cuts") throw new Error("Expected beat cuts");
    const p = project(),
      next = applyMeasuredBeatAction(p, action, [2, 4, 6]);
    expect(next.clips.find(c => c.id === "music")).toEqual(p.clips[2]);
    expect(next.clips.filter(c => c.track === "video")).toHaveLength(4);
    expect(applyMeasuredBeatAction(next, action, [2, 4, 6])).toBe(next);
    expect(() =>
      applyMeasuredBeatAction(p, { ...action, targetClipIds: ["v"] }, [2])
    ).toThrow(/every explicitly/);
  });
  it("speech zoom applies a saved reversible path once with linked measured speech", () => {
    const action = normalize(zoom).actions[0],
      p = project();
    const next = applyChatAction(p, action, []);
    expect(next.clips[0].visual?.keyframes.length).toBeGreaterThan(2);
    expect(next.clips[1]).toEqual(p.clips[1]);
    expect(applyChatAction(next, action, [])).toBe(next);
    expect(() => applyChatAction({ ...p, transcript: [] }, action, [])).toThrow(
      /measured words/
    );
  });
});
