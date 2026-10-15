import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup as renderMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { createEmptyWorkspace, type GenerationJob } from "@contracts/workspace";
import { nextEditorGeneration } from "@/lib/editor-generations";
import { EditorGenerationTray } from "./EditorGenerationTray";

const now = "2026-09-15T10:00:00.000Z";
const interfaceI18n = createInstance();
beforeAll(async () => {
  await interfaceI18n.init({
    lng: "en",
    defaultNS: "ui",
    keySeparator: false,
    nsSeparator: false,
    resources: { en: { ui: {} } },
    interpolation: { escapeValue: false },
  });
});
function renderToStaticMarkup(element: ReactElement) {
  return renderMarkup(
    createElement(I18nextProvider, { i18n: interfaceI18n }, element)
  );
}

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
