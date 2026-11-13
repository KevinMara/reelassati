import { describe, expect, it, vi } from "vitest";
import type { Asset, EditOperation, EditProject } from "@contracts/workspace";
import { editorEffectCatalog } from "@contracts/editor-effect-catalog";
import {
  catalogOverlayDraftBinding,
  type CatalogOverlayPreflightOptions,
} from "./catalog-overlay-preflight";
import { preflightAutonomousCatalogMedia } from "./autonomous-catalog-preflight";

const project = {
  id: "p",
  duration: 5,
  aspectRatio: "9:16",
  frameRate: 30,
  transcript: [],
  proposedChanges: [],
  clips: [
    {
      id: "source",
      assetId: "source",
      track: "video",
      lane: 1,
      start: 0,
      duration: 5,
      inPoint: 0,
      outPoint: 5,
      locked: false,
    },
  ],
} as unknown as EditProject;
const assets = [
  { id: "source", kind: "video", status: "ready", duration: 5 },
  ...["clear", "opaque"].map(id => ({
    id,
    kind: "image",
    status: "ready",
    catalog: { media: { sha256: id } },
  })),
] as Asset[];
const op = (id: string): EditOperation => ({
  id,
  type: "broll",
  start: 1,
  end: 3,
  label: id,
  reason: "Explain this beat",
  targetClipIds: ["source"],
  confidence: 1,
  intensity: "balanced",
  status: "proposed",
  parameters: { assetId: id },
});
const response = (
  request: CatalogOverlayPreflightOptions,
  blocked: string[] = []
) => ({
  checkedOperationIds: Object.keys(request.operationClipIds).filter(
    id => !blocked.includes(id)
  ),
  blockedOperationIds: blocked,
  unverifiedOperationIds: [],
  findings: [],
  canvas: { width: 720, height: 1280, frameRate: 30 },
  draftBinding: catalogOverlayDraftBinding(request),
});
const options = (changes: EditOperation[]) => ({
  project: structuredClone(project),
  assets,
  changes,
  signal: new AbortController().signal,
  checkpoint: () => undefined,
});

describe("automatic catalog insertion acceptance", () => {
  it("also inspects built-in fixed effects already saved in Library", async () => {
    const entry = editorEffectCatalog[0];
    const effect = {
      id: "builtin",
      kind: "video",
      status: "ready",
      duration: entry.duration,
      variantGroupId: `builtin-effect:${entry.id}`,
    } as Asset;
    const change = {
      ...op("builtin"),
      start: 1,
      end: 1 + Math.min(1, entry.duration),
    };
    const inspect = vi.fn(async (request: CatalogOverlayPreflightOptions) =>
      response(request, ["builtin"])
    );
    const result = await preflightAutonomousCatalogMedia({
      ...options([change]),
      assets: [...assets, effect],
      inspect,
    });
    expect(inspect).toHaveBeenCalledOnce();
    expect(result.changes).toEqual([]);
    expect(result.omitted[0].operationId).toBe("builtin");
  });
  it("checks the actual composed clips and preserves a verified overlay unchanged", async () => {
    const changes = [op("clear")];
    const inspect = vi.fn(async (request: CatalogOverlayPreflightOptions) => {
      expect(request.operationClipIds).toEqual({ clear: ["clear"] });
      expect(
        request.project.clips.find(clip => clip.id === "clear")
      ).toMatchObject({ start: 1, duration: 2, assetId: "clear" });
      return response(request);
    });
    const result = await preflightAutonomousCatalogMedia({
      ...options(changes),
      inspect,
    });
    expect(result).toEqual({ changes, omitted: [] });
    expect(inspect).toHaveBeenCalledTimes(1);
  });

  it("rechecks the surviving composition after an obstruction and keeps the signed plan immutable", async () => {
    const changes = [op("opaque"), op("clear")],
      original = structuredClone(changes);
    const inspect = vi.fn(async (request: CatalogOverlayPreflightOptions) =>
      response(request, request.operationClipIds.opaque ? ["opaque"] : [])
    );
    const result = await preflightAutonomousCatalogMedia({
      ...options(changes),
      inspect,
    });
    expect(result.changes.map(operation => operation.id)).toEqual(["clear"]);
    expect(result.omitted[0]).toMatchObject({
      operationId: "opaque",
      issues: [{ reason: "source-overlap" }],
    });
    expect(inspect).toHaveBeenCalledTimes(2);
    expect(
      inspect.mock.calls[1][0].project.clips.some(clip => clip.id === "opaque")
    ).toBe(false);
    expect(changes).toEqual(original);
  });

  it.each(["wrong-binding", "missing-receipt"])(
    "withholds an unverified insertion: %s",
    async mode => {
      const result = await preflightAutonomousCatalogMedia({
        ...options([op("clear")]),
        inspect: async request => ({
          ...response(request),
          ...(mode === "wrong-binding"
            ? { draftBinding: "different-draft" }
            : { checkedOperationIds: [] }),
        }),
      });
      expect(result.changes).toEqual([]);
      expect(result.omitted[0].issues[0].reason).toBe("unknown-source-layout");
    }
  );

  it("stops after the awaited check when the project changes", async () => {
    let changed = false;
    await expect(
      preflightAutonomousCatalogMedia({
        ...options([op("clear")]),
        checkpoint: () => {
          if (changed) throw new Error("Project changed");
        },
        inspect: async request => {
          changed = true;
          return response(request);
        },
      })
    ).rejects.toThrow("Project changed");
  });

  it("does not inspect unrelated edits or claim their pixels were verified", async () => {
    const inspect = vi.fn();
    expect(
      await preflightAutonomousCatalogMedia({ ...options([]), inspect })
    ).toEqual({ changes: [], omitted: [] });
    expect(inspect).not.toHaveBeenCalled();
  });
});
