/** Validated data graph. This contract never executes native template source. */
export interface NativeTransformSample {
  center: [number, number];
  pivot: [number, number];
  scaleX: number;
  scaleY: number;
  angle: number;
  edges: number;
  motionBlur: number;
  quality: number;
  shutterAngle: number;
}
export type NativeFrameNode =
  | {
      id: string;
      kind: "mix" | "over";
      a: string;
      b: string;
      samples: { mix: number }[];
    }
  | {
      id: string;
      kind: "transform";
      input: string;
      samples: NativeTransformSample[];
    };
export interface NativeFrameProgram {
  schema: "reel-native-frame-program-v1";
  frames: number;
  fps: number;
  inputs: ["input-0", "input-1"];
  output: string;
  nodes: NativeFrameNode[];
  admission: "requires-renderer-and-native-parity";
}

const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("Invalid native graph record");
  return v as Record<string, unknown>;
};
const numeric = (v: unknown, min: number, max: number): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw new Error("Invalid native graph number");
  return v;
};
const point = (v: unknown): [number, number] => {
  if (!Array.isArray(v) || v.length !== 2)
    throw new Error("Invalid native graph point");
  return [numeric(v[0], -1000, 1000), numeric(v[1], -1000, 1000)];
};
/** Validate before allocating GPU resources. Forward references, cycles and
 * unknown image operations fail instead of becoming a generic effect. */
export function readNativeFrameProgram(value: unknown): NativeFrameProgram {
  const v = record(value);
  if (
    v.schema !== "reel-native-frame-program-v1" ||
    v.admission !== "requires-renderer-and-native-parity" ||
    !Array.isArray(v.inputs) ||
    v.inputs.join(",") !== "input-0,input-1"
  )
    throw new Error("Unsupported native graph contract");
  const frames = numeric(v.frames, 2, 18000),
    fps = numeric(v.fps, 0.1, 120);
  if (
    !Number.isInteger(frames) ||
    !Array.isArray(v.nodes) ||
    !v.nodes.length ||
    v.nodes.length > 64
  )
    throw new Error("Invalid native graph size");
  const ids = new Set(["input-0", "input-1"]);
  const input = (id: unknown) => {
    if (typeof id !== "string" || !ids.has(id))
      throw new Error("Unresolved or cyclic native image input");
    return id;
  };
  const nodes: NativeFrameNode[] = v.nodes.map(raw => {
    const n = record(raw);
    if (
      typeof n.id !== "string" ||
      !/^node-\d{1,3}$/.test(n.id) ||
      ids.has(n.id) ||
      !Array.isArray(n.samples) ||
      n.samples.length !== frames
    )
      throw new Error("Invalid native graph node");
    let node: NativeFrameNode;
    if (n.kind === "mix" || n.kind === "over") {
      node = {
        id: n.id,
        kind: n.kind,
        a: input(n.a),
        b: input(n.b),
        samples: n.samples.map(s => ({ mix: numeric(record(s).mix, 0, 1) })),
      };
    } else if (n.kind === "transform") {
      node = {
        id: n.id,
        kind: "transform",
        input: input(n.input),
        samples: n.samples.map(rawSample => {
          const s = record(rawSample);
          const edges = numeric(s.edges, 0, 3),
            motionBlur = numeric(s.motionBlur, 0, 1);
          if (!Number.isInteger(edges) || motionBlur !== 0)
            throw new Error(
              "Native temporal blur requires subframe reference validation"
            );
          return {
            center: point(s.center),
            pivot: point(s.pivot),
            scaleX: numeric(s.scaleX, -1000, 1000),
            scaleY: numeric(s.scaleY, -1000, 1000),
            angle: numeric(s.angle, -100000, 100000),
            edges,
            motionBlur,
            quality: numeric(s.quality, 1, 128),
            shutterAngle: numeric(s.shutterAngle, 0, 360),
          };
        }),
      };
    } else throw new Error("Native image operation is not implemented");
    ids.add(node.id);
    return node;
  });
  const output = input(v.output);
  if (output.startsWith("input-"))
    throw new Error("Native graph output must be an image operation");
  return {
    schema: "reel-native-frame-program-v1",
    frames,
    fps,
    inputs: ["input-0", "input-1"],
    output,
    nodes,
    admission: "requires-renderer-and-native-parity",
  };
}

/** Integer frames are exact samples; fractional preview positions interpolate
 * between them. Neither wall-clock time nor playback order changes the result. */
export function nativeSampleAt<
  T extends { mix: number } | NativeTransformSample,
>(samples: T[], frame: number): T {
  if (!Number.isFinite(frame) || !samples.length)
    throw new Error("Invalid native frame time");
  const t = Math.max(0, Math.min(samples.length - 1, frame)),
    i = Math.floor(t),
    f = t - i;
  const a = samples[i],
    b = samples[Math.min(i + 1, samples.length - 1)];
  if (f === 0) return a;
  if ("mix" in a && "mix" in b)
    return { mix: a.mix + (b.mix - a.mix) * f } as T;
  if (!("center" in a) || !("center" in b))
    throw new Error("Inconsistent native samples");
  const mix = (a: number, b: number) => a + (b - a) * f;
  return {
    ...a,
    center: [mix(a.center[0], b.center[0]), mix(a.center[1], b.center[1])],
    pivot: [mix(a.pivot[0], b.pivot[0]), mix(a.pivot[1], b.pivot[1])],
    scaleX: mix(a.scaleX, b.scaleX),
    scaleY: mix(a.scaleY, b.scaleY),
    angle: mix(a.angle, b.angle),
  } as T;
}
