import { describe, expect, it } from "vitest";
import type {
  EditOperation,
  EditProject,
  TimelineClip,
} from "../contracts/workspace";
import type {
  EditorChatAction,
  EditorChatResponse,
} from "../contracts/editor-chat";
import { exportFrameRates } from "../contracts/export-settings";
import { normalizeEditorChatState } from "../contracts/editor-chat-state";
import {
  EDITOR_CHAT_SYSTEM_PROMPT,
  editorChatModelContext,
  normalizeEditorChatPlan,
  type EditorChatContext,
} from "./editor-chat";
import { applyChatAction } from "../src/lib/editor-chat-execution";

const clip = (id: string, extra: Partial<TimelineClip> = {}): TimelineClip => ({
  id,
  track: "video",
  assetId: "source",
  label: id,
  start: 0,
  duration: 10,
  inPoint: 0,
  outPoint: 10,
  lane: 1,
  locked: false,
  color: "#ffffff",
  linkId: "av",
  ...extra,
});
const project = (): EditProject => ({
  id: "p",
  title: "Test",
  template: "blank",
  status: "editing",
  platform: "instagram",
  aspectRatio: "9:16",
  frameRate: 25,
  duration: 10,
  playhead: 0,
  createdAt: "now",
  updatedAt: "now",
  clips: [clip("v"), clip("a", { track: "audio" })],
  transcript: [
    {
      id: "cue",
      sourceClipId: "a",
      text: "Real words",
      start: 3,
      end: 5,
      words: [
        { text: "Real", start: 3, end: 4 },
        { text: "words", start: 4, end: 5 },
      ],
    },
  ],
  proposedChanges: [],
  qualitySignals: [],
  revisions: [],
});
const context = (): EditorChatContext => {
  let nextId = 0;
  return {
    request: {
      requestId: "test-request-12345",
      projectId: "p",
      prompt: "Edit linked footage and set frame rate",
      mode: "ask",
      maxCredits: 100,
    },
    project: project(),
    assets: [],
    normalizeOperations: value => value as EditOperation[],
    quoteAudio: () => 15,
    capability: () => true,
    makeId: () => `step-${++nextId}`,
  };
};
const step = {
  id: "step",
  label: "Requested edit",
  reason: "Requested",
  scope: "requested",
  requestExcerpt: "Edit linked footage",
  dependsOn: [],
};
const operation = (extra: Partial<EditOperation> = {}): EditOperation => ({
  id: "operation",
  type: "trim",
  start: 2,
  end: 8,
  label: "Edit",
  reason: "Requested",
  confidence: 1,
  intensity: "balanced",
  status: "proposed",
  targetClipIds: ["v", "a"],
  parameters: { sourceIn: 2 },
  ...extra,
});
const planEdit = (op: EditOperation, ctx = context()) =>
  normalizeEditorChatPlan(
    {
      actions: [{ ...step, kind: "edit", operation: op }],
    },
    ctx
  );
const fpsStep = (frameRate: unknown) => ({
  ...step,
  kind: "settings",
  requestExcerpt: "set frame rate",
  frameRate,
});

