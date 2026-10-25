import type * as Transformers from "@huggingface/transformers";

let loaded: Promise<typeof Transformers> | undefined;
/** The package's exact browser bundle is prepared locally at build time. Keeping
 * this runtime import out of Vite prevents an additional unused WASM asset in
 * every worker build. No provider, CDN, or remote model fallback is configured. */
export function loadLocalTransformers(): Promise<typeof Transformers> {
  // Vite decorates root-relative dynamic imports with ?import in development,
  // which public assets reject. An absolute same-origin URL remains a native
  // browser import in both module workers and the main window.
  const resource = new URL(
    "/vendor/search/transformers.js",
    self.location.href
  ).href;
  loaded ??= import(/* @vite-ignore */ resource) as Promise<
    typeof Transformers
  >;
  return loaded;
}
