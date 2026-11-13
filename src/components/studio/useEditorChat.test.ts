import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Asset,
  EditProject,
  WorkspaceDocument,
} from "@contracts/workspace";
import type { EditorChatAction } from "@contracts/editor-chat";
import { editorEffectCatalog } from "@contracts/editor-effect-catalog";
import {
  sharedCatalogPlanningAssets,
  type SharedMediaCatalogItem,
} from "@contracts/shared-media-catalog";
import type { CatalogOverlayPreflightOptions } from "@/lib/catalog-overlay-preflight";

const harness = vi.hoisted(() => ({
  workspace: undefined as unknown as WorkspaceDocument,
  cleanups: [] as Array<() => void>,
  update: vi.fn(),
  captureScope: vi.fn(),
  analyzeMedia: vi.fn(),
  editorChat: vi.fn(),
  transcribeMedia: vi.fn(),
  provider: vi.fn(),
  resolveSharedCatalogAsset: vi.fn(),
  resolveCatalogEffect: vi.fn(),
  overlayPreflight: vi.fn(),
  overlayBinding: vi.fn(),
}));

// Exercise the hook's real async coordinator without mounting browser UI.
vi.mock("react", () => ({
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => [
    typeof initial === "function" ? initial() : initial,
    vi.fn(),
  ],
  useMemo: (factory: () => unknown) => factory(),
  useEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (cleanup) harness.cleanups.push(cleanup);
  },
}));
vi.mock("@/lib/i18n/ui", () => ({ translateUi: (text: string) => text }));
vi.mock("@/lib/workspace-scope", () => ({ selectedBrand: () => "brand" }));
vi.mock("@/providers/workspace", () => ({
  useWorkspace: () => ({
    workspace: harness.workspace,
    getWorkspaceSnapshot: () => harness.workspace,
    updateWorkspace: harness.update,
  }),
}));
vi.mock("@/lib/platform-api", () => ({
  platformApi: {
    editorChat: (...args: unknown[]) => harness.editorChat(...args),
  },
  captureUploadRequestScope: () => harness.captureScope(),
  verifyUploadRequestScope: vi.fn(),
}));
vi.mock("@/lib/analyze-media", () => ({
  analyzeMedia: (...args: unknown[]) => harness.analyzeMedia(...args),
}));
vi.mock("@/lib/transcribe-media", () => ({
  transcribeMedia: (...args: unknown[]) => harness.transcribeMedia(...args),
}));
vi.mock("@/lib/shared-media-catalog", async importOriginal => ({
  ...(await importOriginal<typeof import("@/lib/shared-media-catalog")>()),
  resolveSharedCatalogAsset: (...args: unknown[]) =>
    harness.resolveSharedCatalogAsset(...args),
}));
vi.mock("@/lib/editor-chat-catalog-effect", async importOriginal => ({
  ...(await importOriginal<
    typeof import("@/lib/editor-chat-catalog-effect")
  >()),
  resolveChatCatalogEffect: (...args: unknown[]) =>
    harness.resolveCatalogEffect(...args),
}));
vi.mock("@/lib/catalog-overlay-preflight", () => ({
  preflightCatalogOverlays: (...args: unknown[]) =>
    harness.overlayPreflight(...args),
  catalogOverlayDraftBinding: (...args: unknown[]) =>
    harness.overlayBinding(...args),
}));

import { useEditorChat } from "./useEditorChat";
import { activeEditorProjects } from "@/lib/editor-run-lock";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

const scope = { ownerEmail: "owner@example.com", brandId: "brand" };
const savedMessage = () =>
  harness.workspace.projects[0].editorChat!.messages[0];

