import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { catalogVisualEvidence } from "./catalog-visual-evidence";
import type { CatalogEnvironment } from "./shared-media-catalog";
import type { SharedMediaCatalogItem } from "../contracts/shared-media-catalog";

const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const hash = createHash("sha256").update(png).digest("hex");
const item = {
  id: "stock-" + hash.slice(0, 24),
  kind: "video",
  name: "Untrusted name",
  width: 1080,
  height: 1920,
  poster: {
    file: `media/${hash}.png`,
    sha256: hash,
    bytes: png.length,
    contentType: "image/png",
  },
} as SharedMediaCatalogItem;
const environment = (data?: Uint8Array) =>
  ({
    BUCKET: {
      get: async () =>
        data ? { size: data.length, body: new Response(data).body } : null,
    },
  }) as unknown as CatalogEnvironment;
describe("actual catalog visual evidence", () => {
  it("sends verified bytes as image content linked to the exact asset and limits claims about motion", async () => {
    const result = await catalogVisualEvidence(
      environment(png),
      [item],
      new AbortController().signal
    );
    expect(result.items).toEqual([item]);
    expect(result.parts).toEqual([
      { type: "text", text: expect.stringContaining(`shared:${item.id}`) },
      {
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${Buffer.from(png).toString("base64")}`,
        },
      },
    ]);
    expect((result.parts[0] as { text: string }).text).toContain(
      "not full motion evidence"
    );
  });
  it.each([
    undefined,
    Uint8Array.from([0, 80, 78, 71, 13, 10, 26, 10]),
    Uint8Array.from([1]),
  ])(
    "does not permit filename-only visual selection when preview bytes are absent or corrupt",
    async bytes => {
      const audio = {
        ...item,
        id: "sound",
        kind: "audio",
      } as SharedMediaCatalogItem;
      const result = await catalogVisualEvidence(
        environment(bytes),
        [item, audio],
        new AbortController().signal
      );
      expect(result.items).toEqual([audio]);
      expect(result.parts).toEqual([]);
    }
  );
  it("honors cancellation before reading catalog objects", async () => {
    const signal = AbortSignal.abort();
    await expect(
      catalogVisualEvidence(environment(png), [item], signal)
    ).rejects.toThrow();
  });
});
