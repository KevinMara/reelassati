import roots from "./native-transition-data.json";
import { compileFusionFrameProgram } from "../scripts/lib/fusion-frame-program.mjs";
import {
  readNativeFrameProgram,
  type NativeFrameProgram,
} from "./native-frame-program";

export type NativeTransitionId =
  | "stretch"
  | "slide"
  | "zoom"
  | "grid"
  | "push-left"
  | "push-right"
  | "push-up"
  | "push-down"
  | "box-from-right"
  | "box-from-left"
  | "scale-exchange";
export const nativeTransitionIds: readonly NativeTransitionId[] = [
  "stretch",
  "slide",
  "zoom",
  "grid",
  "push-left",
  "push-right",
  "push-up",
  "push-down",
  "box-from-right",
  "box-from-left",
  "scale-exchange",
];
export const nativeTransitionDefinitions = {
  stretch: {
    name: "Elastic stretch",
    inputOrder: ["outgoing", "incoming"],
    description:
      "Both shots stretch horizontally around the center while the picture dissolves. Keeps a full picture throughout.",
    intentionalEmptyMidpoint: false,
  },
  slide: {
    name: "Slide through black",
    inputOrder: ["incoming", "outgoing"],
    description:
      "Both shots slide right out of frame, switch during an intentional black midpoint, and return. Avoid when continuous picture is required.",
    intentionalEmptyMidpoint: true,
  },
  zoom: {
    name: "Measured zoom dissolve",
    inputOrder: ["incoming", "outgoing"],
    description:
      "A small accelerating push on the outgoing shot blends into the incoming shot as it settles from a slight tiled zoom-out. Use for a motivated forward movement, not a hard whip.",
    intentionalEmptyMidpoint: false,
  },
  grid: {
    name: "Mirrored grid dissolve",
    inputOrder: ["incoming", "outgoing"],
    description:
      "Both shots pull back into mirrored image tiles and dissolve before returning to full frame. A pronounced graphic effect; use only when repeated reflected picture suits the content.",
    intentionalEmptyMidpoint: false,
  },
  "push-left": {
    name: "Accelerated push left",
    inputOrder: ["outgoing", "incoming"],
    description:
      "The outgoing shot moves left as the incoming shot enters from the right, accelerating through the cut and easing to rest. Use for a motivated leftward continuation; preserves the authored curves and source compositing.",
    intentionalEmptyMidpoint: false,
  },
  "push-right": {
    name: "Accelerated push right",
    inputOrder: ["incoming", "outgoing"],
    description:
      "The outgoing shot moves right as the incoming shot enters from the left, accelerating through the cut and easing to rest. Use for a motivated rightward continuation; preserves the authored curves and source compositing.",
    intentionalEmptyMidpoint: false,
  },
  "push-up": {
    name: "Accelerated push up",
    inputOrder: ["outgoing", "incoming"],
    description:
      "The outgoing shot moves upward as the incoming shot enters from below, accelerating through the cut and easing to rest. Use for a motivated upward continuation, not a default transition quota.",
    intentionalEmptyMidpoint: false,
  },
  "push-down": {
    name: "Accelerated push down",
    inputOrder: ["incoming", "outgoing"],
    description:
      "The outgoing shot moves downward as the incoming shot enters from above, accelerating through the cut and easing to rest. Use for a motivated downward continuation, not a default transition quota.",
    intentionalEmptyMidpoint: false,
  },
  "box-from-right": {
    name: "Picture reveal from right",
    inputOrder: ["incoming", "outgoing"],
    description:
      "The next shot enters from the right as a small centered picture over the outgoing shot, then expands to fill the frame. Use to introduce a distinct example or result; do not cover important detail or add unrelated text during the reveal.",
    intentionalEmptyMidpoint: false,
  },
  "box-from-left": {
    name: "Picture reveal from left",
    inputOrder: ["incoming", "outgoing"],
    description:
      "The next shot enters from the left as a small centered picture over the outgoing shot, then expands to fill the frame. Use to introduce a distinct example or result; do not cover important detail or add unrelated text during the reveal.",
    intentionalEmptyMidpoint: false,
  },
  "scale-exchange": {
    name: "Centered picture exchange",
    inputOrder: ["incoming", "outgoing"],
    description:
      "The outgoing shot shrinks while the next shot grows from the center over it. The authored composition reveals a black border around the shrinking pictures. Use only when that deliberate framed look fits the brief, never when uninterrupted full-frame picture is required.",
    intentionalEmptyMidpoint: false,
  },
} as const;
const cache = new Map<string, NativeFrameProgram>();
/** Re-evaluate the authored native curves on the actual effect clock. Do not
 * scale a fixed list of poses or substitute a generic animation. */
export function nativeTransitionProgram(
  id: NativeTransitionId,
  frames: number,
  fps: number
) {
  if (!Object.hasOwn(nativeTransitionDefinitions, id))
    throw new Error("Unknown native transition");
  const key = `${id}:${frames}:${fps}`;
  let program = cache.get(key);
  if (!program) {
    program = readNativeFrameProgram(
      compileFusionFrameProgram(roots[id], { frames, fps })
    );
    if (cache.size >= 32) cache.delete(cache.keys().next().value!);
    cache.set(key, program);
  }
  return program;
}
