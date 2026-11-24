import roots from "./native-transition-data.json";
import expanded from "./native-fusion-expanded.json";
import motionRoots from "./native-motion-data.json";
import { isNativeMatteId, matteDefinition, nativeMattes, type NativeMatteId } from "./native-motion-mattes";
import { compileMotionCropProgram } from "../scripts/lib/motion-curves.mjs";
import { compileFusionFrameProgram } from "../scripts/lib/fusion-frame-program.mjs";
import {
  readNativeFrameProgram,
  type NativeFrameProgram,
} from "./native-frame-program";

export type NativeTransitionId =
  | NativeMatteId
  | keyof typeof expanded
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
  | "scale-exchange"
  | "motion-wipe-up"
  | "motion-wipe-down";
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
  "motion-wipe-up",
  "motion-wipe-down",
  ...(Object.keys(expanded) as (keyof typeof expanded)[]),
  ...(Object.keys(nativeMattes) as NativeMatteId[]),
];
export const nativeTransitionDefinitions = {
  ...(Object.fromEntries((Object.keys(nativeMattes) as NativeMatteId[]).map(id => [id, matteDefinition(id)])) as Record<NativeMatteId, ReturnType<typeof matteDefinition>>),
  "stretch-wide": { name: "Wide stretch dissolve", inputOrder: ["outgoing", "incoming"], intentionalEmptyMidpoint: false, description: "The full picture stretches horizontally to six times its width at the cut while the shots blend. Use a clear center subject and avoid stretching faces or readable text." },
  "rotate-pull": { name: "Turning pullback", inputOrder: ["outgoing", "incoming"], intentionalEmptyMidpoint: false, description: "The outgoing shot turns through half a rotation and pulls back, exposing a border, as the incoming shot settles upright. Use for an intentional rotating reveal." },
  "rotate-push": { name: "Turning push-in", inputOrder: ["outgoing", "incoming"], intentionalEmptyMidpoint: false, description: "A fast half-turn and roughly threefold push-in fill the frame before settling on the upright incoming shot. Reserve for a requested spin or matching camera rotation." },
  "fold-y": { name: "Horizontal mirror bands", inputOrder: ["outgoing", "incoming"], intentionalEmptyMidpoint: false, description: "The two shots compress vertically into thin mirrored horizontal bands through the dissolve, then unfold. Use for an explicit graphic interruption." },
  "fold-x": { name: "Vertical mirror bands", inputOrder: ["outgoing", "incoming"], intentionalEmptyMidpoint: false, description: "Both shots compress horizontally into mirrored vertical strips at the center of the dissolve, then expand. Keep away from dialogue and small type." },
  "fold-left": { name: "Left-anchored mirror bands", inputOrder: ["outgoing", "incoming"], intentionalEmptyMidpoint: false, description: "Mirrored vertical strips fold around a left-hand pivot through the cut. Use when a graphic fold deliberately follows leftward composition." },
  "fold-right": { name: "Right-anchored mirror bands", inputOrder: ["outgoing", "incoming"], intentionalEmptyMidpoint: false, description: "Mirrored vertical strips fold around a right-hand pivot through the cut. Use when a graphic fold deliberately follows rightward composition." },
  "tile-right": { name: "Mirrored drift right", inputOrder: ["outgoing", "incoming"], intentionalEmptyMidpoint: false, description: "Both pictures pull back to one fifth scale in mirrored tiles and travel right through the dissolve. Use only for an intentional moving mosaic with clear subjects." },
  "tile-left": { name: "Mirrored drift left", inputOrder: ["outgoing", "incoming"], intentionalEmptyMidpoint: false, description: "Both pictures pull back to one fifth scale in mirrored tiles and travel left through the dissolve. Use only for an intentional moving mosaic with clear subjects." },
  "tile-up": { name: "Mirrored drift up", inputOrder: ["outgoing", "incoming"], intentionalEmptyMidpoint: false, description: "Both pictures pull back to one fifth scale in mirrored tiles and travel up through the dissolve. Use only for an intentional moving mosaic with clear subjects." },
  "tile-down": { name: "Mirrored drift down", inputOrder: ["outgoing", "incoming"], intentionalEmptyMidpoint: false, description: "Both pictures pull back to one fifth scale in mirrored tiles and travel down through the dissolve. Use only for an intentional moving mosaic with clear subjects." },
  "motion-wipe-up": {
    name: "Eased wipe up",
    inputOrder: ["outgoing", "incoming"],
    intentionalEmptyMidpoint: false,
    description:
      "The next shot is revealed from bottom to top while both pictures stay fixed. Preserves the source crop curves, including their acceleration and slowdown. Use for an intentional upward reveal or before/after comparison; no black interval.",
  },
  "motion-wipe-down": {
    name: "Eased wipe down",
    inputOrder: ["outgoing", "incoming"],
    intentionalEmptyMidpoint: false,
    description:
      "The next shot is revealed from top to bottom while both pictures stay fixed. Preserves the source crop curve, including its acceleration and slowdown. Use for an intentional downward reveal or before/after comparison; no black interval.",
  },
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
const fusionSources = { ...roots, ...expanded };
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
    if (!Number.isInteger(frames) || frames < 2 || frames > 18000)
      throw new Error("Invalid native transition clock");
    program = readNativeFrameProgram(
      isNativeMatteId(id)
        ? {
            schema: "reel-native-frame-program-v1", frames, fps, inputs: ["input-0", "input-1"],
            output: "node-0", admission: "requires-renderer-and-native-parity",
            nodes: [{ id: "node-0", kind: "matte", a: "input-0", b: "input-1", matteId: id,
              samples: Array.from({ length: frames }, (_, i) => ({ mix: i / (frames - 1) })) }],
          }
        : id === "motion-wipe-up" || id === "motion-wipe-down"
        ? compileMotionCropProgram(motionRoots[id], { frames, fps })
        : compileFusionFrameProgram(fusionSources[id], { frames, fps })
    );
    if (cache.size >= 32) cache.delete(cache.keys().next().value!);
    cache.set(key, program);
  }
  return program;
}
