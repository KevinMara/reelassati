import { describe, expect, it } from "vitest";
import {
  normalizeHex,
  hexToRgb,
  rgbToHex,
  hexToHsv,
  hsvToHex,
} from "./color-picker";

describe("editor color values", () => {
  it("accepts shorthand and pasted hex without accepting invalid CSS", () => {
    expect(normalizeHex(" abc ")).toBe("#AABBCC");
    expect(normalizeHex("#12aBcD")).toBe("#12ABCD");
    for (const value of ["", "#12", "#ggg", "red", "#12345678", "url(x)"])
      expect(normalizeHex(value)).toBeUndefined();
  });
  it("bounds RGB channels and handles black and white", () => {
    expect(rgbToHex([-4, 260, 127.6])).toBe("#00FF80");
    expect(hexToRgb("#FFFFFF")).toEqual([255, 255, 255]);
    expect(hexToHsv("#000000")).toEqual({ h: 0, s: 0, v: 0 });
    expect(hexToHsv("#FFFFFF")).toEqual({ h: 0, s: 0, v: 100 });
  });
  it("round-trips neutral, primary and mixed colors through custom sliders", () => {
    for (const color of [
      "#000000",
      "#FFFFFF",
      "#FF0000",
      "#00FF00",
      "#0000FF",
      "#A78BFA",
      "#FDE047",
      "#123456",
      "#808080",
    ])
      expect(hsvToHex(hexToHsv(color))).toBe(color);
    expect(hsvToHex({ h: 360, s: 100, v: 100 })).toBe("#FF0000");
    expect(hsvToHex({ h: -120, s: 100, v: 100 })).toBe("#0000FF");
  });
});
