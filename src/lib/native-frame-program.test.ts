import { describe, it, expect } from "vitest";
import {
  readNativeFrameProgram,
  nativeSampleAt,
} from "@contracts/native-frame-program";
const program = () => ({
  schema: "reel-native-frame-program-v1",
  admission: "requires-renderer-and-native-parity",
  frames: 2,
  fps: 30,
  inputs: ["input-0", "input-1"],
  output: "node-0",
  nodes: [
    {
      id: "node-0",
      kind: "mix",
      a: "input-0",
      b: "input-1",
      samples: [{ mix: 0 }, { mix: 1 }],
    },
  ],
});
describe("native graph boundary", () => {
  it("retains premultiplied over as a distinct operation and validates its blend", () => {
    const p = {
      ...program(),
      nodes: [{ ...program().nodes[0], kind: "over" }],
    };
    expect(readNativeFrameProgram(p).nodes[0].kind).toBe("over");
    p.nodes[0].samples[0].mix = 1.1;
    expect(() => readNativeFrameProgram(p)).toThrow();
  });
  it("keeps authored image pin order and deterministic sample clock", () => {
    const p = program();
    p.nodes[0].a = "input-1";
    p.nodes[0].b = "input-0";
    const read = readNativeFrameProgram(p);
    expect(read.nodes[0]).toMatchObject({ a: "input-1", b: "input-0" });
    const samples = [{ mix: 0 }, { mix: 1 }];
    expect(nativeSampleAt(samples, -1).mix).toBe(0);
    expect(nativeSampleAt(samples, 0.25).mix).toBe(0.25);
    expect(nativeSampleAt(samples, 99).mix).toBe(1);
    expect(() => nativeSampleAt(samples, NaN)).toThrow();
  });
  it("rejects cycles, undefined nodes, malformed timing and missing samples", () => {
    for (const bad of ["node-0", "node-1", "missing"]) {
      const p = program();
      p.nodes[0].a = bad;
      expect(() => readNativeFrameProgram(p)).toThrow(/cyclic/);
    }
    for (const bad of [NaN, Infinity, 0, 1, 1.5, 18001]) {
      const p = program();
      p.frames = bad;
      expect(() => readNativeFrameProgram(p)).toThrow();
    }
    const p = program();
    p.nodes[0].samples.pop();
    expect(() => readNativeFrameProgram(p)).toThrow();
  });
  it("does not accept unsupported blur or silently clamp invalid parameters", () => {
    const transform = {
      id: "node-0",
      kind: "transform",
      input: "input-0",
      samples: Array.from({ length: 2 }, () => ({
        center: [0.5, 0.5],
        pivot: [0.5, 0.5],
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        edges: 0,
        motionBlur: 0,
        quality: 2,
        shutterAngle: 180,
      })),
    };
    const p = { ...program(), nodes: [transform] };
    expect(readNativeFrameProgram(p).nodes[0].kind).toBe("transform");
    transform.samples[0].motionBlur = 1;
    expect(() => readNativeFrameProgram(p)).toThrow(/blur/);
    transform.samples[0].motionBlur = 0;
    transform.samples[0].edges = 1.5;
    expect(() => readNativeFrameProgram(p)).toThrow();
    transform.samples[0].edges = 0;
    transform.samples[0].scaleX = NaN;
    expect(() => readNativeFrameProgram(p)).toThrow();
  });
  it("interpolates position, pivot and independent axes without changing edge modes", () => {
    const a = {
      center: [0.5, 0.5] as [number, number],
      pivot: [0.5, 0.5] as [number, number],
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      edges: 2,
      motionBlur: 0,
      quality: 2,
      shutterAngle: 180,
    };
    const b = {
      ...a,
      center: [1, 0.25] as [number, number],
      pivot: [0, 1] as [number, number],
      scaleX: 3,
      scaleY: 0.5,
      angle: 90,
    };
    expect(nativeSampleAt([a, b], 0.5)).toMatchObject({
      center: [0.75, 0.375],
      pivot: [0.25, 0.75],
      scaleX: 2,
      scaleY: 0.75,
      angle: 45,
      edges: 2,
    });
  });
});
