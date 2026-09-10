import type { Asset } from "@contracts/workspace";

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
