import { fields, resolvedFusionTools } from "./fusion-setting.mjs";

const clamp = x => Math.max(0, Math.min(1, x));
const finite = (v, label) => {
  if (typeof v !== "number" || !Number.isFinite(v))
    throw new Error(`Expected finite ${label}`);
  return v;
};
const id = value => (value?.tag === "FuID" ? fields(value)["1"] : value);

export function fusionSpline(value) {
  const knots = Object.entries(fields(value))
    .map(([at, point]) => {
      const p = fields(point);
      for (const flag of Object.keys(fields(p.Flags)))
        if (!["Linear", "StepIn", "StepOut", "LockedY"].includes(flag))
          throw new Error(`Unverified spline flag: ${flag}`);
      const handle = v =>
        v
          ? [
              finite(fields(v)["1"], "handle time"),
              finite(fields(v)["2"], "handle value"),
            ]
          : undefined;
      return {
        at: finite(Number(at), "knot time"),
        value: finite(p["1"], "knot value"),
        left: handle(p.LH),
        right: handle(p.RH),
        linear: fields(p.Flags).Linear === true,
        stepIn: fields(p.Flags).StepIn === true,
        stepOut: fields(p.Flags).StepOut === true,
      };
    })
    .sort((a, b) => a.at - b.at);
  if (!knots.length) throw new Error("Missing spline knots");
  return knots;
}

const bezier = (a, b, c, d, t) =>
  (1 - t) ** 3 * a +
  3 * (1 - t) ** 2 * t * b +
  3 * (1 - t) * t * t * c +
  t ** 3 * d;
export function evaluateFusionSpline(knots, time) {
  if (time <= knots[0].at) return knots[0].value;
  if (time >= knots.at(-1).at) return knots.at(-1).value;
  const index = knots.findIndex(k => k.at >= time);
  const a = knots[index - 1],
    b = knots[index];
  if (a.stepOut || b.stepIn) return a.value;
  if (b.linear || !a.right || !b.left)
    return a.value + ((b.value - a.value) * (time - a.at)) / (b.at - a.at);
  // Authored tangent X is time, not the parameter t. Invert X before sampling Y.
  if (
    a.right[0] < a.at ||
    a.right[0] > b.at ||
    b.left[0] < a.at ||
    b.left[0] > b.at
  )
    throw new Error("Non-monotonic spline time handles need native evaluation");
  let lo = 0,
    hi = 1;
  for (let n = 0; n < 48; n++) {
    const mid = (lo + hi) / 2;
    if (bezier(a.at, a.right[0], b.left[0], b.at, mid) < time) lo = mid;
    else hi = mid;
  }
  return bezier(a.value, a.right[1], b.left[1], b.value, (lo + hi) / 2);
}

function easeIn(kind, p) {
  switch (kind) {
    case "Linear":
      return p;
    case "Quad":
      return p * p;
    case "Cubic":
      return p ** 3;
    case "Quart":
      return p ** 4;
    case "Quint":
      return p ** 5;
    case "Sine":
      return 1 - Math.cos((p * Math.PI) / 2);
    case "Expo":
      return 2 ** (10 * p - 10) - 0.001;
    case "Circ":
      return 1 - Math.sqrt(1 - p * p);
    default:
      throw new Error(`Unverified native easing: ${kind}`);
  }
}

function easeOut(kind, p) {
  // Resolve's authored exponential curve uses the Penner correction rather
  // than a symmetric reflection of its ease-in curve.
  if (kind === "Expo") return p === 1 ? 1 : 1.001 * (1 - 2 ** (-10 * p));
  return 1 - easeIn(kind, 1 - p);
}

