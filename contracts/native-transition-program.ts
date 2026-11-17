import roots from "./native-transition-data.json";
import { compileFusionFrameProgram } from "../scripts/lib/fusion-frame-program.mjs";
import {
  readNativeFrameProgram,
  type NativeFrameProgram,
} from "./native-frame-program";

export type NativeTransitionId = "stretch" | "slide";
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
