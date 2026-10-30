import { visualTransitions, type VisualTransition } from "./clip-visual";
export type TransitionPreset = {
  id: string;
  name: string;
  kind: Exclude<VisualTransition, "none">;
  duration: number;
};
export const TRANSITION_PRESETS: TransitionPreset[] = visualTransitions
  .filter(t => t.value !== "none")
  .flatMap(t =>
    [0.2, 0.45, 0.8].map(duration => ({
      id: `${t.value}-${duration}`,
      name: t.label,
      kind: t.value as TransitionPreset["kind"],
      duration,
    }))
  );
export function normalizeTransitionPresets(value: unknown): TransitionPreset[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.slice(0, 500).flatMap(v => {
    if (
      !v ||
      typeof v !== "object" ||
      typeof v.id !== "string" ||
      !/^[a-z0-9_-]{1,100}$/i.test(v.id) ||
      ids.has(v.id) ||
      typeof v.name !== "string" ||
      !v.name.trim() ||
      v.name.length > 60 ||
      !visualTransitions.some(t => t.value === v.kind && t.value !== "none") ||
      !Number.isFinite(v.duration) ||
      v.duration < 0.05 ||
      v.duration > 5
    )
      return [];
    ids.add(v.id);
    return [
      { id: v.id, name: v.name.trim(), kind: v.kind, duration: v.duration },
    ];
  });
}
