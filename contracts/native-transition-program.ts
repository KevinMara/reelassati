import roots from "./native-transition-data.json";
import { compileFusionFrameProgram } from "../scripts/lib/fusion-frame-program.mjs";
import {
  readNativeFrameProgram,
  type NativeFrameProgram,
} from "./native-frame-program";

export type NativeTransitionId = "stretch" | "slide" | "zoom" | "grid";
export const nativeTransitionIds: readonly NativeTransitionId[] = [
  "stretch",
  "slide",
  "zoom",
  "grid",
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