/** Evaluate saved modifier data only. Never evaluate an Expression string. */
export function fusionParameterEvaluator(root, { frames }) {
  if (!Number.isInteger(frames) || frames < 2)
    throw new Error("Native timeline needs at least two frames");
  const tools = resolvedFusionTools(root);
  const stack = new Set();
  function input(name, key, time, fallback) {
    const node = tools.get(name);
    if (!node) throw new Error(`Missing native tool: ${name}`);
    const value = fields(fields(fields(node).Inputs)[key]);
    if (value.Expression !== undefined)
      throw new Error(`Native expression requires compilation: ${name}.${key}`);
    if (value.SourceOp !== undefined)
      return output(value.SourceOp, value.Source, time);
    if (value.Value !== undefined) return id(value.Value);
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing native input: ${name}.${key}`);
  }
  function output(name, port, time) {
    const token = `${name}.${port}`;
    if (stack.has(token)) throw new Error(`Cyclic native modifier: ${token}`);
    const node = tools.get(name);
    if (!node) throw new Error(`Missing native modifier: ${name}`);
    stack.add(token);
    try {
      const n = (key, fallback) =>
        finite(input(name, key, time, fallback), `${name}.${key}`);
      const allow = keys => {
        for (const key of Object.keys(fields(fields(node).Inputs)))
          if (!keys.includes(key))
            throw new Error(`Unverified modifier input: ${name}.${key}`);
      };
      switch (node.tag) {
        case "LUTLookup": {
          allow([
            "Curve",
            "EaseIn",
            "EaseOut",
            "Lookup",
            "Mirror",
            "Invert",
            "Scale",
            "Offset",
            "TimeScale",
            "TimeOffset",
          ]);
          if (port !== "Value")
            throw new Error(`Unsupported modifier port: ${token}`);
          // Resolve offsets use the frame count, but the curve's 0..1 domain
          // spans first-to-last frame. These clocks differ by one frame.
          let p =
            ((time - n("TimeOffset", 0) * frames) * n("TimeScale", 1)) /
            (frames - 1);
          const mirror = n("Mirror", 0);
          if (![0, 1].includes(mirror))
            throw new Error("Unverified mirror mode");
          if (mirror === 1)
            p = Math.min(2 * p, (2 * frames) / (frames - 1) - 2 * p);
          // Clamp AFTER reflection. Clamping before it leaves a residual
          // transform past the curve's tail instead of returning to baseline.
          p = clamp(p);
          const curve = input(name, "Curve", time, "Custom");
          if (curve === "Easing") {
            const ei = input(name, "EaseIn", time, "Linear"),
              eo = input(name, "EaseOut", time, "Linear");
            p =
              p < 0.5
                ? easeIn(ei, 2 * p) / 2
                : 0.5 + easeOut(eo, 2 * p - 1) / 2;
          } else if (curve === "Custom") {
            const link = fields(fields(fields(node).Inputs).Lookup);
            const lut = tools.get(link.SourceOp);
            if (!lut || lut.tag !== "LUTBezier" || link.Source !== "Value")
              throw new Error("Missing native lookup spline");
            p = evaluateFusionSpline(
              fusionSpline(fields(fields(lut).KeyColorSplines)["0"]),
              p
            );
          } else throw new Error(`Unverified native curve: ${curve}`);
          const invert = n("Invert", 0);
          if (![0, 1].includes(invert))
            throw new Error("Unverified invert mode");
          // Fusion 18 reference, Anim Curves: flip the normalized curve before
          // applying the separately authored value scale and offset.
          if (invert) p = 1 - p;
          return p * n("Scale", 1) + n("Offset", 0);
        }
        case "BezierSpline":
          if (port !== "Value")
            throw new Error(`Unsupported modifier port: ${token}`);
          return evaluateFusionSpline(
            fusionSpline(fields(node).KeyFrames),
            time
          );
        case "Vector": {
          allow(["Distance", "Angle", "Origin"]);
          if (port !== "Position")
            throw new Error(`Unsupported modifier port: ${token}`);
          const distance = n("Distance", 0),
            angle = (n("Angle", 0) * Math.PI) / 180;
          const origin = fields(
            input(name, "Origin", time, {
              tag: null,
              entries: { 1: 0.5, 2: 0.5 },
            })
          );
          return {
            tag: null,
            entries: {
              1:
                finite(origin["1"], "vector origin") +
                distance * Math.cos(angle),
              2:
                finite(origin["2"], "vector origin") +
                distance * Math.sin(angle),
            },
          };
        }
        default:
          throw new Error(`Unverified native modifier: ${node.tag}`);
      }
    } finally {
      stack.delete(token);
    }
  }
  return { input, output, tools };
}