describe("Reel explicit linked AV planning", () => {
  it("plans a matching pair and executes its exact IDs with measured speech clocks intact", () => {
    const ctx = context(),
      plan = planEdit(operation(), ctx);
    expect(plan.blockedReasons).toEqual([]);
    expect(plan.actions).toHaveLength(1);
    const action = plan.actions[0];
    expect(action).toMatchObject({
      kind: "edit",
      scope: "requested",
      credits: 0,
      operation: { targetClipIds: ["v", "a"] },
    });
    const edited = applyChatAction(ctx.project, action, []);
    expect(
      edited.clips.map(c => [
        c.start,
        c.duration,
        c.inPoint,
        c.outPoint,
        c.linkId,
      ])
    ).toEqual([
      [2, 6, 2, 8, "av"],
      [2, 6, 2, 8, "av"],
    ]);
    expect(edited.transcript[0]).toMatchObject({
      sourceClipId: "a",
      start: 3,
      end: 5,
    });
  });
  it("rejects missing linked peers for structural and partial-span edits without inferring targets", () => {
    for (const type of [
      "trim",
      "split",
      "move",
      "delete",
      "pacing",
      "style",
      "audio",
    ] as const) {
      const op = operation({
        type,
        targetClipIds: ["v"],
        parameters: { sourceIn: 2, speed: 2, destination: 3 },
      });
      const plan = planEdit(op);
      expect(plan.actions).toEqual([]);
      expect(plan.blockedReasons[0]).toContain(
        "Include linked audio or unlink first."
      );
      expect(op.targetClipIds).toEqual(["v"]);
    }
  });
  it("leaves whole-span look/sound edits, boundary splits and timing no-ops local", () => {
    const operations: EditOperation[] = [
      operation({
        type: "style",
        start: 0,
        end: 10,
        targetClipIds: ["v"],
        parameters: { brightness: 0.1 },
      }),
      operation({
        type: "audio",
        start: 0,
        end: 10,
        targetClipIds: ["a"],
        parameters: { volume: 0.5 },
      }),
      operation({ type: "split", start: 0, targetClipIds: ["v"] }),
      operation({
        type: "move",
        targetClipIds: ["v"],
        parameters: { destination: 0 },
      }),
      operation({
        type: "pacing",
        targetClipIds: ["v"],
        parameters: { speed: 1 },
      }),
      operation({
        start: 0,
        end: 10,
        targetClipIds: ["v"],
        parameters: { sourceIn: 0 },
      }),
    ];
    for (const op of operations) {
      const plan = planEdit(op);
      expect(plan.blockedReasons).toEqual([]);
      expect(plan.actions[0]).toMatchObject({
        operation: { targetClipIds: op.targetClipIds },
      });
      expect(
        applyChatAction(context().project, plan.actions[0], []).clips.every(
          c => c.linkId === "av"
        )
      ).toBe(true);
    }
  });
  it("requires every member of a multi-member link but ignores persistent groups and singleton links", () => {
    const ctx = context();
    ctx.project.clips.push(clip("another-audio", { track: "audio", lane: 2 }));
    expect(planEdit(operation(), ctx).blockedReasons[0]).toContain(
      "Include linked audio"
    );
    expect(
      planEdit(operation({ targetClipIds: ["v", "a", "another-audio"] }), ctx)
        .actions
    ).toHaveLength(1);
    ctx.project.clips = ctx.project.clips.map(c => ({
      ...c,
      groupId: "collection",
      linkId: c.id === "v" ? "singleton" : undefined,
    }));
    expect(
      planEdit(operation({ targetClipIds: ["v"] }), ctx).actions
    ).toHaveLength(1);
  });
  it("preserves locked-target and selected-range boundaries rather than substituting peers", () => {
    const locked = context();
    locked.project.clips[1].locked = true;
    const denied = planEdit(operation(), locked);
    expect(denied.actions).toEqual([]);
    expect(denied.blockedReasons[0]).toContain("missing or locked clip");
    const ranged = context();
    ranged.request.range = { start: 3, end: 7 };
    const outside = planEdit(operation({ type: "style" }), ranged);
    expect(outside.actions).toEqual([]);
    expect(outside.blockedReasons[0]).toContain("outside your selected range");
    const partial = planEdit(
      operation({ type: "style", start: 3, end: 7 }),
      ranged
    );
    expect(partial.actions).toHaveLength(1);
  });
  it("supplies explicit link metadata and the current FPS with matching model guidance", () => {
    const model = editorChatModelContext(context());
    expect(model.project.frameRate).toBe(25);
    expect(model.project.clips.map(c => c.linkId)).toEqual(["av", "av"]);
    expect(EDITOR_CHAT_SYSTEM_PROMPT).toContain(
      "every matching linked clip ID explicitly"
    );
    expect(EDITOR_CHAT_SYSTEM_PROMPT).toContain("frameRate:24|25|30|60");
  });
  it("blocks legacy one-sided story cuts while preserving markers and explicit descending paired splits", () => {
    const ctx = context();
    const beats = [
      {
        id: "hook",
        kind: "hook" as const,
        label: "Hook",
        start: 0,
        end: 4,
        evidenceIds: ["word1"],
      },
      {
        id: "body",
        kind: "body" as const,
        label: "Body",
        start: 4,
        end: 10,
        evidenceIds: ["word2"],
      },
    ];
    ctx.normalizeStoryBeats = () => beats;
    const section = { ...step, kind: "story-beats", beats, splitClips: true };
    const denied = normalizeEditorChatPlan({ actions: [section] }, ctx);
    expect(denied.actions).toEqual([]);
    expect(denied.blockedReasons[0]).toContain(
      "Include linked audio or unlink first."
    );
    expect(
      normalizeEditorChatPlan(
        { actions: [{ ...section, splitClips: false }] },
        ctx
      ).actions[0]
    ).not.toHaveProperty("splitClips");
    ctx.request.task = "story-sections";
    expect(
      normalizeEditorChatPlan({ actions: [section] }, ctx).actions[0]
    ).not.toHaveProperty("splitClips");
    ctx.request.task = undefined;
    ctx.project.clips.push(
      clip("chosen", {
        assetId: "other",
        linkId: undefined,
        primaryFootage: true,
      })
    );
    ctx.request.selectedClipIds = ["chosen"];
    expect(
      normalizeEditorChatPlan({ actions: [section] }, ctx).actions[0]
    ).toMatchObject({ kind: "story-beats", splitClips: true });
    ctx.project.clips = ctx.project.clips.filter(c => c.id !== "chosen");
    ctx.request.selectedClipIds = undefined;
    const paired = normalizeEditorChatPlan(
      {
        actions: [
          {
            ...step,
            id: "late",
            kind: "edit",
            operation: operation({
              id: "late-operation",
              type: "split",
              start: 7,
            }),
          },
          {
            ...step,
            id: "early",
            kind: "edit",
            operation: operation({
              id: "early-operation",
              type: "split",
              start: 4,
            }),
          },
        ],
      },
      ctx
    );
    expect(paired.blockedReasons).toEqual([]);
    const edited = paired.actions.reduce(
      (project, action) => applyChatAction(project, action, []),
      ctx.project
    );
    expect(edited.clips).toHaveLength(6);
    for (const start of [0, 4, 7]) {
      const family = edited.clips.filter(c => c.start === start);
      expect(family).toHaveLength(2);
      expect(family[0].linkId).toBe(family[1].linkId);
      expect(family[0].linkId).toBeTruthy();
    }
    ctx.project.clips = ctx.project.clips.map(c => ({
      ...c,
      linkId: undefined,
    }));
    expect(
      normalizeEditorChatPlan({ actions: [section] }, ctx).actions[0]
    ).toMatchObject({ kind: "story-beats", splitClips: true });
  });
});

