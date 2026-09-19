import { describe, expect, it, vi } from "vitest";
import type { EditProject } from "../contracts/workspace";
import { editorAudioCatalog } from "../contracts/editor-audio-catalog";
import { editorChatNeedsApproval } from "../contracts/editor-chat";
import {
  editorChatModelContext,
  normalizeEditorChatPlan,
  parseEditorChatRequest,
  type EditorChatContext,
} from "./editor-chat";

const project: EditProject = {
  id: "edit",
  title: "Edit",
  template: "blank",
  status: "editing",
  platform: "instagram",
  aspectRatio: "9:16",
  duration: 30,
  playhead: 4,
  createdAt: "2026-09-19",
  updatedAt: "2026-09-19",
  clips: [],
  transcript: [],
  proposedChanges: [],
  qualitySignals: [],
  revisions: [],
};
const sound = editorAudioCatalog.find(entry => entry.type === "sfx")!;
const music = editorAudioCatalog.find(
  entry => entry.type === "music" && entry.duration > 5
)!;
const action = {
  id: "a",
  kind: "catalog-audio",
  catalogId: sound.id,
  label: "Add a whoosh",
  scope: "requested",
  requestExcerpt: "Add a whoosh",
  dependsOn: [],
};
function context(): EditorChatContext {
  let id = 0;
  return {
    request: parseEditorChatRequest({
      requestId: "request-1234567890",
      projectId: "edit",
      prompt: "Add a whoosh at 4 seconds",
      mode: "ask",
      maxCredits: 5,
    }),
    project,
    assets: [],
    normalizeOperations: () => [],
    quoteAudio: vi.fn(() => {
      throw new Error("No paid provider");
    }),
    capability: () => false,
    makeId: () => `sound-${++id}`,
  };
}

describe("free audio in Reel plans", () => {
  it("offers the same real catalog as the sound browser, even when paid audio is disconnected", () => {
    const model = editorChatModelContext(context());
    expect(model.freeAudioCatalog).toHaveLength(editorAudioCatalog.length);
    expect(model.freeAudioCatalog.every(entry => entry.credits === 0)).toBe(
      true
    );
    expect(
      model.freeAudioCatalog.find(entry => entry.id === sound.id)
    ).toMatchObject({
      name: sound.name,
      duration: sound.duration,
      tags: sound.tags,
    });
    expect(model.capabilities.sfx).toBe(false);
  });
  it("places a short real sound without buying generation or rounding its duration to a longer clip", () => {
    const ctx = context();
    const plan = normalizeEditorChatPlan(
      { actions: [{ ...action, credits: 999, insert: { start: 4 } }] },
      ctx
    );
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({
      kind: "catalog-audio",
      catalogId: sound.id,
      credits: 0,
      scope: "requested",
      insert: { start: 4, duration: sound.duration },
    });
    expect(plan.totalCredits).toBe(5);
    expect(plan.budgetExceeded).toBe(false);
    expect(ctx.quoteAudio).not.toHaveBeenCalled();
  });
  it("defaults to Library-only and does not treat the request to save a file as timeline insertion", () => {
    const ctx = context();
    ctx.request.prompt = "Save a whoosh to my library";
    const plan = normalizeEditorChatPlan(
      { actions: [{ ...action, requestExcerpt: "Save a whoosh" }] },
      ctx
    );
    expect(plan.actions[0]).toMatchObject({
      kind: "catalog-audio",
      credits: 0,
    });
    expect(plan.actions[0]).not.toHaveProperty("insert");
  });
  it("rejects invented IDs and never accepts a model-supplied external audio URL", () => {
    const plan = normalizeEditorChatPlan(
      {
        actions: [
          {
            ...action,
            catalogId: "https://untrusted.example/free.mp3",
            url: "https://untrusted.example/free.mp3",
          },
        ],
      },
      context()
    );
    expect(plan.actions).toEqual([]);
    expect(plan.blockedReasons[0]).toContain("available free audio catalog");
  });
  it("fits a music bed to a selected range without extending the video or inventing a loop", () => {
    const ctx = context();
    ctx.request.range = { start: 5, end: 10 };
    const plan = normalizeEditorChatPlan(
      { actions: [{ ...action, catalogId: music.id, insert: { start: 5 } }] },
      ctx
    );
    expect(plan.actions[0]).toMatchObject({
      insert: { start: 5, duration: 5 },
    });
    const full = normalizeEditorChatPlan(
      { actions: [{ ...action, catalogId: music.id, insert: { start: 28 } }] },
      context()
    );
    expect(full.actions[0]).toMatchObject({
      insert: { start: 28, duration: 2 },
    });
  });
  it.each([
    { start: -1 },
    { start: Number.NaN },
    { start: 30 },
    { start: 4, duration: Number.POSITIVE_INFINITY },
    { start: 4, duration: 0 },
    { start: 4, duration: sound.duration + 0.01 },
  ])(
    "rejects invalid placement rather than silently coercing it: %j",
    insert => {
      const plan = normalizeEditorChatPlan(
        { actions: [{ ...action, insert }] },
        context()
      );
      expect(plan.actions).toEqual([]);
      expect(plan.blockedReasons).toHaveLength(1);
    }
  );
  it("rejects a requested placement outside the selected interval and keeps extras subject to approval", () => {
    const ctx = context();
    ctx.request.range = { start: 5, end: 10 };
    const invalid = normalizeEditorChatPlan(
      { actions: [{ ...action, insert: { start: 4 } }] },
      ctx
    );
    expect(invalid.actions).toEqual([]);
    expect(invalid.blockedReasons[0]).toContain("selected range");
    const extras = normalizeEditorChatPlan(
      {
        actions: [
          {
            ...action,
            requestExcerpt: "make music louder",
            insert: { start: 5 },
          },
        ],
      },
      ctx
    );
    expect(extras.actions[0].scope).toBe("extra");
    expect(editorChatNeedsApproval(extras.actions[0], "ask")).toBe(true);
  });
});
