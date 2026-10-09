import type * as Transformers from "@huggingface/transformers";

let loaded: Promise<typeof Transformers> | undefined;
/** The package's exact browser bundle is prepared locally at build time. Keeping
 * this runtime import out of Vite prevents an additional unused WASM asset in
 * every worker build. No provider, CDN, or remote model fallback is configured. */
export function loadLocalTransformers(): Promise<typeof Transformers> {
  const resource = "/vendor/search/transformers.js";
  loaded ??= import(/* @vite-ignore */ resource) as Promise<
    typeof Transformers
  >;
  return loaded;
}
