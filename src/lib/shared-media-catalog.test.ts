import { describe, expect, it, vi } from "vitest";
import { normalizeEditorChatState } from "@contracts/editor-chat-state";
import {
  buildEditPlanningContext,
  resolveEditPlanningReferences,
} from "@contracts/edit-planning-context";
import { applyEditOperation } from "@contracts/edit-timeline";
import {
  sharedCatalogPlanningAssets,
  normalizeSharedCatalogItem,
  type SharedMediaCatalogItem,
} from "@contracts/shared-media-catalog";
import type { Asset, EditProject, EditOperation } from "@contracts/workspace";
import {
  editorChatModelContext,
  normalizeEditorChatPlan,
  parseEditorChatRequest,
  type EditorChatContext,
} from "../../sites/editor-chat";
import {
  applySharedCatalogAction,
  resolveSharedCatalogAsset,
} from "./shared-media-catalog";

const api = vi.hoisted(() => ({
  import: vi.fn(),
  scope: vi.fn(async () => ({ ownerEmail: "test@example.com" })),
  verify: vi.fn(async () => undefined),
}));
vi.mock("./platform-api", () => ({
  platformApi: { importSharedCatalog: api.import },
  captureUploadRequestScope: api.scope,
  verifyUploadRequestScope: api.verify,
}));
const hash = "a".repeat(64),
  posterHash = "b".repeat(64);
const item: SharedMediaCatalogItem = {
  id: `stock-${hash.slice(0, 24)}`,
  name: "Film frame 01",
  group: "Film frames",
  designId: "film-frame-01",
  variant: "1920 × 1080",
  kind: "video",
  tags: ["film", "frame"],
  duration: 2,
  width: 1920,
  height: 1080,
  blendMode: "screen",
  media: {
    file: `media/${hash}.mp4`,
    sha256: hash,
    bytes: 100,
    contentType: "video/mp4",
  },
  poster: {
    file: `media/${posterHash}.png`,
    sha256: posterHash,
    bytes: 10,
    contentType: "image/png",
  },
  credits: 0,
  license: "platform-licensed",
};
const project: EditProject = {
  id: "project",
  title: "Edit",
  template: "blank",
  platform: "instagram",
  aspectRatio: "9:16",
  status: "editing",
  duration: 10,
  playhead: 0,
  clips: [],
  transcript: [],
  proposedChanges: [],
  qualitySignals: [],
  revisions: [],
  createdAt: "2026-11-11",
  updatedAt: "2026-11-11",
};
const asset: Asset = {
  ...sharedCatalogPlanningAssets([item])[0],
  id: "imported",
  url: "/api/assets/imported",
};
const context = (): EditorChatContext => ({
  request: parseEditorChatRequest({
    requestId: "shared-catalog-request-001",
    projectId: project.id,
    prompt: "Add a film frame at 2 seconds",
    mode: "ask",
    maxCredits: 5,
  }),
  project,
  assets: [],
  sharedCatalog: [item],
  normalizeOperations: () => [],
  quoteAudio: vi.fn(),
  capability: () => false,
  makeId: () => "shared-action",
});
const draft = {
  kind: "shared-media",
  catalogId: item.id,
  label: "Add a film frame",
  reason: "Requested",
  scope: "requested",
  requestExcerpt: "Add a film frame",
  insert: { start: 2 },
};

