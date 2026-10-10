import { describe, expect, it } from "vitest";
import type { Asset, WorkspaceDocument } from "@contracts/workspace";
import { assertStillImageContext, derivedStillAsset } from "./derived-still-asset";

const original: Asset = { id: "source", name: "portrait.png", kind: "image", contentType: "image/png", size: 10, url: "/owned/source", status: "ready", createdAt: "2026-10-01" };
const workspace = (asset = original, projectId = "project") => ({ assets: [asset], projects: [{ id: projectId }] }) as unknown as WorkspaceDocument;
describe("still-image derivative ownership", () => {
  it("keeps the uploaded derivative's authoritative provenance instead of copying original evidence", () => {
    const source = { ...original, provenance: { origin: "generated", signature: "source-signature" } } as unknown as Asset;
    const uploaded = { ...original, id: "derived", url: "/owned/derived", provenance: { origin: "uploaded", signature: "new-bytes-signature" } } as unknown as Asset;
    const result = derivedStillAsset(uploaded, source, "project", 640, 480);
    expect(result).toMatchObject({ id: "derived", url: "/owned/derived", parentAssetId: "source", projectId: "project", width: 640, height: 480 });
    expect(result.provenance).toBe(uploaded.provenance);
    expect(result.provenance).not.toBe(source.provenance);
    expect(source).not.toHaveProperty("parentAssetId");
  });
  it("allows a current source but rejects a removed project, replaced source or processing image", () => {
    expect(() => assertStillImageContext(workspace(), "project", original)).not.toThrow();
    expect(() => assertStillImageContext(workspace(original, "different"), "project", original)).toThrow("changed");
    for (const patch of [{ url: "/new" }, { size: 11 }, { createdAt: "2026-10-02" }, { status: "processing" as const }]) {
      expect(() => assertStillImageContext(workspace({ ...original, ...patch }), "project", original)).toThrow("changed");
    }
  });
});
