import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { licensedAudioCatalog } from "@contracts/editor-audio-licensed";
import {
  editorEffectCatalog,
  catalogEffectPlacement,
} from "@contracts/editor-effect-catalog";
import { findCatalogAudio } from "@contracts/editor-catalog-audio";
import { buildEditPlanningContext } from "@contracts/edit-planning-context";
import { normalizeEditorChatState } from "@contracts/editor-chat-state";
import type { Asset, EditProject } from "@contracts/workspace";
import type { EditorChatAction } from "@contracts/editor-chat";
import {
  editorChatModelContext,
  normalizeEditorChatPlan,
  parseEditorChatRequest,
  type EditorChatContext,
} from "../../sites/editor-chat";
import { resolveChatCatalogAudio } from "./editor-chat-catalog-audio";
import {
  resolveChatCatalogEffect,
  applyChatCatalogEffect,
  type CatalogEffectAction,
} from "./editor-chat-catalog-effect";
import { placeLibraryAsset } from "./library-insertion";
import { visualCompositeFilters } from "./visual-rendering";

const project: EditProject = {
  id: "licensed-media-edit",
  title: "Edit",
  template: "blank",
  status: "editing",
  platform: "instagram",
  aspectRatio: "9:16",
  duration: 10,
  playhead: 2,
  createdAt: "2026-11-11",
  updatedAt: "2026-11-11",
  clips: [],
  transcript: [],
  proposedChanges: [],
  qualitySignals: [],
  revisions: [],
};
const uploaded: Asset = {
  id: "saved-effect",
  name: "Uploaded",
  kind: "video",
  contentType: "video/mp4",
  size: 1,
  url: "/api/assets/saved-effect",
  status: "ready",
  createdAt: "2026-11-11",
};
const effect = editorEffectCatalog[0];
const action: CatalogEffectAction = {
  id: "paint-request",
  kind: "catalog-effect",
  catalogId: effect.id,
  label: "Add a paint overlay",
  reason: "Requested",
  scope: "requested",
  requestExcerpt: "Add a paint overlay",
  credits: 0,
  status: "pending",
  dependsOn: [],
  insert: { start: 2, duration: effect.duration },
};
const context = (): EditorChatContext => ({
  request: parseEditorChatRequest({
    requestId: "licensed-request-123456",
    projectId: project.id,
    prompt: "Add a paint overlay at 2 seconds",
    mode: "ask",
    maxCredits: 5,
  }),
  project,
  assets: [],
  normalizeOperations: () => [],
  quoteAudio: vi.fn(),
  capability: () => false,
  makeId: () => "verified-action",
});

describe("licensed catalog originals", () => {
  it("ships six actual WAVs and sixteen portrait clips with measured identity and timing", () => {
    expect(licensedAudioCatalog).toHaveLength(6);
    expect(editorEffectCatalog).toHaveLength(16);
    for (const entry of [...licensedAudioCatalog, ...editorEffectCatalog]) {
      const audio = "waveform" in entry;
      const file = `public/shared-assets/${audio ? "audio" : "effects"}/${entry.file}`;
      const bytes = readFileSync(file);
      expect(bytes.length, entry.id).toBeGreaterThan(80000);
      expect(createHash("sha256").update(bytes).digest("hex"), entry.id).toBe(
        entry.sha256
      );
      const probe = JSON.parse(
        execFileSync(
          "ffprobe",
          [
            "-v",
            "error",
            "-show_entries",
            "format=duration:stream=codec_type,width,height,sample_rate,channels",
            "-of",
            "json",
            file,
          ],
          { encoding: "utf-8" }
        )
      );
      expect(Number(probe.format.duration), entry.id).toBeCloseTo(
        entry.duration,
        5
      );
      expect(entry.license).toBe("platform-licensed");
      expect(entry.creditCost).toBe(0);
      if (audio) {
        expect(findCatalogAudio(entry.id)).toBe(entry);
        expect(entry.waveform).toHaveLength(64);
        expect(Math.max(...entry.waveform)).toBe(1);
      } else {
        expect(probe.streams[0]).toMatchObject({
          codec_type: "video",
          width: entry.width,
          height: entry.height,
        });
        expect(
          readFileSync(`public/shared-assets/effects/${entry.poster}`).length
        ).toBeGreaterThan(1000);
      }
    }
    expect(
      JSON.stringify([...licensedAudioCatalog, ...editorEffectCatalog])
    ).not.toMatch(/four[\s_-]*editors|foureditors\.com/i);
    expect(
      licensedAudioCatalog.every(
        entry => !entry.source && !entry.author && !entry.originalFile
      )
    ).toBe(true);
  }, 30000);

  it("offers the same purchased audio to both Reel planning paths without paid audio", () => {
    const model = editorChatModelContext(context());
    const automatic = buildEditPlanningContext(project, []);
    for (const entry of licensedAudioCatalog) {
      expect(
        model.freeAudioCatalog.find(item => item.id === entry.id)
      ).toMatchObject({ duration: entry.duration, credits: 0 });
      expect(
        automatic.freeSounds.find(
          item => item.assetId === `catalog:${entry.id}`
        )
      ).toMatchObject({ duration: entry.duration });
    }
  });

  it("uses measured real audio bytes and rejects altered catalog delivery before uploading", async () => {
    const entry = licensedAudioCatalog[0];
    const bytes = new Uint8Array(
      readFileSync(`public/shared-assets/audio/${entry.file}`)
    );
    const upload = vi.fn(async () => ({ ...uploaded, kind: "audio" as const }));
    const saved = await resolveChatCatalogAudio(
      entry.id,
      [],
      upload,
      vi.fn(
        async () =>
          new Response(bytes, { headers: { "Content-Type": "audio/wav" } })
      )
    );
    expect(saved.duration).toBe(entry.duration);
    expect(saved.variantGroupId).toBe(`builtin-audio:${entry.id}`);
    upload.mockClear();
    await expect(
      resolveChatCatalogAudio(
        entry.id,
        [],
        upload,
        vi.fn(
          async () =>
            new Response(new Uint8Array([1, 2]), {
              headers: { "Content-Type": "audio/wav" },
            })
        )
      )
    ).rejects.toThrow("verified file");
    expect(upload).not.toHaveBeenCalled();
  });
});

