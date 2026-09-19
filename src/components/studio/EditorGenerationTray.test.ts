import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createEmptyWorkspace, type GenerationJob } from "@contracts/workspace";
import { nextEditorGeneration } from "@/lib/editor-generations";
import { EditorGenerationTray } from "./EditorGenerationTray";

const now = "2026-09-15T10:00:00.000Z";

describe("existing video output recovery", () => {
  it("offers recovery only for eligible failed video jobs and does not start recovery by rendering", () => {
    const workspace = createEmptyWorkspace("test@example.com");
    const video = {
      ...nextEditorGeneration(
        workspace,
        "project",
        "video",
        "video-request",
        now
      ),
      status: "failed" as const,
      jobId: "video-request",
    };
    const image = {
      ...nextEditorGeneration(
        workspace,
        "project",
        "image",
        "image-request",
        now
      ),
      status: "failed" as const,
    };
    const job: GenerationJob = {
      id: video.id,
      type: "video",
      status: "failed",
      projectId: "project",
      progress: 100,
      canRecover: true,
      createdAt: now,
      updatedAt: now,
    };
    const recover = vi.fn(async () => undefined);
    const check = vi.fn(async () => undefined);
    const html = renderToStaticMarkup(
      createElement(EditorGenerationTray, {
        records: [video, image],
        assets: [],
        jobs: [job],
        checking: [],
        onCheck: check,
        onRename: async () => undefined,
        onRecoverVideo: recover,
      })
    );
    expect(html.match(/Recover video/g)).toHaveLength(1);
    expect(html).toContain("Check image");
    expect(html).toContain("no new generation or credit charge");
    expect(recover).not.toHaveBeenCalled();
    expect(check).not.toHaveBeenCalled();
    const unavailable = renderToStaticMarkup(
      createElement(EditorGenerationTray, {
        records: [video],
        assets: [],
        jobs: [{ ...job, canRecover: false }],
        checking: [],
        onCheck: check,
        onRename: async () => undefined,
        onRecoverVideo: recover,
      })
    );
    expect(unavailable).not.toContain("Recover video");
    expect(unavailable).toContain("Check video");
  });
  it("disables recovery while the existing output request is active", () => {
    const workspace = createEmptyWorkspace("test@example.com");
    const record = {
      ...nextEditorGeneration(
        workspace,
        "project",
        "video",
        "video-request",
        now
      ),
      status: "failed" as const,
      jobId: "video-request",
    };
    const job: GenerationJob = {
      id: record.id,
      type: "video",
      status: "failed",
      projectId: "project",
      progress: 100,
      canRecover: true,
      createdAt: now,
      updatedAt: now,
    };
    const html = renderToStaticMarkup(
      createElement(EditorGenerationTray, {
        records: [record],
        assets: [],
        jobs: [job],
        checking: [record.id],
        onCheck: async () => undefined,
        onRename: async () => undefined,
        onRecoverVideo: async () => undefined,
      })
    );
    expect(html).toContain("Recovering video…");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>/);
  });
});
