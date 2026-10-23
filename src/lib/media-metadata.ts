import type { Asset } from "@contracts/workspace";

/** Read the source clock and geometry together before quoting analysis or
 * creating a project. Missing dimensions must not silently crop a landscape
 * upload into a portrait optimization project. No inference is involved. */
export async function resolveVideoMetadata(
  asset: Asset,
  signal?: AbortSignal
): Promise<Asset> {
  signal?.throwIfAborted();
  if (asset.kind !== "video")
    throw new Error("Select a video before running analysis.");
  if (
    Number.isFinite(asset.duration) &&
    asset.duration! > 0 &&
    Number.isFinite(asset.width) &&
    asset.width! > 0 &&
    Number.isFinite(asset.height) &&
    asset.height! > 0
  )
    return asset;
  return new Promise((resolve, reject) => {
    const media = document.createElement("video");
    let finished = false;
    const finish = (error?: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", aborted);
      media.onloadedmetadata = media.onerror = null;
      const duration = media.duration,
        width = media.videoWidth,
        height = media.videoHeight;
      media.removeAttribute("src");
      media.load();
      if (error) reject(error);
      else if (
        Number.isFinite(duration) &&
        duration > 0 &&
        width > 0 &&
        height > 0
      )
        resolve({ ...asset, duration, width, height });
      else
        reject(
          new Error(
            `Could not detect the video metadata of ${asset.name}. Retry after the media finishes loading.`
          )
        );
    };
    const aborted = () =>
      finish(signal?.reason || new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            "The source preview could not load. Refresh the Library link."
          )
        ),
      15_000
    );
    media.preload = "metadata";
    media.onloadedmetadata = () => finish();
    media.onerror = () =>
      finish(
        new Error(
          "The source preview could not load. Refresh the Library link."
        )
      );
    signal?.addEventListener("abort", aborted, { once: true });
    media.src = asset.url;
  });
}

/** Keep source precision; rounding belongs only in presentation. */
export async function resolveMediaDuration(asset: Asset): Promise<number> {
  if (asset.kind === "image") return asset.duration || 3;
  if (Number.isFinite(asset.duration) && asset.duration! > 0)
    return asset.duration!;
  return new Promise((resolve, reject) => {
    const media = document.createElement(
      asset.kind === "audio" ? "audio" : "video"
    );
    const finish = (duration?: number) => {
      clearTimeout(timer);
      media.onloadedmetadata = media.onerror = null;
      media.removeAttribute("src");
      media.load();
      if (duration && Number.isFinite(duration)) resolve(duration);
      else
        reject(
          new Error(
            `Could not detect the duration of ${asset.name}. Retry after the media finishes loading.`
          )
        );
    };
    const timer = setTimeout(() => finish(), 15000);
    media.preload = "metadata";
    media.onloadedmetadata = () => finish(media.duration);
    media.onerror = () => finish();
    media.src = asset.url;
  });
}
