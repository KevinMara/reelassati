export const EDIT_MODELS = [
  "moonshotai/kimi-k3",
  "moonshotai/kimi-k3.1-pro",
] as const;
export type EditModel = (typeof EDIT_MODELS)[number];
export type EditEffort = "balanced" | "max";
export function editModel(value: unknown): EditModel {
  if (value === undefined || value === EDIT_MODELS[0]) return EDIT_MODELS[0];
  if (value === EDIT_MODELS[1]) return EDIT_MODELS[1];
  throw new Error("Choose a supported editing model.");
}
export const editReasoningEffort = (value: unknown) =>
  value === "max" ? ("high" as const) : ("low" as const);
