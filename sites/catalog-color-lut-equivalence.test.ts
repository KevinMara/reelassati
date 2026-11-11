import { describe, expect, it } from "vitest";
import type { Asset, EditOperation, EditProject } from "../contracts/workspace";
import type { SharedMediaCatalogItem } from "../contracts/shared-media-catalog";
import { normalizeClipColorLut } from "../contracts/color-lut";
import {
  buildEditPlanningContext,
  resolveEditPlanningReferences,
  assertExecutableEditPlan,
} from "../contracts/edit-planning-context";
import { applyEditOperation } from "../contracts/edit-timeline";
import { replaceTimelineClip } from "../src/lib/editor-manual";
import {
  editorChatModelContext,
  normalizeEditorChatPlan,
  parseEditorChatRequest,
  type EditorChatContext,
} from "./editor-chat";

const sha256 = "c".repeat(64);
const item: SharedMediaCatalogItem = {
  id: `stock-${sha256.slice(0, 24)}`,
  name: "Soft film",
  group: "Color looks",
  designId: "design-soft-film",
  variant: "3D CUBE",
  kind: "lut",
  tags: ["film", "soft"],
  duration: 0,
  lut: { dimension: 3, size: 2, domainMin: [0, 0, 0], domainMax: [1, 1, 1] },
  media: {
    file: `media/${sha256}.cube`,
    sha256,
    bytes: 100,
    contentType: "application/x-cube",
  },
  license: "platform-licensed",
  credits: 0,
};
const asset: Asset = {
  id: "source",
  name: "Source.mp4",
  kind: "video",
  contentType: "video/mp4",
  size: 100,
  duration: 10,
  url: "/api/assets/source",
  status: "ready",
  createdAt: "2026-11-11",
};
const project: EditProject = {
  id: "project",
  title: "Source",
  template: "blank",
  status: "editing",
  platform: "instagram",
  aspectRatio: "9:16",
  duration: 10,
  playhead: 0,
  createdAt: "2026-11-11",
  updatedAt: "2026-11-11",
  clips: [
    {
      id: "clip",
      assetId: "source",
      label: "Source",
      track: "video",
      start: 0,
      duration: 10,
      inPoint: 0,
      outPoint: 10,
      color: "#888888",
      brightness: 0.1,
      contrast: 1.1,
      locked: false,
    },
  ],
  transcript: [],
  proposedChanges: [],
  qualitySignals: [],
  revisions: [],
};
const operation = (colorLut: unknown) => ({
  id: "look",
  type: "style",
  label: "Apply selected color look",
  reason: "Requested treatment",
  start: 0,
  end: 10,
  confidence: 1,
  intensity: "balanced",
  targetClipIds: ["clip"],
  parameters: { colorLut },
});
const context = (current = project): EditorChatContext => ({
  request: parseEditorChatRequest({
    requestId: "request-color-look",
    projectId: "project",
    prompt: "Apply Soft film at the requested intensity",
    mode: "ask",
    maxCredits: 100,
  }),
  project: current,
  assets: [asset],
  sharedCatalog: [item],
  // This callback is deliberately only the boundary between real contracts.
  // The real server mapper is independently exercised in editor-chat.integration.test.ts.
  normalizeOperations: raw => raw as EditOperation[],
  quoteAudio: () => 15,
  capability: () => true,
  makeId: () => "action-look",
});
const reelPlan = (raw: unknown, current = project) =>
  normalizeEditorChatPlan(
    {
      message: "Apply the selected look",
      actions: [
        {
          id: "look-action",
          kind: "edit",
          label: "Apply selected color look",
          reason: "Requested treatment",
          scope: "requested",
          requestExcerpt: "Apply Soft film",
          dependsOn: [],
          operation: raw,
        },
      ],
    },
    context(current)
  );
const autoOperation = (raw: unknown, current = project) => {
  const resolved = resolveEditPlanningReferences(
    [raw],
    buildEditPlanningContext(current, [asset], [], [item]),
    current.duration
  ) as EditOperation[];
  assertExecutableEditPlan(resolved);
  return resolved[0];
};