beforeEach(() => {
  vi.clearAllMocks();
  harness.cleanups = [];
  activeEditorProjects.clear();
  const project = {
    id: "project",
    updatedAt: "2026-10-26T10:00:00.000Z",
    platform: "instagram",
    duration: 10,
    clips: [],
    transcript: [],
    revisions: [],
    proposedChanges: [],
    editorChat: {
      mode: "ask",
      maxCredits: 200,
      preferencesVersion: 2,
      messages: [
        {
          id: "message",
          role: "assistant",
          text: "Review the source",
          status: "ready",
          mode: "ask",
          maxCredits: 200,
          usedCredits: 5,
          createdAt: "2026-10-26T10:00:00.000Z",
          plan: {
            requestId: "request-0000000001",
            projectId: "project",
            projectUpdatedAt: "2026-10-26T10:00:00.000Z",
            actions: [
              {
                id: "analysis",
                kind: "analyze",
                assetId: "video",
                label: "Review source",
                reason: "Requested",
                requestExcerpt: "Review source",
                scope: "requested",
                status: "pending",
                credits: 25,
                dependsOn: [],
              },
            ],
            blockedReasons: [],
          },
        },
      ],
    },
  } as unknown as EditProject;
  harness.workspace = {
    profile: { email: scope.ownerEmail },
    projects: [project],
    assets: [{ id: "video", name: "Source.mp4", kind: "video" }],
  } as unknown as WorkspaceDocument;
  harness.captureScope.mockResolvedValue(scope);
  harness.overlayBinding.mockImplementation(
    (options: CatalogOverlayPreflightOptions) =>
      JSON.stringify({
        clips: options.project.clips,
        regions: options.project.sourceReviews,
        tracks: options.project.trackSettings,
        aspectRatio: options.project.aspectRatio,
        assets: options.assets.map(asset => [
          asset.id,
          asset.duration,
          asset.width,
          asset.height,
          asset.catalog?.media.sha256,
        ]),
        owners: options.operationClipIds,
      })
  );
  harness.overlayPreflight.mockImplementation(
    async (options: CatalogOverlayPreflightOptions) => ({
      checkedOperationIds: Object.keys(options.operationClipIds),
      blockedOperationIds: [],
      unverifiedOperationIds: [],
      findings: [],
      canvas: { width: 1080, height: 1920, frameRate: 30 },
      draftBinding: harness.overlayBinding(options),
    })
  );
  harness.analyzeMedia.mockImplementation(async (...args: unknown[]) => {
    (args[4] as AbortSignal).throwIfAborted();
    harness.provider();
    return { summary: "Source reviewed", review: {}, retention: [] };
  });
  harness.update.mockImplementation(
    async (updater: (w: WorkspaceDocument) => WorkspaceDocument) => {
      harness.workspace = updater(harness.workspace);
      return harness.workspace;
    }
  );
});

afterEach(() => {
  for (const cleanup of harness.cleanups) cleanup();
  activeEditorProjects.clear();
});

describe("Reel cancellation while persisting an action claim", () => {
  it.each(["stop", "unmount"] as const)(
    "does not submit analysis after %s during the claim save",
    async cancellation => {
      const claimed = deferred();
      const releaseClaim = deferred();
      let held = false;
      harness.update.mockImplementation(
        async (updater: (w: WorkspaceDocument) => WorkspaceDocument) => {
          const before = savedMessage().plan!.actions[0].status;
          harness.workspace = updater(harness.workspace);
          if (
            !held &&
            before === "pending" &&
            savedMessage().plan!.actions[0].status === "running"
          ) {
            held = true;
            claimed.resolve();
            await releaseClaim.promise;
          }
          return harness.workspace;
        }
      );
      const chat = useEditorChat(harness.workspace.projects[0], {
        onSeek: vi.fn(),
      });
      const running = chat.resume("message");
      await claimed.promise;
      if (cancellation === "stop") chat.stop();
      else for (const cleanup of harness.cleanups) cleanup();
      releaseClaim.resolve();
      await running;

      expect(harness.captureScope).not.toHaveBeenCalled();
      expect(harness.analyzeMedia).not.toHaveBeenCalled();
      expect(harness.provider).not.toHaveBeenCalled();
      expect(savedMessage()).toMatchObject({
        status: "stopped",
        usedCredits: 5,
      });
      expect(savedMessage().plan!.actions[0]).toMatchObject({
        status: "pending",
      });
      expect(
        savedMessage().plan!.actions[0].runtime?.startedAt
      ).toBeUndefined();
      expect(activeEditorProjects.size).toBe(0);
    }
  );

  it("keeps Stop effective while analysis is acquiring its request scope", async () => {
    const capturing = deferred();
    const releaseScope = deferred<typeof scope>();
    harness.captureScope.mockImplementation(() => {
      capturing.resolve();
      return releaseScope.promise;
    });
    const chat = useEditorChat(harness.workspace.projects[0], {
      onSeek: vi.fn(),
    });
    const running = chat.resume("message");
    await capturing.promise;
    chat.stop();
    releaseScope.resolve(scope);
    await running;
    expect(harness.analyzeMedia).not.toHaveBeenCalled();
    expect(harness.provider).not.toHaveBeenCalled();
    expect(savedMessage().status).toBe("stopped");
  });

  it("executes the same claimed analysis once when no cancellation occurs", async () => {
    const chat = useEditorChat(harness.workspace.projects[0], {
      onSeek: vi.fn(),
    });
    await chat.resume("message");
    expect(harness.provider).toHaveBeenCalledTimes(1);
    expect(savedMessage().status).toBe("completed");
    expect(savedMessage().plan!.actions[0].status).toBe("completed");
    expect(activeEditorProjects.size).toBe(0);
  });
});

