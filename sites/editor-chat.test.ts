import { describe, expect, it, vi } from "vitest";
import type { Asset, EditOperation, EditProject } from "../contracts/workspace";
import { editorChatNeedsApproval } from "../contracts/editor-chat";
import {
  editorChatModelContext,
  normalizeEditorChatPlan,
  parseEditorChatRequest,
  runEditorChatOnce,
  type EditorChatCachedRequest,
  type EditorChatContext,
  type EditorChatRequestStore,
} from "./editor-chat";

const project: EditProject = {
  id: "project",
  title: "Demo",
  template: "blank",
  status: "editing",
  platform: "instagram",
  aspectRatio: "9:16",
  duration: 30,
  playhead: 4,
  createdAt: "2026-09-19",
  updatedAt: "2026-09-19",
  clips: [
    {
      id: "clip",
      assetId: "source",
      track: "video",
      start: 0,
      duration: 30,
      inPoint: 0,
      outPoint: 30,
      label: "Source",
      locked: false,
      color: "#888888",
    },
    {
      id: "locked",
      assetId: "source",
      track: "video",
      start: 25,
      duration: 5,
      inPoint: 0,
      outPoint: 5,
      label: "Locked",
      locked: true,
      color: "#888888",
    },
  ],
  transcript: [{ id: "speech", start: 1, end: 3, text: "Real source words" }],
  proposedChanges: [],
  qualitySignals: [],
  revisions: [],
};
const assets: Asset[] = [
  {
    id: "source",
    name: "Camera.mp4",
    kind: "video",
    contentType: "video/mp4",
    size: 10,
    duration: 65,
    url: "/api/assets/source",
    status: "ready",
    createdAt: "2026-09-19",
  },
];
function context(patch: Partial<EditorChatContext> = {}): EditorChatContext {
  let id = 0;
  return {
    request: parseEditorChatRequest({
      requestId: "request-0123456789",
      projectId: "project",
      prompt: "Add captions and generate an image of a cat",
      mode: "ask",
      maxCredits: 100,
    }),
    project,
    assets,
    normalizeOperations: raw => raw as EditOperation[],
    quoteAudio: () => 15,
    capability: () => true,
    makeId: () => `action-${++id}`,
    ...patch,
  };
}
const base = {
  id: "a",
  label: "Action",
  reason: "A direct request",
  scope: "requested",
  requestExcerpt: "Add captions",
  dependsOn: [],
};
const operation = (patch: Partial<EditOperation> = {}): EditOperation => ({
  id: "operation",
  type: "audio",
  label: "Volume",
  reason: "Balance",
  start: 0,
  end: 10,
  confidence: 0.8,
  intensity: "balanced",
  targetClipIds: ["clip"],
  status: "proposed",
  parameters: { volume: 0.2 },
  ...patch,
});

