import { fields, resolvedFusionTools } from "./fusion-setting.mjs";
import { fusionParameterEvaluator } from "./fusion-curves.mjs";

/** Compile verified data operations to a neutral, sampled render graph.
 * This is a conversion artifact, not catalog admission or a parity certificate.
 * Preserve original group pin order even when it differs from A-to-B convention.
 */
export function compileFusionFrameProgram(
  root,
  { frames = 180, fps = 30 } = {}
) {
  if (
    !Number.isInteger(frames) ||
    frames < 2 ||
    frames > 18000 ||
    !Number.isFinite(fps) ||
    fps <= 0 ||
    fps > 120
  )
    throw new Error("Invalid native reference clock");
  const tools = resolvedFusionTools(root);
  const groups = Object.values(fields(fields(root).Tools)).filter(n =>
    ["GroupOperator", "MacroOperator"].includes(n.tag)
  );
  if (groups.length !== 1)
    throw new Error("A single explicit native root group is required");
  const group = groups[0],
    external = new Map();
  const inputs = Object.entries(fields(fields(group).Inputs)).filter(
    ([, n]) =>
      n?.tag === "InstanceInput" &&
      ["Input", "Foreground", "Background"].includes(fields(n).Source)
  );
  if (inputs.length !== 2)
    throw new Error("Exactly two authored image inputs are required");
  inputs.forEach(([, n], index) => {
    const p = fields(n),
      key = `${p.SourceOp}.${p.Source}`;
    if (external.has(key)) throw new Error("Duplicate native image pin");
    external.set(key, `input-${index}`);
  });
  const outputs = Object.values(fields(fields(group).Outputs));
  if (
    outputs.length !== 1 ||
    outputs[0].tag !== "InstanceOutput" ||
    fields(outputs[0]).Source !== "Output"
  )
    throw new Error("A single explicit native image output is required");
  const evaluator = fusionParameterEvaluator(root, { frames });
  const ids = new Map(),
    visiting = new Set(),
    nodes = [];
  const number = (name, key, frame, fallback) => {
    const v = evaluator.input(name, key, frame, fallback);
    if (typeof v !== "number" || !Number.isFinite(v))
      throw new Error(`Invalid numeric input ${name}.${key}`);
    return v;
  };
  const point = (name, key, frame) => {
    const v = fields(
      evaluator.input(name, key, frame, {
        tag: null,
        entries: { 1: 0.5, 2: 0.5 },
      })
    );
    if (![v[1], v[2]].every(Number.isFinite))
      throw new Error(`Invalid point ${name}.${key}`);
    return [v[1], v[2]];
  };
  function imageInput(name, key) {
    if (external.has(`${name}.${key}`)) return external.get(`${name}.${key}`);
    const p = fields(fields(fields(tools.get(name)).Inputs)[key]);
    if (p.Source !== "Output" || typeof p.SourceOp !== "string")
      throw new Error(`Unresolved native image input ${name}.${key}`);
    return compile(p.SourceOp);
  }
  function compile(name) {
    if (visiting.has(name)) throw new Error("Cyclic native image graph");
    if (ids.has(name)) return ids.get(name);
    const node = tools.get(name);
    if (!node) throw new Error(`Unresolved native image node ${name}`);
    if (!["Dissolve", "Transform", "Merge"].includes(node.tag))
      throw new Error(`Native renderer operation not implemented: ${node.tag}`);
    visiting.add(name);
    const allowed =
      node.tag === "Dissolve"
        ? ["Background", "Foreground", "Mix"]
        : node.tag === "Merge"
          ? [
              "Background",
              "Foreground",
              "Blend",
              "PerformDepthMerge",
              "ApplyMode",
              "Operator",
              "Center",
              "Size",
              "Angle",
              "FlipHoriz",
              "FlipVert",
            ]
          : [
              "Input",
              "Center",
              "Pivot",
              "Size",
              "Aspect",
              "XSize",
              "YSize",
              "UseSizeAndAspect",
              "Angle",
              "Edges",
              "MotionBlur",
              "Quality",
              "ShutterAngle",
              "FlipHoriz",
              "FlipVert",
            ];
    for (const [key, value] of Object.entries(fields(fields(node).Inputs)))
      if (!allowed.includes(key) && Object.keys(fields(value)).length)
        throw new Error(
          `Native renderer input not implemented: ${node.tag}.${key}`
        );
    let record;
    if (node.tag === "Dissolve") {
      const transitions = Object.values(fields(fields(node).Transitions));
      if (transitions.some(v => v !== "DFTDissolve"))
        throw new Error("Native custom dissolve plug-in is not implemented");
      record = {
        kind: "mix",
        a: imageInput(name, "Background"),
        b: imageInput(name, "Foreground"),
        samples: Array.from({ length: frames }, (_, t) => ({
          mix: number(name, "Mix", t, 0.5),
        })),
      };
    } else if (node.tag === "Merge") {
      const background = imageInput(name, "Background");
      let foreground = imageInput(name, "Foreground");
      // Fusion's Merge sizing controls transform only the foreground before
      // compositing (Fusion manual, Composite Nodes / Foreground Sizing).
      // Keep that operation separate so input order and alpha remain explicit.
      const sourceInputs = fields(fields(node).Inputs);
      if (
        ["Center", "Size", "Angle", "FlipHoriz", "FlipVert"].some(
          key => sourceInputs[key]
        )
      ) {
        const transformId = `node-${nodes.length}`;
        nodes.push({
          id: transformId,
          kind: "transform",
          input: foreground,
          samples: Array.from({ length: frames }, (_, t) => {
            const size = number(name, "Size", t, 1),
              flipX = number(name, "FlipHoriz", t, 0),
              flipY = number(name, "FlipVert", t, 0);
            if (size < 0 || ![0, 1].includes(flipX) || ![0, 1].includes(flipY))
              throw new Error("Invalid native merge sizing or flip mode");
            return {
              center: point(name, "Center", t),
              pivot: [0.5, 0.5],
              scaleX: size * (flipX ? -1 : 1),
              scaleY: size * (flipY ? -1 : 1),
              angle: number(name, "Angle", t, 0),
              edges: 0,
              motionBlur: 0,
              quality: 2,
              shutterAngle: 180,
            };
          }),
        });
        foreground = transformId;
      }
      record = {
        kind: "over",
        a: background,
        b: foreground,
        samples: Array.from({ length: frames }, (_, t) => {
          if (
            number(name, "PerformDepthMerge", t, 0) !== 0 ||
            evaluator.input(name, "ApplyMode", t, "Normal") !== "Normal" ||
            evaluator.input(name, "Operator", t, "Over") !== "Over"
          )
            throw new Error(
              "Native merge mode requires a separate implementation"
            );
          return { mix: number(name, "Blend", t, 1) };
        }),
      };
    } else {
      const poseAt = t => {
        const linked = number(name, "UseSizeAndAspect", t, 1),
          size = number(name, "Size", t, 1),
          aspect = number(name, "Aspect", t, 1);
        const flipX = number(name, "FlipHoriz", t, 0),
          flipY = number(name, "FlipVert", t, 0);
        if (
          ![0, 1].includes(linked) ||
          ![0, 1].includes(flipX) ||
          ![0, 1].includes(flipY) ||
          (linked && aspect <= 0)
        )
          throw new Error("Invalid native transform aspect or flip mode");
        return {
          center: point(name, "Center", t),
          pivot: point(name, "Pivot", t),
          scaleX:
            (linked
              ? size * Math.max(1, aspect)
              : number(name, "XSize", t, 1)) * (flipX ? -1 : 1),
          scaleY:
            (linked
              ? size / Math.min(1, aspect)
              : number(name, "YSize", t, 1)) * (flipY ? -1 : 1),
          angle: number(name, "Angle", t, 0),
          edges: number(name, "Edges", t, 0),
        };
      };
      record = {
        kind: "transform",
        input: imageInput(name, "Input"),
        samples: Array.from({ length: frames }, (_, t) => {
          const pose = poseAt(t);
          const motionBlur = number(name, "MotionBlur", t, 0);
          const quality = number(name, "Quality", t, 2);
          const shutterAngle = number(name, "ShutterAngle", t, 180);
          if (motionBlur !== 0 && motionBlur !== 1)
            throw new Error("Unsupported native motion blur mode");
          if (!motionBlur)
            return { ...pose, motionBlur, quality, shutterAngle };
          if (
            !Number.isInteger(quality) ||
            quality < 1 ||
            quality > 10 ||
            shutterAngle < 0 ||
            shutterAngle > 360
          )
            throw new Error("Unsupported native shutter settings");
          // Fusion samples both sides of the frame. Evaluate the actual source
          // splines at those times, including the two edges of the exposure.
          const shutter = Array.from({ length: quality * 2 + 1 }, (_, i) =>
            poseAt(t + ((i / (2 * quality) - 0.5) * shutterAngle) / 360)
          );
          return { ...pose, motionBlur, quality, shutterAngle, shutter };
        }),
      };
    }
    const id = `node-${nodes.length}`;
    ids.set(name, id);
    nodes.push({ id, ...record });
    visiting.delete(name);
    return id;
  }
  const output = compile(fields(outputs[0]).SourceOp);
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
