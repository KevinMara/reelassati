export type StockKind = "image" | "video" | "audio";
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
): "commons" | "freesound" | "archive" | undefined {
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
