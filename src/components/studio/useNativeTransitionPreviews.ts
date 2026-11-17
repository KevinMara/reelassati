import { useEffect, useMemo, useRef, useState } from "react";
import type { Asset, EditProject } from "@contracts/workspace";
import {
  nativeTransitionRecipes,
  type NativeTransitionRecipe,
} from "@contracts/native-transitions";
import { materializeNativeTransition } from "@contracts/native-transition-materialize";

type Ready = {
  url: string;
  width: number;
  height: number;
  duration: number;
  size: number;
};
/** Deterministic, cancellable preview work. No model requests, saved blob URLs,
 * native applications or changes to the durable edit. */
export function useNativeTransitionPreviews(
  source: EditProject,
  sourceAssets: Asset[],
  time: number
) {
  const recipes = useMemo(() => {
    try {
      return { items: nativeTransitionRecipes(source), error: "" };
    } catch (error) {
      return {
        items: [] as NativeTransitionRecipe[],
        error:
          error instanceof Error ? error.message : "Invalid native transition",
      };
    }
  }, [source]);
  const keyFor = (recipe: NativeTransitionRecipe) =>
    JSON.stringify([
      source.id,
      source.aspectRatio,
      recipe,
      sourceAssets
        .filter(a =>
          [recipe.outgoing.assetId, recipe.incoming.assetId].includes(a.id)
        )
        .map(a => [a.id, a.url, a.status, a.size]),
    ]);
  const work = recipes.items.map(recipe => ({ recipe, key: keyFor(recipe) }));
  const signature = JSON.stringify(work.map(item => item.key));
  const latest = useRef({ source, sourceAssets, work });
  latest.current = { source, sourceAssets, work };
  const ready = useRef(new Map<string, Ready>()),
    errors = useRef(new Map<string, string>());
  const [revision, setRevision] = useState(0),
    [readyRevision, refresh] = useState(0);
  useEffect(() => {
    const { source, sourceAssets, work } = latest.current,
      wanted = new Set(work.map(item => item.key));
    for (const [key, value] of ready.current)
      if (!wanted.has(key)) {
        URL.revokeObjectURL(value.url);
        ready.current.delete(key);
      }
    errors.current.clear();
    const controller = new AbortController();
    void (async () => {
      for (const { recipe, key } of work) {
        if (controller.signal.aborted) return;
        if (ready.current.has(key)) continue;
        try {
          const { renderVideo } = await import("@/lib/render-video");
          controller.signal.throwIfAborted();
          const scoped = {
            ...source,
            transcript: [],
            clips: [
              { ...recipe.outgoing, shotTransition: undefined },
              recipe.incoming,
            ],
          };
          const result = await renderVideo(scoped, sourceAssets, {
            resolution: 720,
            format: "mp4",
            signal: controller.signal,
            nativePreviewOnly: recipe.key,
            onProgress: () => {},
          });
          controller.signal.throwIfAborted();
          ready.current.set(key, {
            url: URL.createObjectURL(result.file),
            width: result.width,
            height: result.height,
            duration: result.duration,
            size: result.file.size,
          });
        } catch (error) {
          if (controller.signal.aborted) return;
          errors.current.set(
            key,
            error instanceof Error
              ? error.message
              : "The transition preview could not load."
          );
        }
        if (!controller.signal.aborted) refresh(n => n + 1);
      }
    })();
    return () => controller.abort();
  }, [signature, revision]);
  useEffect(
    () => () => {
      for (const value of ready.current.values())
        URL.revokeObjectURL(value.url);
      ready.current.clear();
    },
    []
  );
  // Playback time changes must not recreate media-layer objects or restart
  // their transport. Materialize only when the edit or rendered files change.
  const { project, assets, renderIds } = useMemo(() => {
    let project = source,
      assets = sourceAssets;
    const renderIds = new Set<string>();
    for (const { recipe, key } of latest.current.work) {
      const value = ready.current.get(key);
      if (!value) continue;
      const materialized = materializeNativeTransition(project, recipe, value);
      project = materialized.project;
      assets = [...assets, { ...materialized.asset, contentType: "video/mp4" }];
      renderIds.add(recipe.key);
    }
    return { project, assets, renderIds };
  }, [source, sourceAssets, signature, readyRevision]);
  const active = work.find(
    ({ recipe }) =>
      time >= recipe.start && time < recipe.start + recipe.duration
  );
  const error =
    recipes.error || (active && errors.current.get(active.key)) || "";
  const blocked = Boolean(
    recipes.error || (active && !ready.current.has(active.key))
  );
  return {
    project,
    assets,
    renderIds,
    blocked,
    error,
    active: Boolean(active),
    retry: () => setRevision(n => n + 1),
  };
}
