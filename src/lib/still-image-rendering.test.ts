import { describe, expect, it } from "vitest";
import { personCutoutPixels, relativeDepthPixels, type StillImageInference } from "./still-image-rendering";

const image: StillImageInference = {
  width: 3, height: 1,
  rgba: new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 128, 70, 80, 90, 0]),
  values: new Uint8Array([0, 128, 255]),
};
describe("still-image result pixels", () => {
  it("changes only alpha for cutouts and retains existing transparent pixels", () => {
    const pixels = personCutoutPixels(image, .5, 0);
    expect([...pixels]).toEqual([10, 20, 30, 0, 40, 50, 60, 128, 70, 80, 90, 0]);
    expect([...image.rgba]).toEqual([10, 20, 30, 255, 40, 50, 60, 128, 70, 80, 90, 0]);
  });
  it("softens threshold edges proportionally to the original alpha", () => {
    const pixels = personCutoutPixels(image, .5, .2);
    expect(pixels[7]).toBeGreaterThan(60);
    expect(pixels[7]).toBeLessThan(70);
    expect(personCutoutPixels(image, .6, 0)[7]).toBe(0);
  });
  it("writes relative grayscale depth and supports inversion without filling transparent pixels", () => {
    expect([...relativeDepthPixels(image, false)]).toEqual([0, 0, 0, 255, 128, 128, 128, 128, 255, 255, 255, 0]);
    expect([...relativeDepthPixels(image, true)]).toEqual([255, 255, 255, 255, 127, 127, 127, 128, 0, 0, 0, 0]);
  });
  it("rejects malformed model output and invalid controls", () => {
    expect(() => personCutoutPixels({ ...image, values: new Uint8Array(2) }, .5, .1)).toThrow("incomplete");
    expect(() => personCutoutPixels(image, NaN, .1)).toThrow("controls");
    expect(() => personCutoutPixels(image, .5, .6)).toThrow("controls");
  });
});
