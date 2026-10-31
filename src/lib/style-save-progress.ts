import { useSyncExternalStore } from "react";

export type StyleSaveProgress = {
  phase: "saving" | "preview" | "saved" | "failed";
  percent: number;
  error?: string;
};
const states = new Map<string, StyleSaveProgress>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function styleSaveKey(owner: string, brand: string, projectId?: string) {
  return JSON.stringify([owner, brand, projectId ?? "reference"]);
}
export function setStyleSaveProgress(key: string, state: StyleSaveProgress) {
  states.set(key, state);
  listeners.forEach(listener => listener());
}
export function getStyleSaveProgress(key: string) {
  return states.get(key);
}
export function useStyleSaveProgress(key: string) {
  return useSyncExternalStore(
    subscribe,
    () => states.get(key),
    () => undefined
  );
}