describe("Reel authorization and actual cost planning", () => {
  it("rejects missing spending authority and bounded attachment violations before model work", () => {
    expect(() =>
      parseEditorChatRequest({ ...context().request, maxCredits: 4 })
    ).toThrow("credit limit");
    expect(() =>
      parseEditorChatRequest({
        ...context().request,
        references: [{ name: "brief.txt", text: "x".repeat(16001) }],
      })
    ).toThrow("16,000");
    expect(() =>
      parseEditorChatRequest({
        ...context().request,
        references: [{ url: "https://user:password@example.com/a" }],
      })
    ).toThrow("without credentials");
  });
  it("uses server-owned reference IDs, never an arbitrary client asset", () => {
    const ctx = context();
    ctx.request.references = [{ assetId: "other-tenant-image" }];
    expect(() => editorChatModelContext(ctx)).toThrow("not available");
    const plan = normalizeEditorChatPlan(
      {
        actions: [
          { ...base, kind: "insert", assetId: "other-tenant-image", start: 0 },
        ],
      },
      context()
    );
    expect(plan.actions).toEqual([]);
    expect(plan.blockedReasons[0]).toContain("not available");
  });
  it("accepts only exact reference video links supplied by the user and uses the backend public-link tariff", () => {
    const ctx = context();
    ctx.request.references = [
      { url: "https://www.youtube.com/watch?v=reference" },
    ];
    const plan = normalizeEditorChatPlan(
      {
        actions: [
          {
            ...base,
            kind: "analyze",
            publicUrl: "https://www.youtube.com/watch?v=reference",
          },
          {
            ...base,
            id: "b",
            kind: "analyze",
            publicUrl: "https://unrequested.example/video.mp4",
          },
        ],
      },
      ctx
    );
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({
      publicUrl: "https://www.youtube.com/watch?v=reference",
      credits: 10,
    });
    expect(plan.blockedReasons[0]).toContain("you supplied");
  });
  it("recomputes actual tariffs and preserves an over-budget plan without authorizing spend", () => {
    const ctx = context();
    ctx.request.maxCredits = 20;
    const plan = normalizeEditorChatPlan(
      {
        actions: [
          {
            ...base,
            kind: "generate",
            media: "image",
            prompt: "A cat",
            credits: 0,
          },
        ],
      },
      ctx
    );
    expect(plan.actions[0].credits).toBe(20);
    expect(plan.totalCredits).toBe(25);
    expect(plan.budgetExceeded).toBe(true);
    expect(plan.actions[0].status).toBe("pending");
    expect(
      plan.actions[0].kind === "generate" && plan.actions[0].insert
    ).toBeUndefined();
  });
  it("only optional extras ask for approval, and forged supporting text cannot elevate scope", () => {
    const plan = normalizeEditorChatPlan(
      {
        actions: [
          { ...base, kind: "transcribe", assetIds: ["source"] },
          {
            ...base,
            id: "b",
            kind: "generate",
            media: "music",
            prompt: "Piano",
            requestExcerpt: "add music",
          },
        ],
      },
      context()
    );
    expect(plan.actions[0].credits).toBe(2);
    expect(plan.actions[0].scope).toBe("requested");
    expect(editorChatNeedsApproval(plan.actions[0], "ask")).toBe(false);
    expect(plan.actions[1].scope).toBe("extra");
    expect(editorChatNeedsApproval(plan.actions[1], "ask")).toBe(true);
    expect(editorChatNeedsApproval(plan.actions[1], "auto")).toBe(false);
  });
  it("preserves a required prerequisite but downgrades an orphaned nice-to-have", () => {
    const plan = normalizeEditorChatPlan(
      {
        actions: [
          {
            ...base,
            kind: "analyze",
            scope: "necessary",
            assetId: "source",
            focus: "Caption positions",
          },
          {
            ...base,
            id: "b",
            kind: "replan",
            dependsOn: ["a"],
            prompt: "Add captions using the observations",
          },
        ],
      },
      context()
    );
    expect(plan.actions.map(action => action.scope)).toEqual([
      "necessary",
      "requested",
    ]);
    const orphan = normalizeEditorChatPlan(
      {
        actions: [
          { ...base, kind: "analyze", scope: "necessary", assetId: "source" },
        ],
      },
      context()
    );
    expect(orphan.actions[0].scope).toBe("extra");
  });
  it("rejects an unsupported provider and all dependent work instead of claiming completion", () => {
    const plan = normalizeEditorChatPlan(
      {
        actions: [
          { ...base, kind: "analyze", assetId: "source" },
          {
            ...base,
            id: "b",
            kind: "replan",
            dependsOn: ["a"],
            prompt: "Edit using review",
          },
        ],
      },
      context({ capability: () => false })
    );
    expect(plan.actions).toEqual([]);
    expect(plan.blockedReasons).toHaveLength(2);
  });
  it("never changes a locked target or applies invented caption words", () => {
    const plan = normalizeEditorChatPlan(
      {
        actions: [
          {
            ...base,
            kind: "edit",
            operation: operation({ targetClipIds: ["locked"] }),
          },
          {
            ...base,
            id: "b",
            kind: "edit",
            operation: operation({
              type: "caption",
              parameters: { text: "Invented quote" },
            }),
          },
        ],
      },
      context()
    );
    expect(plan.actions).toEqual([]);
    expect(plan.blockedReasons).toHaveLength(2);
  });
  it("rejects duration changes through locked footage and edits outside the chosen interval", () => {
    const ctx = context();
    ctx.request.range = { start: 5, end: 10 };
    const range = normalizeEditorChatPlan(
      { actions: [{ ...base, kind: "edit", operation: operation() }] },
      ctx
    );
    expect(range.actions).toEqual([]);
    expect(range.blockedReasons[0]).toContain("selected range");
    const duration = normalizeEditorChatPlan(
      { actions: [{ ...base, kind: "settings", duration: 26 }] },
      context()
    );
    expect(duration.actions).toEqual([]);
    expect(duration.blockedReasons[0]).toContain("locked clip");
  });
  it("keeps generated/owned media and global state out of a selected local range", () => {
    const ctx = context();
    ctx.request.range = { start: 5, end: 10 };
    const plan = normalizeEditorChatPlan(
      {
        actions: [
          {
            ...base,
            kind: "generate",
            media: "video",
            seconds: 5,
            prompt: "A cat",
            insert: { start: 8 },
          },
          {
            ...base,
            id: "b",
            kind: "insert",
            assetId: "source",
            start: 9,
            duration: 2,
          },
          { ...base, id: "c", kind: "settings", captionStyle: "yellow" },
          { ...base, id: "d", kind: "history", direction: "undo" },
          {
            ...base,
            id: "e",
            kind: "edit",
            operation: operation({ type: "delete", start: 5, end: 10 }),
          },
        ],
      },
      ctx
    );
    expect(plan.actions).toEqual([]);
    expect(plan.blockedReasons).toHaveLength(5);
  });
  it("allows exact in-range placement while keeping its real generation cost", () => {
    const ctx = context();
    ctx.request.range = { start: 5, end: 10 };
    const plan = normalizeEditorChatPlan(
      {
        actions: [
          {
            ...base,
            kind: "generate",
            media: "video",
            seconds: 5,
            prompt: "A cat",
            insert: { start: 5 },
          },
        ],
      },
      ctx
    );
    expect(plan.actions[0]).toMatchObject({
      kind: "generate",
      credits: 200,
      insert: { start: 5, duration: 5 },
    });
    expect(plan.budgetExceeded).toBe(true);
  });
  it("supplies completed work only to its saved continuation so follow-up planning can avoid repeated purchases", () => {
    const ctx = context();
    ctx.project = {
      ...project,
      editorChat: {
        mode: "ask",
        maxCredits: 100,
        messages: [
          {
            id: "parent",
            role: "assistant",
            text: "Working",
            createdAt: "2026-09-19",
            plan: {
              assistant: "Reel",
              requestId: "original-0123456789",
              projectId: project.id,
              message: "Working",
              planCredits: 5,
              totalCredits: 30,
              maxCredits: 100,
              budgetExceeded: false,
              blockedReasons: [],
              projectUpdatedAt: project.updatedAt,
              actions: [
                {
                  id: "generated",
                  kind: "generate",
                  label: "Cat image",
                  reason: "Requested",
                  scope: "requested",
                  requestExcerpt: "generate an image of a cat",
                  dependsOn: [],
                  credits: 20,
                  status: "completed",
                  media: "image",
                  prompt: "A cat",
                  name: "Cat",
                  runtime: { assetId: "cat-output" },
                },
                {
                  id: "waiting",
                  kind: "generate",
                  label: "Pending image",
                  reason: "Optional",
                  scope: "extra",
                  requestExcerpt: "",
                  dependsOn: [],
                  credits: 20,
                  status: "pending",
                  media: "image",
                  prompt: "A dog",
                  name: "Dog",
                },
                {
                  id: "followup",
                  kind: "replan",
                  label: "Plan after source review",
                  reason: "Necessary",
                  scope: "necessary",
                  requestExcerpt: "Add captions",
                  dependsOn: [],
                  credits: 5,
                  status: "running",
                  prompt: "Continue",
                  runtime: { request: ctx.request },
                },
              ],
            },
          },
        ],
      },
    };
    ctx.assets = [...assets, { ...assets[0], id: "cat-output", kind: "image" }];
    expect(editorChatModelContext(ctx).completedEarlierSteps).toEqual([
      {
        id: "generated",
        kind: "generate",
        label: "Cat image",
        outputAssetId: "cat-output",
        media: "image",
        prompt: "A cat",
      },
    ]);
    expect(
      editorChatModelContext({
        ...ctx,
        request: { ...ctx.request, requestId: "fresh-request-0123456789" },
      }).completedEarlierSteps
    ).toEqual([]);
  });
  it("keeps the planner voice context bounded while including a specifically requested voice", () => {
    const ctx = context();
    ctx.request.prompt = "Voice this with English_Graceful_Lady";
    const model = editorChatModelContext(ctx);
    expect(model.voiceIds.length).toBeLessThanOrEqual(50);
    expect(
      model.voiceIds.some(voice => voice.id === "English_Graceful_Lady")
    ).toBe(true);
    expect(
      new Set(model.voiceIds.map(voice => voice.language)).size
    ).toBeGreaterThan(10);
  });
});

