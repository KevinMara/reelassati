import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditProject, WorkspaceDocument } from "@contracts/workspace";

const harness = vi.hoisted(() => ({
  workspace: undefined as unknown as WorkspaceDocument,
  cleanups: [] as Array<() => void>,
  update: vi.fn(),
  captureScope: vi.fn(),
  analyzeMedia: vi.fn(),
  provider: vi.fn(),
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
  platformApi: {},
  captureUploadRequestScope: () => harness.captureScope(),
  verifyUploadRequestScope: vi.fn(),
}));
vi.mock("@/lib/analyze-media", () => ({
  analyzeMedia: (...args: unknown[]) => harness.analyzeMedia(...args),
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
