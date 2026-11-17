import type { Asset, EditProject } from "./workspace";
import type { VisualTransition } from "./clip-visual";
import { applyAdjacentTransition } from "./adjacent-transition";
import {
  applyNativeAdjacentTransition,
  isNativeTransitionKind,
  type NativeTransitionKind,
} from "./native-transitions";

export type ShotTransitionKind = VisualTransition | NativeTransitionKind;
/** One dispatch contract for manual controls, Reel chat and auto-edit. */
export function applyShotTransition(
  project: EditProject,
  assets: Asset[],
  outgoingId: string,
  incomingId: string,
  kind: ShotTransitionKind,
  duration: number
) {
  return isNativeTransitionKind(kind)
    ? applyNativeAdjacentTransition(
        project,
        assets,
        outgoingId,
        incomingId,
        kind,
        duration
      )
    : applyAdjacentTransition(
        project,
        assets,
        outgoingId,
        incomingId,
        kind,
        duration
      );
}
