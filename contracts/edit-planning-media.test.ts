import { describe, expect, it } from "vitest";
import { editPlanningMedia } from "./edit-planning-media";
import type { Asset, EditProject } from "./workspace";

describe("edit planning Library context", () => {
  it("uses the newest factual review and excludes unavailable files and private URLs", () => {
    const assets = [
      {
        id: "demo",
        name: "Product.mp4",
        kind: "video",
        status: "ready",
        duration: 9,
        url: "https://private.example/token",
        provenance: { token: "private" },
      },
      { id: "image", name: "Still.png", kind: "image", status: "ready" },
      { id: "failed", kind: "video", status: "failed" },
      { id: "script", kind: "script", status: "ready" },
    ] as Asset[];
    const projects = [
      {
        sourceReviews: [
          {
            assetId: "demo",
            reviewedAt: "2026-11-01",
            summary: "Old recommendation",
            moments: [{ note: "Invent a product claim" }],
          },
        ],
      },
      {
        sourceReviews: [
          {
            assetId: "demo",
            reviewedAt: "2026-11-07",
            summary: "Private unrelated instructions",
            observations: [
              {
                start: 0,
                end: 3,
                visualEvidence: "A bottle rotates on a table",
              },
            ],
          },
        ],
      },
    ] as Pick<EditProject, "sourceReviews">[];
    const result = editPlanningMedia(assets, projects);
    expect(result.map(row => row.assetId)).toEqual(["demo", "image"]);
    expect(result[0].evidence?.observations?.[0].visualEvidence).toBe(
      "A bottle rotates on a table"
    );
    expect(result[1]).not.toHaveProperty("evidence");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("private.example");
    expect(serialized).not.toContain("Private unrelated");
    expect(serialized).not.toContain("Invent a product claim");
    expect(serialized).not.toContain("provenance");
  });
});