describe("Reel supported project frame rates", () => {
  it("accepts every supported FPS at zero action cost with only the existing planning charge", () => {
    for (const frameRate of exportFrameRates) {
      const plan = normalizeEditorChatPlan(
        { actions: [fpsStep(frameRate)] },
        context()
      );
      expect(plan.blockedReasons).toEqual([]);
      expect(plan.actions[0]).toMatchObject({
        kind: "settings",
        frameRate,
        scope: "requested",
        credits: 0,
      });
      expect(plan.totalCredits).toBe(plan.planCredits);
      expect(plan.planCredits).toBe(5);
    }
  });
  it("rejects unsupported FPS exactly, including otherwise valid mixed settings", () => {
    for (const frameRate of [
      23.976,
      29.97,
      48,
      120,
      0,
      -1,
      NaN,
      Infinity,
      "30",
      null,
    ]) {
      const plan = normalizeEditorChatPlan(
        { actions: [{ ...fpsStep(frameRate), aspectRatio: "1:1" }] },
        context()
      );
      expect(plan.actions).toEqual([]);
      expect(plan.blockedReasons[0]).toContain("24, 25, 30 or 60 fps");
    }
  });
  it("keeps project FPS settings outside a selected local range", () => {
    const ctx = context();
    ctx.request.range = { start: 2, end: 8 };
    const plan = normalizeEditorChatPlan({ actions: [fpsStep(60)] }, ctx);
    expect(plan.actions).toEqual([]);
    expect(plan.blockedReasons[0]).toContain(
      "Project settings affect the whole edit"
    );
  });
  it("executes the serialized FPS proposal into reversible snapshots and does not duplicate replay revisions", () => {
    const ctx = context();
    const wirePlan = JSON.parse(
      JSON.stringify(normalizeEditorChatPlan({ actions: [fpsStep(60)] }, ctx))
    ) as EditorChatResponse;
    const stored = normalizeEditorChatState({
      mode: "ask",
      maxCredits: 100,
      messages: [
        {
          id: "message",
          role: "assistant",
          text: "Set frame rate",
          createdAt: "2026-10-07T00:00:00.000Z",
          plan: wirePlan,
        },
      ],
    })!;
    const action = stored.messages[0].plan!.actions[0],
      edited = applyChatAction(ctx.project, action, []);
    expect(edited.frameRate).toBe(60);
    expect(edited.revisions.map(r => r.frameRate)).toEqual([25, 60]);
    const replay = applyChatAction(edited, action, []);
    expect(replay.revisions).toHaveLength(2);
    const historyAction = {
      ...step,
      id: "history",
      kind: "history",
      direction: "undo",
      credits: 0,
      status: "pending",
    } as EditorChatAction;
    const undone = applyChatAction(edited, historyAction, []);
    expect(undone.frameRate).toBe(25);
    const redone = applyChatAction(
      undone,
      { ...historyAction, direction: "redo" } as EditorChatAction,
      []
    );
    expect(redone.frameRate).toBe(60);
  });
  it("rejects malformed persisted FPS before changing the project or creating a revision", () => {
    const source = project();
    const invalid = {
      ...step,
      kind: "settings",
      frameRate: 48,
      credits: 0,
      status: "pending",
    } as unknown as EditorChatAction;
    expect(() => applyChatAction(source, invalid, [])).toThrow(
      "24, 25, 30 or 60 fps"
    );
    expect(source.frameRate).toBe(25);
    expect(source.revisions).toEqual([]);
    const plan = normalizeEditorChatPlan({ actions: [fpsStep(60)] }, context());
    plan.actions = [{ ...invalid, aspectRatio: "1:1" } as EditorChatAction];
    const resumed = normalizeEditorChatState({
      mode: "ask",
      maxCredits: 100,
      messages: [
        {
          id: "resume",
          role: "assistant",
          text: "Set frame rate",
          createdAt: "2026-10-07T00:00:00.000Z",
          plan,
        },
      ],
    })!;
    expect(resumed.messages[0].plan!.actions).toEqual([]);
    expect(resumed.messages[0].plan!.blockedReasons).toContain(
      "Choose a frame rate of 24, 25, 30 or 60 fps."
    );
    let next = source;
    for (const action of resumed.messages[0].plan!.actions)
      next = applyChatAction(next, action, []);
    expect(next).toBe(source);
    expect(next.aspectRatio).toBe("9:16");
    expect(next.frameRate).toBe(25);
  });
});
