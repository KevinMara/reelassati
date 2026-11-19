import { evaluateFusionSpline } from "./fusion-curves.mjs";

/** Motion stores tangent offsets in seconds/value units, not normalized easing.
 * Exported channel data stays inert: no behaviors or expressions execute here. */
export function sampleMotionCurve(curve, time) {
  if (
    !curve ||
    curve.interpolation !== "bezier" ||
    !Array.isArray(curve.knots) ||
    !curve.knots.length
  )
    throw new Error("Unsupported Motion curve");
  const value = evaluateFusionSpline(curve.knots, time);
  return Math.max(
    curve.minimum ?? -Infinity,
    Math.min(curve.maximum ?? Infinity, value)
  );
}

export function compileMotionCropProgram(source, { frames, fps }) {
  if (
    source?.schema !== "reel-motion-crop-source-v1" ||
    !Number.isInteger(frames) ||
    frames < 2 ||
    frames > 18000 ||
    !Number.isFinite(fps) ||
    fps <= 0 ||
    fps > 120
  )
    throw new Error("Invalid Motion crop program");
  if (
    ![source.width, source.height, source.endTime].every(
      n => Number.isFinite(n) && n > 0
    )
  )
    throw new Error("Invalid Motion source clock or dimensions");
  if (
    Object.keys(source.crop).some(
      key => !["left", "right", "top", "bottom"].includes(key)
    )
  )
    throw new Error("Unsupported Motion crop edge");
  const samples = Array.from({ length: frames }, (_, frame) => {
    const time = (source.endTime * frame) / (frames - 1);
    const edge = key =>
      source.crop[key]
        ? sampleMotionCurve(source.crop[key], time) /
          (key === "left" || key === "right" ? source.width : source.height)
        : 0;
    return {
      left: edge("left"),
      right: edge("right"),
      top: edge("top"),
      bottom: edge("bottom"),
    };
  });
  return {
    schema: "reel-native-frame-program-v1",
    frames,
    fps,
    inputs: ["input-0", "input-1"],
    output: "node-1",
    nodes: [
      { id: "node-0", kind: "crop", input: "input-0", samples },
      {
        id: "node-1",
        kind: "over",
        a: "input-1",
        b: "node-0",
        samples: Array.from({ length: frames }, () => ({ mix: 1 })),
      },
    ],
    admission: "requires-renderer-and-native-parity",
  };
}