describe("saved additions and input retention", () => {
  it("rejects a failed initial request save so the composer can restore its input", async () => {
    harness.update.mockRejectedValue(new Error("The workspace has not loaded"));
    const before = structuredClone(harness.workspace);
    const chat = useEditorChat(harness.workspace.projects[0], {
      onSeek: vi.fn(),
    });

    await expect(chat.send("Keep this exact instruction")).rejects.toThrow(
      "The workspace has not loaded"
    );

    expect(harness.workspace).toEqual(before);
    expect(harness.editorChat).not.toHaveBeenCalled();
    expect(activeEditorProjects.size).toBe(0);
  });

  it("retains every accepted addition when more than thirty are submitted", async () => {
    const chat = useEditorChat(harness.workspace.projects[0], {
      onSeek: vi.fn(),
      externalBusy: true,
    });
    for (let index = 0; index < 35; index++) {
      expect(await chat.send(`Instruction ${index}`)).toBe(true);
    }
    const messages = harness.workspace.projects[0].editorChat!.messages;
    expect(messages.filter(message => message.pendingAddition)).toHaveLength(
      35
    );
    expect(
      messages.filter(message => message.role === "user").map(m => m.text)
    ).toEqual(Array.from({ length: 35 }, (_, index) => `Instruction ${index}`));
    expect(messages.some(message => message.id === "message")).toBe(true);
    expect(harness.editorChat).not.toHaveBeenCalled();
  });

  it("rejects an oversized addition before discarding accepted instructions", async () => {
    const chat = useEditorChat(harness.workspace.projects[0], {
      onSeek: vi.fn(),
      externalBusy: true,
    });
    const reference = { name: "notes", text: "a".repeat(16000) };
    for (let index = 0; index < 8; index++)
      await chat.send(`Keep accepted addition ${index}`, [reference]);
    const before = structuredClone(harness.workspace);
    await expect(
      chat.send("Do not lose this next draft", [reference])
    ).rejects.toThrow("saved chat limit");
    expect(harness.workspace).toEqual(before);
    expect(harness.editorChat).not.toHaveBeenCalled();
  });

  it("resumes a single-range addition without replacing captions outside its saved range", async () => {
    const project = harness.workspace.projects[0];
    project.duration = 30;
    project.clips = [
      {
        id: "clip",
        assetId: "video",
        track: "video",
        start: 0,
        duration: 30,
        inPoint: 0,
        outPoint: 30,
        speed: 1,
      },
    ] as EditProject["clips"];
    project.transcript = [
      { id: "before", start: 0, end: 5, text: "Keep before" },
      { id: "inside", start: 12, end: 18, text: "Replace inside" },
      { id: "after", start: 25, end: 30, text: "Keep after" },
    ];
    const chat = useEditorChat(project, {
      onSeek: vi.fn(),
      externalBusy: true,
    });
    const references = [{ name: "style", text: "Use sentence case" }];
    await chat.send(
      "Replace captions in this selection",
      references,
      { start: 10, end: 20 },
      ["clip"]
    );
    const addition = harness.workspace.projects[0].editorChat!.messages.at(-1)!;
    const request = structuredClone(addition.request);
    chat.stop();
    harness.editorChat.mockResolvedValue({
      ...savedMessage().plan!,
      requestId: addition.requestId,
      message: "Replacing the selected captions",
      actions: [
        {
          id: "captions",
          kind: "transcribe",
          assetIds: ["video"],
          replace: true,
          label: "Captions",
          reason: "Requested",
          requestExcerpt: "Replace captions",
          scope: "requested",
          status: "pending",
          credits: 0,
          dependsOn: [],
        },
      ],
    });
    harness.transcribeMedia.mockResolvedValue({
      segments: [
        { id: "new", start: 0, end: 30, text: "New measured captions" },
      ],
    });

    await chat.resume(addition.id);

    expect(harness.editorChat).toHaveBeenCalledTimes(1);
    expect(harness.editorChat.mock.calls[0][0]).toMatchObject(request!);
    const current = harness.workspace.projects[0];
    const resumed = current.editorChat!.messages.find(
      m => m.id === addition.id
    )!;
    expect(resumed).toMatchObject({
      range: { start: 10, end: 20 },
      selectedClipIds: ["clip"],
      references,
      usedCredits: 5,
      status: "completed",
    });
    expect(current.transcript).toEqual([
      { id: "before", start: 0, end: 5, text: "Keep before" },
      expect.objectContaining({
        start: 10,
        end: 20,
        text: "New measured captions",
      }),
      { id: "after", start: 25, end: 30, text: "Keep after" },
    ]);
  });

  it("counts a resumed addition's first planning charge against its saved cap", async () => {
    harness.workspace.projects[0].editorChat!.maxCredits = 5;
    const chat = useEditorChat(harness.workspace.projects[0], {
      onSeek: vi.fn(),
      externalBusy: true,
    });
    await chat.send("Review this source");
    const addition = harness.workspace.projects[0].editorChat!.messages.at(-1)!;
    chat.stop();
    harness.editorChat.mockResolvedValue({
      ...savedMessage().plan!,
      requestId: addition.requestId,
      message: "Reviewing the source",
      actions: [{ ...savedMessage().plan!.actions[0], credits: 5 }],
    });
    await chat.resume(addition.id);

    expect(harness.editorChat).toHaveBeenCalledTimes(1);
    expect(harness.analyzeMedia).not.toHaveBeenCalled();
    expect(
      harness.workspace.projects[0].editorChat!.messages.at(-1)
    ).toMatchObject({
      usedCredits: 5,
      plan: { actions: [expect.objectContaining({ status: "pending" })] },
    });
  });

  it.each(["stop", "unmount"] as const)(
    "starts no planning after %s during an addition's resume save",
    async cancellation => {
      const chat = useEditorChat(harness.workspace.projects[0], {
        onSeek: vi.fn(),
        externalBusy: true,
      });
      await chat.send("Keep this addition saved");
      const addition =
        harness.workspace.projects[0].editorChat!.messages.at(-1)!;
      chat.stop();
      const saving = deferred();
      const release = deferred();
      harness.update.mockImplementation(
        async (updater: (w: WorkspaceDocument) => WorkspaceDocument) => {
          harness.workspace = updater(harness.workspace);
          saving.resolve();
          await release.promise;
          return harness.workspace;
        }
      );
      const resuming = chat.resume(addition.id);
      await saving.promise;
      if (cancellation === "stop") chat.stop();
      else for (const cleanup of harness.cleanups) cleanup();
      release.resolve();
      await resuming;
      expect(harness.editorChat).not.toHaveBeenCalled();
      expect(activeEditorProjects.size).toBe(0);
      expect(
        harness.workspace.projects[0].editorChat!.messages.at(-1)?.request
      ).toMatchObject(addition.request!);
    }
  );

  it("adds current conversation only to an unattempted addition, then retries its exact saved body", async () => {
    const parentPlan = savedMessage().plan!;
    const chat = useEditorChat(harness.workspace.projects[0], {
      onSeek: vi.fn(),
      externalBusy: true,
    });
    await chat.send("Make that calmer");
    const addition = harness.workspace.projects[0].editorChat!.messages.at(-1)!;
    await chat.send("A later instruction that must wait");
    chat.stop();
    const parent = savedMessage();
    parent.status = "completed";
    parent.text = "The current source review is saved";
    const calls: string[] = [];
    harness.editorChat.mockImplementation(async request => {
      const saved = harness.workspace.projects[0].editorChat!.messages.find(
        m => m.id === addition.id
      )!;
      expect(saved.planningAttempted).toBe(true);
      expect(saved.request).toEqual(request);
      calls.push(JSON.stringify(request));
      if (calls.length === 1) throw new Error("Response connection was lost");
      return {
        ...parentPlan,
        requestId: request.requestId,
        message: "Ready",
        actions: [],
      };
    });

    await chat.resume(addition.id);
    const firstRequest = JSON.parse(calls[0]);
    expect(firstRequest.history).toEqual([
      { role: "assistant", text: "The current source review is saved" },
    ]);
    expect(JSON.stringify(firstRequest.history)).not.toContain(
      "A later instruction"
    );
    savedMessage().text = "New context after the original attempt";
    await chat.resume(addition.id);

    expect(calls).toHaveLength(2);
    expect(calls[1]).toBe(calls[0]);
    expect(
      harness.workspace.projects[0].editorChat!.messages.find(
        m => m.id === addition.id
      )
    ).toMatchObject({
      planningAttempted: true,
      usedCredits: 5,
      status: "completed",
    });
  });

  it("preserves a legacy addition's request body when its attempt state is unknown", async () => {
    const plan = savedMessage().plan!;
    const chat = useEditorChat(harness.workspace.projects[0], {
      onSeek: vi.fn(),
      externalBusy: true,
    });
    await chat.send("Legacy saved addition");
    const addition = harness.workspace.projects[0].editorChat!.messages.at(-1)!;
    delete addition.planningAttempted;
    const request = structuredClone(addition.request);
    chat.stop();
    harness.editorChat.mockResolvedValue({
      ...plan,
      message: "Ready",
      actions: [],
    });

    await chat.resume(addition.id);

    expect(harness.editorChat.mock.calls[0][0]).toEqual(request);
    expect(harness.editorChat.mock.calls[0][0]).not.toHaveProperty("history");
  });
});

