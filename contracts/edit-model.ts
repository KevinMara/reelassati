export const EDIT_MODELS = [
  "moonshotai/kimi-k3",
  "moonshotai/kimi-k3.1-pro",
] as const;
export type EditModel = (typeof EDIT_MODELS)[number];
export type EditEffort = "balanced" | "max";
export function editModel(value: unknown): EditModel {
  if (value === undefined || value === EDIT_MODELS[0]) return EDIT_MODELS[0];
  // Old saved requests may mention Pro. Current product editing always uses K3.
  if (value === EDIT_MODELS[1]) return EDIT_MODELS[0];
  throw new Error("Choose a supported editing model.");
}
export const editReasoningEffort = (value: unknown) =>
  value === "max" ? ("high" as const) : ("low" as const);

/** Output includes the reasoning, the edit decisions and the per-scene review.
 * Asking for the largest possible completion also reserves it on short edits. */
export function editPlanOutputTokens(scenes: number, clips: number, seconds: number, effort: unknown) {
  const beats = Math.max(scenes, clips, Math.ceil(seconds / 3));
  return Math.min(24_000, (effort === "max" ? 8_192 : 6_144) + 384 * beats);
}