describe("manual, Reel and auto-edit catalog color look equivalence", () => {
  it.each([0, 0.35, 1])(
    "uses the same immutable look and intensity after application and save: %s",
    amount => {
      const expected = { id: item.id, name: item.name, sha256, amount };
      const manual = replaceTimelineClip(
        project,
        "clip",
        { ...project.clips[0], colorLut: expected },
        [asset]
      );
      const plan = reelPlan(
        operation({
          id: item.id,
          amount,
          name: "Model-supplied title is not authoritative",
        })
      );
      expect(plan.blockedReasons).toEqual([]);
      expect(plan.actions).toHaveLength(1);
      const action = plan.actions[0];
      if (action.kind !== "edit")
        throw new Error("Expected an executable style action");
      const reel = applyEditOperation(project, action.operation);
      const automatic = applyEditOperation(
        project,
        autoOperation(operation({ id: item.id, amount }))
      );
      for (const edited of [manual, reel, automatic]) {
        const reopened = JSON.parse(JSON.stringify(edited)) as EditProject;
        expect(normalizeClipColorLut(reopened.clips[0].colorLut)).toEqual(
          expected
        );
        expect(reopened.clips[0]).toMatchObject({
          assetId: "source",
          start: 0,
          duration: 10,
          inPoint: 0,
          outPoint: 10,
          brightness: 0.1,
          contrast: 1.1,
        });
      }
      expect(project.clips[0].colorLut).toBeUndefined();
    }
  );
  it("removes only an explicitly null look and retains it for an unrelated numeric grade", () => {
    const original = {
      ...project,
      clips: [
        {
          ...project.clips[0],
          colorLut: { id: item.id, name: item.name, sha256, amount: 0.4 },
        },
      ],
    };
    const removal = reelPlan(operation(null), original).actions[0];
    if (removal.kind !== "edit") throw new Error("Expected look removal");
    const manuallyRemoved = replaceTimelineClip(
      original,
      "clip",
      { ...original.clips[0], colorLut: null },
      [asset]
    );
    expect(manuallyRemoved.clips[0].colorLut).toBeNull();
    expect(
      applyEditOperation(original, removal.operation).clips[0].colorLut
    ).toBe(manuallyRemoved.clips[0].colorLut);
    expect(
      applyEditOperation(original, autoOperation(operation(null), original))
        .clips[0].colorLut
    ).toBeNull();
    const grade = { ...operation(undefined), parameters: { contrast: 1.2 } };
    const edit = reelPlan(grade, original).actions[0];
    if (edit.kind !== "edit") throw new Error("Expected numeric grade");
    expect(
      applyEditOperation(original, edit.operation).clips[0].colorLut
    ).toEqual(original.clips[0].colorLut);
    expect(
      applyEditOperation(original, autoOperation(grade, original)).clips[0]
        .colorLut
    ).toEqual(original.clips[0].colorLut);
  });
  it.each([
    { id: "stock-unknown", amount: 0.5 },
    { id: item.id, amount: 0.5, sha256: "d".repeat(64) },
    { id: item.id, amount: 0.5, url: "https://example.com/look.cube" },
    { id: item.id, amount: -0.1 },
    { id: item.id, amount: 1.1 },
  ])(
    "rejects unavailable identities, fabricated bytes and invalid intensities in both planners: %j",
    value => {
      const plan = reelPlan(operation(value));
      expect(plan.actions).toHaveLength(0);
      expect(plan.blockedReasons).not.toEqual([]);
      expect(() => autoOperation(operation(value))).toThrow();
    }
  );
  it("supplies the same canonical catalog metadata to both planning contexts", () => {
    const automatic = buildEditPlanningContext(project, [asset], [], [item]);
    const reel = editorChatModelContext(context());
    expect(automatic.catalogColorLooks).toEqual([
      {
        id: item.id,
        name: item.name,
        sha256,
        group: item.group,
        tags: item.tags,
      },
    ]);
    expect(reel.catalogColorLooks).toEqual(automatic.catalogColorLooks);
  });
  it("rejects a color look targeting only audio without changing the source", () => {
    const audio = {
      ...project,
      clips: [{ ...project.clips[0], track: "audio" as const }],
    };
    const plan = reelPlan(operation({ id: item.id, amount: 0.5 }), audio);
    expect(plan.actions).toHaveLength(0);
    expect(plan.blockedReasons).not.toEqual([]);
    expect(() =>
      applyEditOperation(
        audio,
        autoOperation(operation({ id: item.id, amount: 0.5 }), audio)
      )
    ).toThrow();
    expect(audio.clips[0].colorLut).toBeUndefined();
  });
});