describe("shared stock planning and execution", () => {
  it("offers only actual server candidates and persists their validated zero-credit proposal", () => {
    const ctx = context();
    expect(editorChatModelContext(ctx).sharedMediaCatalog[0]).toMatchObject({
      id: item.id,
      duration: 2,
      blendMode: "screen",
      credits: 0,
    });
    const plan = normalizeEditorChatPlan(
      { actions: [{ ...draft, credits: 100 }] },
      ctx
    );
    expect(plan.actions[0]).toMatchObject({
      kind: "shared-media",
      catalogId: item.id,
      catalog: item,
      insert: { start: 2, duration: 2 },
      credits: 0,
    });
    expect(plan.totalCredits).toBe(5);
    expect(
      normalizeEditorChatPlan(
        { actions: [{ ...draft, catalogId: "stock-" + "f".repeat(24) }] },
        ctx
      ).actions
    ).toEqual([]);
    const saved = normalizeEditorChatState({
      messages: [
        {
          id: "message",
          role: "assistant",
          text: "Ready",
          createdAt: "2026-11-11T10:00:00Z",
          plan,
        },
      ],
    })!;
    expect(saved.messages[0].plan!.actions[0]).toMatchObject({
      catalog: item,
      credits: 0,
    });
    expect(normalizeEditorChatState(JSON.parse(JSON.stringify(saved)))).toEqual(
      saved
    );
  });
  it("resolves and reuses the same owned catalog asset and rejects cancellation after an import", async () => {
    api.import.mockResolvedValue(asset);
    const controller = new AbortController();
    expect(
      await resolveSharedCatalogAsset(item.id, [], controller.signal)
    ).toMatchObject({ id: asset.id, catalog: item });
    expect(
      await resolveSharedCatalogAsset(item.id, [asset], controller.signal)
    ).toBe(asset);
    expect(api.import).toHaveBeenCalledTimes(1);
    api.import.mockImplementationOnce(async () => {
      controller.abort();
      return asset;
    });
    await expect(
      resolveSharedCatalogAsset(item.id, [], controller.signal)
    ).rejects.toThrow();
  });
  it("preserves real duration and blend in manual Reel actions and automatic broll execution", () => {
    const action = normalizeEditorChatPlan({ actions: [draft] }, context())
      .actions[0];
    if (action.kind !== "shared-media")
      throw new Error("Missing shared action");
    const changed = applySharedCatalogAction(project, asset, action);
    expect(changed.clips[0]).toMatchObject({
      assetId: asset.id,
      track: "overlay",
      lane: 2,
      duration: 2,
      muted: true,
      visual: { blendMode: "screen" },
    });
    expect(applySharedCatalogAction(changed, asset, action).clips).toHaveLength(
      1
    );
    const planning = buildEditPlanningContext(project, [], [], [item]);
    expect(planning.sharedCatalog[0].assetId).toBe(`shared:${item.id}`);
    const resolved = resolveEditPlanningReferences(
      [
        {
          id: "insert",
          type: "broll",
          label: "Frame",
          reason: "Requested",
          start: 2,
          end: 4,
          confidence: 1,
          intensity: "light",
          targetClipIds: [],
          status: "pending",
          parameters: { assetId: `shared:${item.id}` },
        },
      ],
      planning,
      10,
      []
    );
    const automatic = applyEditOperation(
      project,
      resolved[0] as unknown as EditOperation
    );
    expect(automatic.clips[0]).toMatchObject({
      fit: "contain",
      visual: { blendMode: "screen" },
      muted: true,
    });
  });
  it("rejects unsupported and falsely typed LUT declarations before they enter the public library", () => {
    const lut = {
      ...item,
      kind: "lut",
      duration: 0,
      media: {
        ...item.media,
        file: `media/${hash}.cube`,
        contentType: "application/x-cube",
      },
      width: undefined,
      height: undefined,
      blendMode: undefined,
      poster: undefined,
      lut: {
        dimension: 3,
        size: 33,
        domainMin: [0, 0, 0],
        domainMax: [1, 1, 1],
      },
    };
    expect(normalizeSharedCatalogItem(lut).lut!.size).toBe(33);
    for (const value of [
      { dimension: "3", size: 33 },
      { dimension: 1, size: 33 },
      { dimension: 3, size: 128 },
    ])
      expect(() =>
        normalizeSharedCatalogItem({ ...lut, lut: { ...lut.lut, ...value } })
      ).toThrow();
  });
  it("carries a reviewed sound excerpt and mix through planning, reload and reversible execution", () => {
    const sound = normalizeSharedCatalogItem({
      ...item,
      kind: "audio",
      waveform: Array(64).fill(0.2),
      width: undefined,
      height: undefined,
      blendMode: undefined,
      poster: undefined,
      media: {
        ...item.media,
        file: `media/${hash}.wav`,
        contentType: "audio/wav",
      },
    });
    const ctx = {
      ...context(),
      sharedCatalog: [sound],
      sharedSoundObservations: {
        [sound.id]: {
          schemaVersion: 1 as const,
          mediaSha256: sound.media.sha256,
          sampleSha256: "b".repeat(64),
          character: "A short soft impact",
          role: "effect" as const,
          audibleEvents: ["soft impact"],
          suitableUses: ["brief emphasis"],
          avoidUses: ["continuous music"],
          containsSpeech: false,
          intensity: "subtle" as const,
          confidence: 0.9,
          coverage: "sampled-audio" as const,
          sourceRanges: [{ start: 0.5, end: 1.2 }],
        },
      },
    };
    const insert = {
      start: 2,
      duration: 0.4,
      sourceIn: 0.7,
      volume: 0.12,
      fadeIn: 0.01,
      fadeOut: 0.08,
    };
    const plan = normalizeEditorChatPlan(
      { actions: [{ ...draft, insert }] },
      ctx
    );
    const state = normalizeEditorChatState({
      messages: [
        {
          id: "sound-reply",
          role: "assistant",
          text: "Ready",
          createdAt: "2026-11-16T00:00:00Z",
          plan,
        },
      ],
    })!;
    const restored = normalizeEditorChatState(
      JSON.parse(JSON.stringify(state))
    )!.messages[0].plan!.actions[0];
    if (restored.kind !== "shared-media")
      throw new Error("Missing sound insertion");
    expect(restored.insert).toEqual(insert);
    const owned = {
      ...sharedCatalogPlanningAssets([sound])[0],
      id: "sound",
      url: "/api/assets/sound",
    };
    const edited = applySharedCatalogAction(project, owned, restored);
    expect(edited.clips[0]).toMatchObject({
      track: "audio",
      start: 2,
      duration: 0.4,
      inPoint: 0.7,
      outPoint: 1.1,
      volume: 0.12,
      fadeIn: 0.01,
      fadeOut: 0.08,
    });
    expect(edited.revisions.at(-1)!.clips[0]).toEqual(edited.clips[0]);
    expect(applySharedCatalogAction(edited, owned, restored)).toBe(edited);
    for (const patch of [
      { sourceIn: 1.8 },
      { sourceIn: 0 },
      { sourceIn: 1.1 },
      { sourceIn: -0.1 },
      { sourceIn: NaN },
      { volume: 3 },
      { volume: -1 },
      { fadeOut: 0.5 },
      { fadeIn: Infinity },
    ]) {
      expect(
        normalizeEditorChatPlan(
          { actions: [{ ...draft, insert: { ...insert, ...patch } }] },
          ctx
        ).actions
      ).toEqual([]);
    }
    expect(
      normalizeEditorChatPlan({ actions: [{ ...draft, insert }] }, context())
        .actions
    ).toEqual([]);
  });
});
