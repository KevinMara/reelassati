import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import worker from "./server";
import type { WorkspaceDocument } from "../contracts/workspace";

const sqlite = new DatabaseSync(":memory:");
let failFinalCacheWrite = false;
class Statement {
  values: Array<string | number | null> = [];
  constructor(readonly sql: string) {}
  bind(...values: Array<string | number | null>) {
    this.values = values;
    return this;
  }
  async first<T>() {
    return (sqlite.prepare(this.sql).get(...this.values) || null) as T | null;
  }
  async all<T>() {
    return {
      results: sqlite.prepare(this.sql).all(...this.values) as T[],
      success: true,
    };
  }
  execute() {
    if (
      failFinalCacheWrite &&
      /UPDATE editor_chat_requests SET status='completed'/i.test(this.sql)
    ) {
      failFinalCacheWrite = false;
      throw new Error("Simulated cache completion write failure");
    }
    return {
      success: true,
      meta: {
        changes: Number(sqlite.prepare(this.sql).run(...this.values).changes),
      },
    };
  }
  async run() {
    return this.execute();
  }
}
const DB = {
  prepare: (sql: string) => new Statement(sql),
  async batch(statements: Statement[]) {
    sqlite.exec("BEGIN");
    try {
      const result = statements.map(statement => statement.execute());
      sqlite.exec("COMMIT");
      return result;
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  },
};
const objects = new Map<string, Uint8Array>();
const env = {
  DB,
  BUCKET: {
    async get(key: string) {
      const bytes = objects.get(key);
      return bytes
        ? {
            size: bytes.length,
            etag: "test-etag",
            body: new Response(bytes).body,
            arrayBuffer: async () => bytes.slice().buffer,
          }
        : null;
    },
  },
  SUPABASE_URL: "https://auth.example",
  SUPABASE_PUBLISHABLE_KEY: "test-only",
  OPENROUTER_API_KEY: "test-only-provider",
  AI_CREDIT_ACCESS_EMAIL: "owner@example.com",
  AI_PROVENANCE_SIGNING_KEY:
    "test-only-provenance-signing-key-at-least-32-characters",
  ASSETS: { fetch: () => new Response("static") },
};
const providerCalls: Record<string, unknown>[] = [];
let nextOutput: Record<string, unknown> = {
  message: "Ready to adjust the clip",
  actions: [
    {
      id: "a",
      kind: "edit",
      label: "Balance audio",
      reason: "Requested",
      scope: "requested",
      requestExcerpt: "Lower the audio",
      dependsOn: [],
      operation: {
        type: "audio",
        label: "Balance audio",
        reason: "Requested",
        start: 0,
        end: 30,
        targetClipIds: ["clip"],
        parameters: { volume: 0.2 },
      },
    },
  ],
};
let providerGate: Promise<void> | undefined;
async function request(
  path: string,
  body?: unknown,
  owner = "owner@example.com",
  method = body ? "POST" : "GET"
) {
  return worker.fetch(
    new Request(`https://studio.example${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${owner}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    env as never
  );
}
const chat = (requestId: string, extra: Record<string, unknown> = {}) => ({
  requestId,
  projectId: "project",
  prompt: "Lower the audio",
  mode: "ask",
  maxCredits: 100,
  ...extra,
});
const balance = () =>
  Number(
    sqlite
      .prepare(
        "SELECT included_balance + topup_balance AS balance FROM credit_accounts WHERE owner_email='owner@example.com'"
      )
      .get()?.balance
  );
function mp4(seconds: number) {
  const data = new Uint8Array(128);
  const view = new DataView(data.buffer);
  view.setUint32(0, 12);
  data.set([102, 116, 121, 112, 105, 115, 111, 109], 4);
  view.setUint32(12, 116);
  data.set([109, 111, 111, 118], 16);
  view.setUint32(20, 108);
  data.set([109, 118, 104, 100], 24);
  view.setUint32(40, 1000);
  view.setUint32(44, seconds * 1000);
  return data;
}
function asset(
  id: string,
  owner: string,
  kind: string,
  mime: string,
  bytes: Uint8Array
) {
  objects.set(id, bytes);
  sqlite
    .prepare(
      "INSERT INTO assets(id,owner_email,brand_id,name,kind,content_type,bytes,r2_key,created_at) VALUES (?,?,'default',?,?,?,?,?,?)"
    )
    .run(
      id,
      owner,
      `${id}.${kind === "image" ? "png" : "mp4"}`,
      kind,
      mime,
      bytes.length,
      id,
      new Date().toISOString()
    );
}
beforeAll(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, init) => {
      const url = String(input);
      if (url.startsWith("https://auth.example"))
        return Response.json({
          email: new Headers(init?.headers)
            .get("Authorization")
            ?.replace("Bearer ", ""),
        });
      providerCalls.push(JSON.parse(String(init?.body || "{}")));
      if (providerGate) await providerGate;
      return Response.json({
        choices: [{ message: { content: JSON.stringify(nextOutput) } }],
      });
    })
  );
  await request("/api/billing/summary");
  sqlite
    .prepare(
      "UPDATE credit_accounts SET included_balance=1000 WHERE owner_email='owner@example.com'"
    )
    .run();
  const { workspace } = (await (await request("/api/workspace")).json()) as {
    workspace: WorkspaceDocument;
  };
  asset("source", "owner@example.com", "video", "video/mp4", mp4(30));
  asset("proxy", "owner@example.com", "video", "video/mp4", mp4(30));
  asset("short-proxy", "owner@example.com", "video", "video/mp4", mp4(20));
  asset("foreign-proxy", "stranger@example.com", "video", "video/mp4", mp4(30));
  asset(
    "image",
    "owner@example.com",
    "image",
    "image/png",
    Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lQAAAABJRU5ErkJggg=="
      ),
      char => char.charCodeAt(0)
    )
  );
  workspace.projects = [
    {
      id: "project",
      title: "Real owner project",
      template: "blank",
      status: "editing",
      platform: "instagram",
      aspectRatio: "9:16",
      duration: 30,
      playhead: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      clips: [
        {
          id: "clip",
          assetId: "source",
          label: "Source",
          track: "video",
          start: 0,
          duration: 30,
          inPoint: 0,
          outPoint: 30,
          color: "#999999",
          locked: false,
        },
      ],
      transcript: [],
      proposedChanges: [],
      qualitySignals: [],
      revisions: [],
    },
  ];
  workspace.assets = [
    {
      id: "source",
      name: "Source.mp4",
      kind: "video",
      contentType: "video/mp4",
      size: 128,
      duration: 30,
      url: "/api/assets/source",
      status: "ready",
      createdAt: new Date().toISOString(),
    },
  ];
  const saved = await request(
    "/api/workspace",
    { workspace },
    "owner@example.com",
    "PUT"
  );
  expect(saved.status).toBe(200);
});
afterAll(() => {
  sqlite.close();
  vi.unstubAllGlobals();
});

describe("authenticated paid editing chat route", () => {
  it("uses the saved owner project and replays a normalized plan without another debit or provider call", async () => {
    const before = balance();
    const calls = providerCalls.length;
    const body = chat("route-request-000001", {
      project: { title: "Client forged project", duration: 99999 },
    });
    const first = await request("/api/ai/editor-chat", body);
    expect(first.status).toBe(200);
    const firstPlan = await first.json();
    expect(firstPlan).toMatchObject({
      assistant: "Reel",
      planCredits: 5,
      totalCredits: 5,
    });
    const payload = providerCalls.at(-1)! as {
      messages: Array<{ content: string }>;
    };
    expect(JSON.parse(payload.messages[1].content).project.title).toBe(
      "Real owner project"
    );
    expect(balance()).toBe(before - 5);
    const replay = await request("/api/ai/editor-chat", body);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(firstPlan);
    expect(balance()).toBe(before - 5);
    expect(providerCalls.length).toBe(calls + 1);
    const collision = await request("/api/ai/editor-chat", {
      ...body,
      prompt: "Different request",
    });
    expect(collision.status).toBe(409);
    expect(providerCalls.length).toBe(calls + 1);
  });
  it("rejects another owner's project/reference before buying model work", async () => {
    const before = balance();
    const calls = providerCalls.length;
    expect(
      (
        await request(
          "/api/ai/editor-chat",
          chat("route-request-000002"),
          "stranger@example.com"
        )
      ).status
    ).toBe(404);
    expect(
      (
        await request(
          "/api/ai/editor-chat",
          chat("route-request-000003", {
            references: [{ assetId: "foreign-proxy" }],
          })
        )
      ).status
    ).toBe(404);
    expect(balance()).toBe(before);
    expect(providerCalls.length).toBe(calls);
  });
  it("passes actual owned image bytes in native multimodal content", async () => {
    const response = await request(
      "/api/ai/editor-chat",
      chat("route-request-000004", { references: [{ assetId: "image" }] })
    );
    expect(response.status).toBe(200);
    const payload = providerCalls.at(-1)! as {
      model: string;
      messages: Array<{ content: unknown }>;
    };
    expect(payload.model).toBe("google/gemini-2.5-flash");
    expect(payload.messages[1].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "image_url",
          image_url: { url: expect.stringMatching(/^data:image\/png;base64,/) },
        }),
      ])
    );
  });
  it("a concurrent retry does not buy a second model call", async () => {
    let release!: () => void;
    providerGate = new Promise<void>(resolve => {
      release = resolve;
    });
    const before = balance();
    const calls = providerCalls.length;
    const body = chat("route-request-000005");
    const first = request("/api/ai/editor-chat", body);
    await vi.waitFor(() => expect(providerCalls.length).toBe(calls + 1));
    const retry = await request("/api/ai/editor-chat", body);
    expect(retry.status).toBe(409);
    expect(await retry.json()).toMatchObject({ requestInProgress: true });
    release();
    providerGate = undefined;
    expect((await first).status).toBe(200);
    expect(balance()).toBe(before - 5);
    expect(providerCalls.length).toBe(calls + 1);
  });
  it("can recover a prepared paid plan after the final cache write fails", async () => {
    const before = balance();
    const calls = providerCalls.length;
    failFinalCacheWrite = true;
    const body = chat("route-request-000006");
    const first = await request("/api/ai/editor-chat", body);
    expect(first.status).toBe(500);
    expect(balance()).toBe(before - 5);
    const replay = await request("/api/ai/editor-chat", body);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({
      assistant: "Reel",
      planCredits: 5,
    });
    expect(balance()).toBe(before - 5);
    expect(providerCalls.length).toBe(calls + 1);
  });
  it("supplies actual full-duration private video bytes and rejects foreign or shortened analysis proxies", async () => {
    nextOutput = {
      summary: "Observed source",
      review: {
        captions: "absent",
        audio: "present",
        ending: {
          time: 28,
          confidence: 0.9,
          completed: true,
          trailingContent: "empty",
          note: "Finished",
        },
      },
      retention: [],
      changes: [],
    };
    const before = balance();
    const calls = providerCalls.length;
    const input = {
      assetId: "source",
      analysisAssetId: "foreign-proxy",
      sourceRightsConfirmed: true,
    };
    expect((await request("/api/ai/analyze", input)).status).toBe(404);
    expect(
      (
        await request("/api/ai/analyze", {
          ...input,
          analysisAssetId: "short-proxy",
        })
      ).status
    ).toBe(422);
    expect(balance()).toBe(before);
    expect(providerCalls.length).toBe(calls);
    const good = await request("/api/ai/analyze", {
      ...input,
      analysisAssetId: "proxy",
    });
    expect(good.status).toBe(200);
    expect(await good.json()).toMatchObject({
      review: { ending: null, captions: "unknown" },
    });
    const payload = providerCalls.at(-1)! as {
      messages: Array<{ content: unknown }>;
    };
    expect(payload.messages[1].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "video_url",
          video_url: { url: expect.stringMatching(/^data:video\/mp4;base64,/) },
        }),
      ])
    );
  });
});

it("normalizes a preset-driven graphic revision and replays its paid plan", async () => {
  const { normalizeGraphic } = await import("../contracts/motion-graphics");
  const { editorTaskPreset } = await import("../contracts/editor-chat-presets");
  const { applyChatAction } = await import("../src/lib/editor-chat-execution");
  const previousOutput = nextOutput;
  const { workspace } = (await (await request("/api/workspace")).json()) as {
    workspace: WorkspaceDocument;
  };
  const graphic = normalizeGraphic({
    kind: "callout",
    text: "Your key message",
    color: "#FFF4CC",
    background: "#314159",
    x: 42,
    y: 34,
    size: 6,
    animation: "pop",
    motion: [
      { at: 0, x: 40, y: 34, scale: 0.9, rotation: 0, easing: "ease-out" },
      { at: 1, x: 42, y: 34, scale: 1, rotation: 0 },
    ],
  })!;
  const project = {
    ...workspace.projects[0],
    id: "graphic-project",
    clips: [
      ...workspace.projects[0].clips,
      {
        id: "graphic-title",
        track: "overlay" as const,
        lane: 2,
        label: "Your key message",
        start: 3,
        duration: 4,
        inPoint: 1,
        outPoint: 5,
        graphicDuration: 8,
        color: graphic.background,
        locked: false,
        graphic,
      },
    ],
  };
  workspace.projects.push(project);
  expect(
    (await request("/api/workspace", { workspace }, "owner@example.com", "PUT"))
      .status
  ).toBe(200);
  const preset = editorTaskPreset("motion")!;
  nextOutput = {
    message: "Revise the selected callout.",
    actions: [
      {
        id: "revise-title",
        kind: "edit",
        label: "Revise callout",
        reason: "Use the supplied words in the existing graphic.",
        scope: "requested",
        requestExcerpt: preset.intent,
        dependsOn: [],
        operation: {
          type: "graphic",
          start: 3,
          end: 7,
          targetClipIds: ["graphic-title"],
          parameters: {
            graphicMode: "update",
            graphic: { text: "Something New", animation: "slide" },
          },
        },
      },
    ],
  };
  try {
    const before = balance(),
      calls = providerCalls.length;
    const body = chat("route-graphic-update-001", {
      projectId: project.id,
      prompt: "Use the words Something New.",
      selectedClipIds: ["graphic-title"],
      taskPreset: "motion",
      executionMode: "plan",
      workflow: "Forged client instructions must be ignored",
    });
    const response = await request("/api/ai/editor-chat", body);
    expect(response.status).toBe(200);
    const plan =
      (await response.json()) as import("../contracts/editor-chat").EditorChatResponse;
    expect(plan.blockedReasons).toEqual([]);
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({
      kind: "edit",
      scope: "requested",
      operation: {
        targetClipIds: ["graphic-title"],
        parameters: {
          graphicMode: "update",
          graphic: { ...graphic, text: "Something New", animation: "slide" },
        },
      },
    });
    const payload = providerCalls.at(-1)! as {
      messages: Array<{ content: string }>;
    };
    expect(JSON.parse(payload.messages[1].content)).toMatchObject({
      executionMode: "plan",
      taskPreset: { id: "motion", workflow: preset.workflow },
    });
    const edited = applyChatAction(project, plan.actions[0], workspace.assets);
    expect(edited.clips).toHaveLength(project.clips.length);
    expect(edited.clips.find(c => c.id === "graphic-title")).toMatchObject({
      id: "graphic-title",
      lane: 2,
      start: 3,
      duration: 4,
      inPoint: 1,
      outPoint: 5,
      graphicDuration: 8,
      label: "Something New",
      graphic: { ...graphic, text: "Something New", animation: "slide" },
    });
    expect(applyChatAction(edited, plan.actions[0], workspace.assets)).toEqual(
      edited
    );
    const replay = await request("/api/ai/editor-chat", body);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(plan);
    expect(balance()).toBe(before - 5);
    expect(providerCalls.length).toBe(calls + 1);
  } finally {
    nextOutput = previousOutput;
  }
});