describe("Reel catalog overlay pixel checks", () => {
  const useOverlayFixture = (
    kind: "shared-media" | "catalog-effect",
    insert = true
  ) => {
    const project = harness.workspace.projects[0];
    project.aspectRatio = "9:16";
    project.frameRate = 30;
    project.clips = [
      {
        id: "source-clip",
        assetId: "video",
        track: "video",
        start: 0,
        duration: 10,
        inPoint: 0,
        outPoint: 10,
        locked: false,
        label: "Source",
        color: "#ffffff",
        primaryFootage: true,
      },
    ];
    harness.workspace.assets = [
      {
        id: "video",
        kind: "video",
        status: "ready",
        duration: 10,
        width: 1080,
        height: 1920,
        name: "Source.mp4",
        url: "/source",
        createdAt: "2026-11-13",
      },
    ] as Asset[];
    const hash = "a".repeat(64);
    const item: SharedMediaCatalogItem = {
      id: `stock-${hash.slice(0, 24)}`,
      name: "Film frame",
      group: "Frames",
      designId: "frame",
      variant: "portrait",
      kind: "video",
      tags: ["frame"],
      duration: 2,
      width: 1080,
      height: 1920,
      blendMode: "screen",
      media: {
        file: `media/${hash}.mp4`,
        sha256: hash,
        bytes: 100,
        contentType: "video/mp4",
      },
      poster: {
        file: `media/${"b".repeat(64)}.png`,
        sha256: "b".repeat(64),
        bytes: 10,
        contentType: "image/png",
      },
      license: "platform-licensed",
      credits: 0,
    };
    const entry = editorEffectCatalog[0];
    const asset: Asset =
      kind === "shared-media"
        ? {
            ...sharedCatalogPlanningAssets([item])[0],
            id: "overlay-asset",
            url: "/overlay",
          }
        : ({
            id: "overlay-asset",
            kind: "video",
            name: entry.name,
            status: "ready",
            duration: entry.duration,
            width: entry.width,
            height: entry.height,
            url: "/effect",
            createdAt: "2026-11-13",
            variantGroupId: `builtin-effect:${entry.id}`,
          } as Asset);
    const action: EditorChatAction = {
      id: "overlay",
      ...(kind === "shared-media"
        ? { kind, catalogId: item.id, catalog: item }
        : { kind, catalogId: entry.id }),
      label: "Add the overlay",
      reason: "Requested",
      requestExcerpt: "Add this overlay",
      scope: "requested",
      status: "pending",
      credits: 0,
      dependsOn: [],
      ...(insert
        ? { insert: { start: 1, duration: Math.min(1, asset.duration ?? 1) } }
        : {}),
    };
    savedMessage().plan!.actions = [action];
    harness.resolveSharedCatalogAsset.mockResolvedValue(asset);
    harness.resolveCatalogEffect.mockResolvedValue(asset);
    return {
      asset,
      project,
      chat: useEditorChat(project, { onSeek: vi.fn() }),
    };
  };

  it.each(["shared-media", "catalog-effect"] as const)(
    "checks the final %s draft before saving its insertion",
    async kind => {
      const { chat, asset } = useOverlayFixture(kind);
      const original = structuredClone(harness.workspace.projects[0].clips);
      harness.overlayPreflight.mockImplementation(
        async (options: CatalogOverlayPreflightOptions) => {
          expect(harness.workspace.projects[0].clips).toEqual(original);
          expect(harness.workspace.assets).toContainEqual(asset);
          expect(options.operationClipIds).toEqual({
            overlay: ["chat-clip-overlay"],
          });
          expect(
            options.project.clips.find(clip => clip.id === "chat-clip-overlay")
          ).toMatchObject({
            assetId: asset.id,
            start: 1,
            duration: Math.min(1, asset.duration ?? 1),
            visual: { blendMode: "screen" },
          });
          return {
            checkedOperationIds: ["overlay"],
            blockedOperationIds: [],
            unverifiedOperationIds: [],
            findings: [],
            draftBinding: harness.overlayBinding(options),
          };
        }
      );
      await chat.resume("message");
      expect(harness.overlayPreflight).toHaveBeenCalledTimes(1);
      expect(harness.workspace.projects[0].clips).toHaveLength(2);
      expect(savedMessage().plan!.actions[0].status).toBe("completed");
    }
  );

  it.each([
    "blocked",
    "unverified",
    "missing-check",
    "wrong-binding",
    "failure",
  ] as const)(
    "keeps the Library asset and original timeline when pixels are %s",
    async result => {
      const { chat, asset } = useOverlayFixture("shared-media");
      const original = structuredClone(harness.workspace.projects[0]);
      harness.overlayPreflight.mockImplementation(
        async (options: CatalogOverlayPreflightOptions) => {
          if (result === "failure")
            throw new Error("Private renderer diagnostic");
          return {
            checkedOperationIds: result === "wrong-binding" ? ["overlay"] : [],
            blockedOperationIds: result === "blocked" ? ["overlay"] : [],
            unverifiedOperationIds: result === "unverified" ? ["overlay"] : [],
            findings: [],
            draftBinding:
              result === "wrong-binding"
                ? "another-draft"
                : harness.overlayBinding(options),
          };
        }
      );
      await chat.resume("message");
      const current = harness.workspace.projects[0];
      expect(current.clips).toEqual(original.clips);
      expect(current.revisions).toEqual(original.revisions);
      expect(harness.workspace.assets).toContainEqual(asset);
      expect(savedMessage().plan!.actions[0]).toMatchObject({
        status: "blocked",
      });
      expect(savedMessage().plan!.actions[0].error).toContain(
        "saved in Library"
      );
      expect(savedMessage().plan!.actions[0].error).not.toContain("Private");
    }
  );

  it.each(["version", "geometry", "source-evidence", "asset"] as const)(
    "never inserts a stale overlay after %s changes during its check",
    async change => {
      const { chat, asset } = useOverlayFixture("shared-media");
      const checking = deferred();
      const release = deferred();
      harness.overlayPreflight.mockImplementation(
        async (options: CatalogOverlayPreflightOptions) => {
          const draftBinding = harness.overlayBinding(options);
          checking.resolve();
          await release.promise;
          return {
            checkedOperationIds: ["overlay"],
            blockedOperationIds: [],
            unverifiedOperationIds: [],
            findings: [],
            draftBinding,
          };
        }
      );
      const running = chat.resume("message");
      await checking.promise;
      const current = harness.workspace.projects[0];
      if (change === "version") current.updatedAt = "2026-11-13T12:00:00.000Z";
      if (change === "geometry")
        current.clips[0].visual = { scale: 1.2 } as NonNullable<
          EditProject["clips"][number]["visual"]
        >;
      if (change === "source-evidence")
        current.sourceReviews = [
          {
            assetId: "video",
            reviewedAt: "now",
            summary: "New source evidence",
          },
        ] as NonNullable<EditProject["sourceReviews"]>;
      if (change === "asset")
        harness.workspace.assets.find(item => item.id === "video")!.width = 720;
      const expectedClips = structuredClone(current.clips);
      release.resolve();
      await running;
      expect(harness.workspace.projects[0].clips).toEqual(expectedClips);
      expect(harness.workspace.assets).toContainEqual(asset);
      expect(savedMessage().plan!.actions[0]).toMatchObject({
        status: "blocked",
        error: expect.stringContaining("timeline changed"),
      });
    }
  );

  it("rechecks the exact project inside a delayed final workspace mutation", async () => {
    const { chat } = useOverlayFixture("catalog-effect");
    let checked = false;
    let changed = false;
    harness.overlayPreflight.mockImplementation(
      async (options: CatalogOverlayPreflightOptions) => {
        checked = true;
        return {
          checkedOperationIds: ["overlay"],
          blockedOperationIds: [],
          unverifiedOperationIds: [],
          findings: [],
          draftBinding: harness.overlayBinding(options),
        };
      }
    );
    harness.update.mockImplementation(
      async (updater: (workspace: WorkspaceDocument) => WorkspaceDocument) => {
        if (checked && !changed) {
          changed = true;
          harness.workspace.projects[0].clips[0].label =
            "Manual change after inspection";
        }
        harness.workspace = updater(harness.workspace);
        return harness.workspace;
      }
    );
    await chat.resume("message");
    expect(changed).toBe(true);
    expect(harness.workspace.projects[0].clips).toHaveLength(1);
    expect(harness.workspace.projects[0].clips[0].label).toBe(
      "Manual change after inspection"
    );
    expect(savedMessage().plan!.actions[0].error).toContain("timeline changed");
  });

  it("preserves an addition submitted while an unchanged overlay draft is being checked", async () => {
    const { chat } = useOverlayFixture("shared-media");
    const checking = deferred();
    const release = deferred();
    harness.overlayPreflight.mockImplementation(
      async (options: CatalogOverlayPreflightOptions) => {
        const draftBinding = harness.overlayBinding(options);
        checking.resolve();
        await release.promise;
        return {
          checkedOperationIds: ["overlay"],
          blockedOperationIds: [],
          unverifiedOperationIds: [],
          findings: [],
          draftBinding,
        };
      }
    );
    const running = chat.resume("message");
    await checking.promise;
    expect(await chat.send("Keep the newer title instruction")).toBe(true);
    release.resolve();
    await running;
    expect(harness.workspace.projects[0].clips).toHaveLength(2);
    expect(
      harness.workspace.projects[0].editorChat!.messages.some(
        message =>
          message.role === "user" &&
          message.text === "Keep the newer title instruction"
      )
    ).toBe(true);
    expect(
      harness.workspace.projects[0].editorChat!.messages.at(-1)?.pendingAddition
    ).toBe(true);
    expect(savedMessage().plan!.actions[0].status).toBe("completed");
  });

  it.each(["stop", "unmount"] as const)(
    "applies no overlay after %s during the pixel check",
    async cancellation => {
      const { chat, asset } = useOverlayFixture("shared-media");
      const checking = deferred();
      const release = deferred();
      harness.overlayPreflight.mockImplementation(
        async (options: CatalogOverlayPreflightOptions) => {
          const draftBinding = harness.overlayBinding(options);
          checking.resolve();
          await release.promise;
          return {
            checkedOperationIds: ["overlay"],
            blockedOperationIds: [],
            unverifiedOperationIds: [],
            findings: [],
            draftBinding,
          };
        }
      );
      const running = chat.resume("message");
      await checking.promise;
      if (cancellation === "stop") chat.stop();
      else for (const cleanup of harness.cleanups) cleanup();
      release.resolve();
      await running;
      expect(harness.workspace.projects[0].clips).toHaveLength(1);
      expect(harness.workspace.assets).toContainEqual(asset);
      expect(savedMessage().status).toBe("stopped");
    }
  );

  it.each(["shared-media", "catalog-effect"] as const)(
    "does not inspect pixels for a Library-only %s request",
    async kind => {
      const { chat, asset } = useOverlayFixture(kind, false);
      await chat.resume("message");
      expect(harness.overlayPreflight).not.toHaveBeenCalled();
      expect(harness.workspace.assets).toContainEqual(asset);
      expect(harness.workspace.projects[0].clips).toHaveLength(1);
      expect(savedMessage().plan!.actions[0].status).toBe("completed");
    }
  );

  it("also blocks an obscuring built-in effect while retaining its Library file", async () => {
    const { chat, asset } = useOverlayFixture("catalog-effect");
    harness.overlayPreflight.mockImplementation(
      async (options: CatalogOverlayPreflightOptions) => ({
        checkedOperationIds: [],
        blockedOperationIds: ["overlay"],
        unverifiedOperationIds: [],
        findings: [],
        draftBinding: harness.overlayBinding(options),
      })
    );
    await chat.resume("message");
    expect(harness.overlayPreflight).toHaveBeenCalledTimes(1);
    expect(harness.workspace.projects[0].clips).toHaveLength(1);
    expect(harness.workspace.assets).toContainEqual(asset);
    expect(savedMessage().plan!.actions[0].status).toBe("blocked");
  });

  it("preserves shared audio insertion without invoking a visual check", async () => {
    const { chat, asset } = useOverlayFixture("shared-media");
    const catalog: SharedMediaCatalogItem = {
      id: asset.catalog!.id,
      designId: "audio",
      name: "Sound",
      group: "Audio",
      variant: "original",
      tags: [],
      kind: "audio",
      duration: 2,
      waveform: Array(64).fill(0.5),
      credits: 0,
      license: "platform-licensed",
      media: {
        ...asset.catalog!.media,
        file: `media/${asset.catalog!.media.sha256}.mp3`,
        contentType: "audio/mpeg",
      },
    };
    const audio = {
      ...sharedCatalogPlanningAssets([catalog])[0],
      id: asset.id,
      url: "/audio",
    };
    harness.resolveSharedCatalogAsset.mockResolvedValue(audio);
    savedMessage().plan!.actions[0] = {
      ...savedMessage().plan!.actions[0],
      kind: "shared-media",
      catalogId: catalog.id,
      catalog,
    } as EditorChatAction;
    await chat.resume("message");
    expect(harness.overlayPreflight).not.toHaveBeenCalled();
    expect(
      harness.workspace.projects[0].clips.find(
        clip => clip.id === "chat-clip-overlay"
      )
    ).toMatchObject({ assetId: asset.id, track: "audio" });
    expect(savedMessage().plan!.actions[0].status).toBe("completed");
  });
});
