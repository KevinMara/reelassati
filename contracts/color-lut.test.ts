import { describe, expect, it } from "vitest";
import {
  applyCubeLutPixels,
  normalizeClipColorLut,
  parseCubeLut,
  sampleCubeLut,
  serializeCubeLut,
} from "./color-lut";
import { cubeFixture } from "./test-fixtures/color-lut";

describe("actual CUBE color tables", () => {
  it("reads red-fastest sample order and interpolates all three input channels", () => {
    const lut = parseCubeLut(cubeFixture());
    expect(lut.size).toBe(3);
    expect(sampleCubeLut(lut, [1, 0.5, 0])).toEqual(
      expect.arrayContaining([
        expect.closeTo(0.1),
        expect.closeTo(0.5),
        expect.closeTo(0.8),
      ])
    );
    expect(sampleCubeLut(lut, [0.25, 0.25, 0.25])[1]).toBeCloseTo(0.0625);
    expect(sampleCubeLut(lut, [0.25, 0.25, 0.25], 0)).toEqual([
      0.25, 0.25, 0.25,
    ]);
    expect(sampleCubeLut(lut, [0.25, 0.25, 0.25], 0.5)[1]).toBeCloseTo(
      (0.25 + 0.0625) / 2
    );
  });
  it("honors per-channel input domains and clamps out-of-domain inputs", () => {
    const lut = parseCubeLut(
      cubeFixture().replace(
        "LUT_3D_SIZE 3",
        "LUT_3D_SIZE 3\nDOMAIN_MIN -1 0 0\nDOMAIN_MAX 1 2 1"
      )
    );
    expect(sampleCubeLut(lut, [0, 1, 1])[1]).toBeCloseTo(0.25);
    expect(sampleCubeLut(lut, [-2, 4, 2])[0]).toBeCloseTo(0.9);
    const normalized = parseCubeLut(serializeCubeLut(lut));
    expect(normalized.domainMin).toEqual([0, 0, 0]);
    expect(normalized.data).toEqual(lut.data);
  });
  it("applies the exact lookup at adjustable strength and preserves alpha", () => {
    const lut = parseCubeLut(cubeFixture());
    const pixels = new Uint8ClampedArray([32, 81, 145, 7, 255, 0, 128, 129]);
    const original = pixels.slice();
    applyCubeLutPixels(lut, pixels, 0.43);
    for (let i = 0; i < pixels.length; i += 4) {
      const reference = sampleCubeLut(
        lut,
        [original[i] / 255, original[i + 1] / 255, original[i + 2] / 255],
        0.43
      );
      expect(Array.from(pixels.slice(i, i + 3))).toEqual(
        reference.map(value => Math.round(value * 255))
      );
      expect(pixels[i + 3]).toBe(original[i + 3]);
    }
  });
  it.each([
    "",
    "LUT_1D_SIZE 2\n0 0 0\n1 1 1",
    "LUT_3D_SIZE 65",
    "LUT_3D_SIZE 1",
    "LUT_3D_SIZE NaN",
    cubeFixture().replace("LUT_3D_SIZE 3", "LUT_3D_SIZE 3\nLUT_3D_SIZE 3"),
    cubeFixture().replace("LUT_3D_SIZE 3", "LUT_3D_SIZE 3\nDOMAIN_MAX 0 1 1"),
    cubeFixture().replace("0.1 0 0", "NaN 0 0"),
    cubeFixture() + "\n1 1 1",
    cubeFixture().split("\n").slice(0, -1).join("\n"),
  ])(
    "rejects malformed/unsupported CUBE data without substituting a preset",
    value => expect(() => parseCubeLut(value)).toThrow()
  );
  it("only persists content-addressed catalog look identities", () => {
    const sha256 = "a".repeat(64);
    expect(
      normalizeClipColorLut({
        id: `stock-${sha256.slice(0, 24)}`,
        sha256,
        name: "Look",
        amount: 9,
      })?.amount
    ).toBe(1);
    expect(
      normalizeClipColorLut({
        id: "https://untrusted/look.cube",
        sha256,
        name: "Look",
        amount: 1,
      })
    ).toBeUndefined();
  });
});
