import { describe, it, expect } from "vitest";
import {
  nativeTransitionProgram,
  nativeTransitionDefinitions,
  nativeTransitionIds,
} from "@contracts/native-transition-program";
describe("authored native transition clocks", () => {
  it("keeps the two bottom-corner exchanges horizontally reflected throughout the shutter exposure", () => {
    const right = nativeTransitionProgram("drag-from-bottom-right", 25, 24);
    const left = nativeTransitionProgram("drag-from-bottom-left", 25, 24);
    expect(nativeTransitionDefinitions["drag-from-bottom-right"].inputOrder).toEqual(["incoming", "outgoing"]);
    for (const [i, node] of right.nodes.entries()) {
      const other = left.nodes[i];
      if (node.kind !== "transform" || other.kind !== "transform") {
        expect(node).toEqual(other);
        continue;
      }
      expect(node.input).toBe(other.input);
      for (const [t, sample] of node.samples.entries()) {
        const opposite = other.samples[t];
        expect(sample.pivot).toEqual([1 - opposite.pivot[0], opposite.pivot[1]]);
        expect(sample.scaleX).toBeCloseTo(opposite.scaleX, 10);
        expect(sample.shutter?.map(s => s.scaleX)).toEqual(opposite.shutter?.map(s => s.scaleX));
      }
    }
  });
  it.each([2, 8, 14, 24, 30, 60, 180, 300])(
    "compiles actual %i-frame clocks without unsupported operations",
    frames => {
      for (const id of nativeTransitionIds) {
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