describe("licensed visual effects", () => {
  it("lets Reel select only verified catalog IDs and keeps source bounds and zero media cost", () => {
    const ctx = context();
    const model = editorChatModelContext(ctx);
    expect(model.freeEffectCatalog).toHaveLength(editorEffectCatalog.length);
    const plan = normalizeEditorChatPlan(
      { actions: [{ ...action, credits: 999, insert: { start: 2 } }] },
      ctx
    );
    expect(plan.actions[0]).toMatchObject({
      kind: "catalog-effect",
      catalogId: effect.id,
      credits: 0,
      insert: { start: 2, duration: effect.duration },
    });
    expect(plan.totalCredits).toBe(5);
    expect(ctx.quoteAudio).not.toHaveBeenCalled();
    const invalid = normalizeEditorChatPlan(
      {
        actions: [
          { ...action, catalogId: "https://untrusted.example/fake.mp4" },
        ],
      },
      ctx
    );
    expect(invalid.actions).toEqual([]);
    expect(() =>
      catalogEffectPlacement(
        effect,
        { start: 2, duration: effect.duration + 1 },
        10
      )
    ).toThrow();
  });

  it("loads the real original, reuses saved media, and never uploads tampered or canceled data", async () => {
    const bytes = new Uint8Array(
      readFileSync(`public/shared-assets/effects/${effect.file}`)
    );
    const fetcher = vi.fn(async () => new Response(bytes));
    const upload = vi.fn(async () => uploaded);
    const asset = await resolveChatCatalogEffect(
      effect.id,
      [],
      upload,
      undefined,
      fetcher
    );
    expect(asset).toMatchObject({
      duration: effect.duration,
      variantGroupId: `builtin-effect:${effect.id}`,
    });
    const replay = await resolveChatCatalogEffect(
      effect.id,
      [asset],
      upload,
      undefined,
      fetcher
    );
    expect(replay.id).toBe(asset.id);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(1);
    await expect(
      resolveChatCatalogEffect(
        effect.id,
        [],
        upload,
        undefined,
        vi.fn(async () => new Response(new Uint8Array(effect.bytes)))
      )
    ).rejects.toThrow("match the catalog");
    const controller = new AbortController();
    controller.abort();
    await expect(
      resolveChatCatalogEffect(
        effect.id,
        [],
        upload,
        controller.signal,
        fetcher
      )
    ).rejects.toThrow();
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("preserves overlay blend and quiet source through manual, Reel, persistence and export paths", () => {
    const asset = {
      ...uploaded,
      duration: effect.duration,
      variantGroupId: `builtin-effect:${effect.id}`,
    };
    const manual = placeLibraryAsset(project, asset, "manual", 2);
    const changed = applyChatCatalogEffect(project, asset, action);
    for (const clip of [manual, changed.clips[0]]) {
      expect(clip).toMatchObject({
        track: "overlay",
        lane: 2,
        muted: true,
        primaryFootage: false,
        duration: effect.duration,
        visual: { blendMode: "screen" },
      });
      expect(
        visualCompositeFilters(clip, "base", "paint", "out").join(";")
      ).toContain("blend=all_mode=screen");
    }
    expect(applyChatCatalogEffect(changed, asset, action).clips).toHaveLength(
      1
    );
    const state = normalizeEditorChatState({
      messages: [
        {
          id: "reply",
          role: "assistant",
          text: "Plan",
          createdAt: "2026-11-11T10:00:00Z",
          plan: {
            requestId: "request-123456789",
            projectId: project.id,
            actions: [
              {
                ...action,
                status: "completed",
                runtime: { assetId: asset.id },
              } satisfies EditorChatAction,
            ],
          },
        },
      ],
    })!;
    expect(state.messages[0].plan!.actions[0]).toMatchObject({
      ...action,
      status: "completed",
    });
    expect(normalizeEditorChatState(JSON.parse(JSON.stringify(state)))).toEqual(
      state
    );
    expect(project.clips).toEqual([]);
  });
});
