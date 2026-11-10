export type StockKind = "image" | "video" | "audio";
export interface StockSearchOptions {
  page?: number;
  category?: "all" | "music" | "sound_effect";
}
export interface StockSearchPage {
  items: StockMedia[];
  page: number;
  hasMore: boolean;
}
export interface StockMedia {
  id: string;
  provider: "commons" | "openverse";
  kind: StockKind;
  title: string;
  creator: string;
  attribution?: string;
  source: string;
  license: string;
  licenseUrl: string;
  url: string;
  thumbnail?: string;
  duration?: number;
  width?: number;
  height?: number;
}

/** Only public media delivery paths, never arbitrary services on these domains. */
export function stockUrlSource(
  value: string
): "commons" | "freesound" | "archive" | "flickr" | "jamendo" | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return;
    const path = decodeURIComponent(url.pathname);
    if (
      /[\\\p{Cc}]/u.test(path) ||
      path.split("/").some(part => part === "." || part === "..")
    )
      return;
    if (
      ["upload.wikimedia.org", "thumb.wikimedia.org"].includes(url.hostname) &&
      /^\/wikipedia\/commons\/.+/.test(path)
    )
      return "commons";
    // Flickr's static image CDN only; never its account/API or arbitrary hosts.
    if (
      /^(?:live|farm\d+)\.staticflickr\.com$/.test(url.hostname) &&
      /^\/\d+\/\d+_[a-zA-Z\d]+(?:_[a-zA-Z\d]+)?\.(?:jpg|jpeg|png|webp)$/i.test(
        path
      )
    )
      return "flickr";
    // Provider-returned public audio delivery only, not Jamendo's API or site.
    if (url.hostname === "prod-1.storage.jamendo.com") {
      const keys = [...url.searchParams.keys()];
      if (
        path === "/" &&
        keys.length === 2 &&
        keys.every(key => key === "trackid" || key === "format") &&
        /^\d+$/.test(url.searchParams.get("trackid") ?? "") &&
        /^(?:mp31|mp32|ogg|flac)$/.test(url.searchParams.get("format") ?? "")
      )
        return "jamendo";
      if (
        /^\/download\/track\/\d+\/(?:mp31|mp32|ogg|flac)\/$/.test(path) &&
        !url.search
      )
        return "jamendo";
    }
    if (
      url.hostname === "freesound.org" &&
      /^\/data\/(?:previews|displays)\/\d+\/.+/.test(path)
    )
      return "freesound";
    if (
      url.hostname === "cdn.freesound.org" &&
      /^\/(?:previews|displays)\/\d+\/.+/.test(path)
    )
      return "freesound";
    if (url.hostname === "archive.org" && /^\/download\/[^/]+\/.+/.test(path))
      return "archive";
    if (
      /^ia\d+\.(?:us|eu)\.archive\.org$/.test(url.hostname) &&
      /^\/\d+\/items\/[^/]+\/.+/.test(path)
    )
      return "archive";
  } catch {
    return;
  }
}

export function allowedStockUrl(value: string) {
  return stockUrlSource(value) !== undefined;
}
