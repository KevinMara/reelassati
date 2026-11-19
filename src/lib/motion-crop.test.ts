import { describe, it, expect } from "vitest";
import roots from "@contracts/native-motion-data.json";
import { nativeTransitionProgram } from "@contracts/native-transition-program";
import {
  nativeSampleAt,
  readNativeFrameProgram,
} from "@contracts/native-frame-program";
import { sampleMotionCurve } from "../../scripts/lib/motion-curves.mjs";

describe("original Motion crop animation", () => {
  it.each(["motion-wipe-up", "motion-wipe-down"] as const)(
    "%s removes outgoing pixels without changing the input picture scale",
    id => {
      const program = nativeTransitionProgram(id, 61, 30),
        crop = program.nodes[0];
      expect(crop.kind).toBe("crop");
      if (crop.kind !== "crop") throw Error();
      expect(crop.input).toBe("input-0");
      expect(crop.samples[0]).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
      const edge = id.endsWith("up") ? "bottom" : "top";
      expect(crop.samples[30][edge]).toBeCloseTo(
        (edge === "top" ? 806 : 800) / 2 / 720,
        10
      );
      expect(crop.samples.at(-1)![edge]).toBeGreaterThan(1);
      expect(program.nodes[1]).toMatchObject({
        kind: "over",
        a: "input-1",
        b: "node-0",
      });
    }
  );
  it("retains and clamps the source secondary curve rather than interpreting UI selection as disabling animation", () => {
    const curve = roots["motion-wipe-up"].crop.top;
    expect(sampleMotionCurve(curve, 0.5)).toBe(0);
    expect(sampleMotionCurve(curve, 0.97)).toBeGreaterThan(0);
  });
  it("inverts authored tangent time rather than replacing a curve with generic easing", () => {
    const curve = {
      interpolation: "bezier",
      knots: [
        { at: 0, value: 0, right: [0.1, 0.8] },
        { at: 1, value: 1, left: [0.2, 0.9] },
      ],
    };
    expect(sampleMotionCurve(curve, 0.2375)).toBeCloseTo(0.7625, 10);
  });
  it("rejects malformed crop values and preserves fractional preview timing", () => {
    const p = structuredClone(
      nativeTransitionProgram("motion-wipe-up", 31, 30)
    );
    const crop = p.nodes[0];
    if (crop.kind !== "crop") throw Error();
    expect(nativeSampleAt(crop.samples, 10.5).bottom).toBeCloseTo(
      (crop.samples[10].bottom + crop.samples[11].bottom) / 2,
      12
    );
    for (const bad of [-1, NaN, Infinity, 1001]) {
      crop.samples[0].top = bad;
      expect(() => readNativeFrameProgram(p)).toThrow();
    }
  });
});