function store() {
  let row: EditorChatCachedRequest | null = null;
  const value: EditorChatRequestStore = {
    claim: async () => {
      if (row) return false;
      row = { fingerprint: "hash", status: "running" };
      return true;
    },
    read: async () => row,
    complete: async (body, httpStatus) => {
      row = { fingerprint: "hash", status: "completed", body, httpStatus };
    },
    fail: async () => {
      row = { fingerprint: "hash", status: "failed" };
    },
  };
  return value;
}

describe("paid chat request replay", () => {
  it("a concurrent retry cannot invoke or charge the model twice", async () => {
    const storage = store();
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const paid = vi.fn(async () => {
      await gate;
      return Response.json({ actions: [], planCredits: 5 });
    });
    const first = runEditorChatOnce(storage, "hash", paid);
    await Promise.resolve();
    const concurrent = await runEditorChatOnce(storage, "hash", paid);
    expect(concurrent.status).toBe(409);
    expect((await concurrent.json()).requestInProgress).toBe(true);
    release();
    const result = await first;
    const replay = await runEditorChatOnce(storage, "hash", paid);
    expect(await replay.json()).toEqual(await result.json());
    expect(paid).toHaveBeenCalledTimes(1);
    expect(replay.headers.get("X-REELassati-Replayed")).toBe("true");
  });
  it("rejects reusing an ID for a different prompt and never retries an uncertain failure", async () => {
    const storage = store();
    const paid = vi.fn(async () => {
      throw new Error("connection ended");
    });
    await expect(runEditorChatOnce(storage, "hash", paid)).rejects.toThrow(
      "connection ended"
    );
    expect((await runEditorChatOnce(storage, "hash", paid)).status).toBe(409);
    expect(
      (await runEditorChatOnce(storage, "another-hash", paid)).status
    ).toBe(409);
    expect(paid).toHaveBeenCalledTimes(1);
  });
  it("replays a released credit/provider error without buying a second invocation", async () => {
    const storage = store();
    const paid = vi.fn(async () => {
      throw Response.json({ error: "No credits" }, { status: 402 });
    });
    expect((await runEditorChatOnce(storage, "hash", paid)).status).toBe(402);
    expect((await runEditorChatOnce(storage, "hash", paid)).status).toBe(402);
    expect(paid).toHaveBeenCalledTimes(1);
  });
});
