import { describe, it, expect } from "vitest";
import {
  nativeTransitionProgram,
  nativeTransitionDefinitions,
} from "@contracts/native-transition-program";
describe("authored native transition clocks", () => {
  it.each([2, 8, 14, 24, 30, 60, 180, 300])(
    "compiles actual %i-frame clocks without unsupported operations",
    frames => {
      for (const id of ["stretch", "slide"] as const) {
        const p = nativeTransitionProgram(id, frames, 30);
        expect(p.frames).toBe(frames);
        expect(p.nodes.every(n => n.samples.length === frames)).toBe(true);
      }
    }
  );
  it("matches independent recorded native values at the asymmetric midpoint", () => {
    const p = nativeTransitionProgram("stretch", 180, 30),
      mix = p.nodes[0],
      warp = p.nodes[1];
    expect(mix.kind).toBe("mix");
    expect(warp.kind).toBe("transform");
    if (mix.kind !== "mix" || warp.kind !== "transform")
      throw Error("Wrong graph");
    expect(mix.samples[90].mix).toBeCloseTo(0.733072625698324, 8);
    expect(warp.samples[90].scaleX).toBeCloseTo(2.7958196121347525, 7);
    expect(warp.samples[135].scaleX).toBeCloseTo(1.0021898635245592, 8);
  });
  it("retains reversed native input roles and the intentional empty midpoint", () => {
    const p = nativeTransitionProgram("slide", 180, 30);
    expect(nativeTransitionDefinitions.slide.inputOrder).toEqual([
      "incoming",
      "outgoing",
    ]);
    expect(nativeTransitionDefinitions.slide.intentionalEmptyMidpoint).toBe(
      true
    );
    const warp = p.nodes[0];
    if (warp.kind !== "transform") throw Error("Wrong graph");
    expect(warp.samples[90].center[0]).toBe(1.5);
  });
});
