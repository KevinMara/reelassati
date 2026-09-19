import { describe, expect, it, vi } from "vitest";
import { editorAudioCatalog } from "@contracts/editor-audio-catalog";
import type { Asset, EditProject } from "@contracts/workspace";
import {
  applyChatCatalogAudio,
  resolveChatCatalogAudio,
  type CatalogAudioAction,
} from "./editor-chat-catalog-audio";
import { restoreEditorRevision } from "./editor-history";

const entry = editorAudioCatalog.find(item => item.type === "sfx")!;
const uploaded: Asset = {
  id: "saved-sound",
  kind: "audio",
  name: "New upload.wav",
  contentType: "audio/wav",
  size: 100,
  url: "/api/assets/saved-sound",
  status: "ready",
  createdAt: "2026-09-19",
};
const saved: Asset = {
  ...uploaded,
  name: "My transition",
  duration: entry.duration,
  variantGroupId: `builtin-audio:${entry.id}`,
};
const project: EditProject = {
  id: "edit",
  title: "Edit",
  template: "blank",
  status: "editing",
  platform: "instagram",
  aspectRatio: "9:16",
  duration: 10,
  playhead: 0,
  createdAt: "2026-09-19",
  updatedAt: "2026-09-19",
  clips: [],
  transcript: [],
  proposedChanges: [],
  qualitySignals: [],
  revisions: [],
};
const action: CatalogAudioAction = {
  id: "place-sound",
  kind: "catalog-audio",
  catalogId: entry.id,
  label: "Add whoosh",
  reason: "Requested",
  scope: "requested",
  requestExcerpt: "Add whoosh",
  credits: 0,
  dependsOn: [],
  status: "pending",
  insert: { start: 4, duration: entry.duration },
};

describe("free catalog file execution", () => {
  it("reuses an existing renamed Library file without fetching, uploading, or generating it again", async () => {
    const fetcher = vi.fn();
    const upload = vi.fn();
    expect(
      await resolveChatCatalogAudio(entry.id, [saved], upload, fetcher)
    ).toEqual(saved);
    expect(fetcher).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });
  it("loads only the bundled path and saves the actual source duration plus catalog identity", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(new Uint8Array([82, 73, 70, 70]), {
          headers: { "Content-Type": "audio/wav" },
        })
    );
    const upload = vi.fn(async (file: File) => {
      expect(file.type).toBe("audio/wav");
      expect(file.name).toBe(`${entry.name}.wav`);
      return uploaded;
    });
    const result = await resolveChatCatalogAudio(entry.id, [], upload, fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      `/shared-assets/audio/${entry.file}`,
      expect.objectContaining({
        credentials: "same-origin",
        signal: expect.any(AbortSignal),
      })
    );
    expect(result).toMatchObject({
      id: uploaded.id,
      duration: entry.duration,
      variantGroupId: `builtin-audio:${entry.id}`,
      name: entry.name,
    });
    expect(upload).toHaveBeenCalledTimes(1);
  });
  it("rejects missing files and an HTML fallback instead of uploading fake audio", async () => {
    const upload = vi.fn();
    await expect(
      resolveChatCatalogAudio(
        entry.id,
        [],
        upload,
        vi.fn(async () => new Response("missing", { status: 404 }))
      )
    ).rejects.toThrow("could not be downloaded");
    await expect(
      resolveChatCatalogAudio(
        entry.id,
        [],
        upload,
        vi.fn(
          async () =>
            new Response("<html>app</html>", {
              headers: { "Content-Type": "text/html" },
            })
        )
      )
    ).rejects.toThrow("invalid media");
    expect(upload).not.toHaveBeenCalled();
  });
  it("rejects an unknown catalog identifier before any network work", async () => {
    const fetcher = vi.fn();
    const upload = vi.fn();
    await expect(
      resolveChatCatalogAudio("../../secret", [], upload, fetcher)
    ).rejects.toThrow("available free audio");
    expect(fetcher).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });
  it("keeps save-only actions off the timeline and makes insertion idempotent and undoable", () => {
    expect(
      applyChatCatalogAudio(project, saved, { ...action, insert: undefined })
    ).toBe(project);
    const inserted = applyChatCatalogAudio(project, saved, action);
    expect(inserted.clips).toHaveLength(1);
    expect(inserted.clips[0]).toMatchObject({
      assetId: saved.id,
      start: 4,
      duration: entry.duration,
      track: "audio",
      label: "My transition",
    });
    const replay = applyChatCatalogAudio(inserted, saved, action);
    expect(replay.clips).toHaveLength(1);
    expect(replay.revisions).toHaveLength(inserted.revisions.length);
    expect(restoreEditorRevision(inserted, 0).clips).toEqual(project.clips);
  });
  it("revalidates placement against a newly shortened timeline before modifying it", () => {
    expect(() =>
      applyChatCatalogAudio({ ...project, duration: 3 }, saved, action)
    ).toThrow("inside the timeline");
    expect(project.clips).toEqual([]);
  });
});
