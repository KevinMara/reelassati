import { describe, expect, it } from "vitest";
import {
  catalogColorLutCandidates,
  resolveCatalogColorLut,
} from "./catalog-color-lut";
import type { SharedMediaCatalogItem } from "./shared-media-catalog";

const sha256 = "a".repeat(64);
const look: SharedMediaCatalogItem = {
  id: `stock-${sha256.slice(0, 24)}`,
  name: "Soft cinema 001",
  group: "Soft cinema",
  designId: "design-soft-cinema",
  variant: "3D 16",
  kind: "lut",
  tags: ["cinema"],
  duration: 0,
  lut: { dimension: 3, size: 16, domainMin: [0, 0, 0], domainMax: [1, 1, 1] },
  media: {
    file: `media/${sha256}.cube`,
    sha256,
    bytes: 100,
    contentType: "application/x-cube",
  },
  license: "platform-licensed",
  credits: 0,
};

describe("verified catalog color look resolution", () => {
  it("resolves model selection to the same immutable identity used manually", () => {
    expect(
      resolveCatalogColorLut(
        { id: look.id, name: "An invented model title", amount: 0.45 },
        catalogColorLutCandidates([look])
      )
    ).toEqual({ id: look.id, name: look.name, sha256, amount: 0.45 });
  });
  it("keeps reset explicit and does not expose a media record as a look", () => {
    expect(resolveCatalogColorLut(null, [])).toBeNull();
    expect(catalogColorLutCandidates([{ ...look, kind: "video" }])).toEqual([]);
    expect(() =>
      resolveCatalogColorLut({ id: look.id, amount: 1 }, [])
    ).toThrow();
  });
  it("rejects forged hashes, external paths, missing strength and nonfinite/out-of-range strength", () => {
    for (const value of [
      { id: look.id, amount: 1, sha256: "b".repeat(64) },
      { id: look.id, amount: 1, url: "https://example.com/look.cube" },
      { id: look.id },
      { id: look.id, amount: -0.1 },
      { id: look.id, amount: 1.1 },
      { id: look.id, amount: NaN },
      { id: look.id, amount: "0.5" },
    ])
      expect(() =>
        resolveCatalogColorLut(value, catalogColorLutCandidates([look]))
      ).toThrow();
  });
});
