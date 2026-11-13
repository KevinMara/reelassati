import { describe, expect, it } from "vitest";
import {
  inspectSupportingMediaFrame,
  type DecodedProtectionLayer,
  type ProtectedMediaRegion,
} from "./supporting-media-protection";

const canvas = { width: 20, height: 20 };
const region: ProtectedMediaRegion = {
  sourceClipId: "source",
  regionId: "caption",
  kind: "text",
  sourceOrder: 0,
  rect: { x: 5, y: 5, width: 10, height: 10 },
};
function layer(
  id: string,
  color: number[],
  mode: DecodedProtectionLayer["blendMode"] = "normal",
  selected = true
): DecodedProtectionLayer {
  return {
    clipId: id,
    operationId: selected ? id : undefined,
    order: 1,
    blendMode: mode,
    rgba: Uint8Array.from({ length: 20 * 20 * 4 }, (_, i) => color[i % 4]),
  };
}
const inspect = (...layers: DecodedProtectionLayer[]) =>
  inspectSupportingMediaFrame(canvas, 1, [region], layers);
describe("rendered supporting-media protection", () => {
  it("rejects an opaque insertion without treating transparent holes as occupied", () => {
    const opaque = layer("opaque", [255, 255, 255, 255]);
    expect(inspect(opaque)).toMatchObject([
      { operationId: "opaque", reason: "source-obscured", affectedFraction: 1 },
    ]);
    for (let y = 5; y < 15; y++)
      for (let x = 5; x < 15; x++) opaque.rgba[(y * 20 + x) * 4 + 3] = 0;
    expect(inspect(opaque)).toEqual([]);
  });
  it.each([
    ["screen", 0],
    ["multiply", 255],
    ["overlay", 128],
  ] as const)(
    "retains neutral %s pixels at full authored alpha",
    (mode, value) => {
      expect(
        inspect(layer("neutral", [value, value, value, 255], mode))
      ).toEqual([]);
    }
  );
  it.each([
    ["screen", 255],
    ["multiply", 0],
  ] as const)("catches destructive %s pixels", (mode, value) => {
    expect(
      inspect(layer("destructive", [value, value, value, 255], mode))
    ).toHaveLength(1);
  });
  it("allows subtle textures but checks their cumulative contrast loss", () => {
    const one = layer("one", [200, 200, 200, 77]),
      two = layer("two", [200, 200, 200, 77]);
    expect(inspect(one)).toEqual([]);
    expect(inspect(two)).toEqual([]);
    expect(inspect(one, two).map(f => f.operationId)).toEqual(["one", "two"]);
    expect(one.rgba[3]).toBe(77);
  });
  it("includes existing layers but never removes them or blames a neutral new layer", () => {
    expect(
      inspect(
        layer("existing", [0, 0, 0, 77], "normal", false),
        layer("new", [0, 0, 0, 77])
      ).map(f => f.operationId)
    ).toEqual(["new"]);
    expect(
      inspect(
        layer("existing", [0, 0, 0, 255], "normal", false),
        layer("neutral", [0, 0, 0, 255], "screen")
      )
    ).toEqual([]);
  });
  it("checks individual delivery pixels and ignores layers below the source", () => {
    const thin = layer("thin", [0, 0, 0, 0]);
    for (let y = 5; y < 15; y++) thin.rgba[(y * 20 + 5) * 4 + 3] = 255;
    expect(inspect(thin)).toHaveLength(1);
    expect(inspect({ ...thin, order: -1 })).toEqual([]);
    expect(() => inspect({ ...thin, rgba: thin.rgba.slice(4) })).toThrow();
  });
});
