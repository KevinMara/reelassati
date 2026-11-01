export type SocialVideoProvider =
  "instagram" | "tiktok" | "facebook" | "youtube" | "x";

/** Only known public post routes; not profiles, arbitrary hosts or login pages. */
export function socialVideoSource(
  value: string
): { provider: SocialVideoProvider; url: string } | undefined {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return;
    const host = url.hostname.replace(/^www\./, "");
    let provider: SocialVideoProvider | undefined;
    if (
      host === "instagram.com" &&
      /^\/(?:p|reel|reels|tv)\/[\w-]+\/?$/.test(url.pathname)
    )
      provider = "instagram";
    if (
      ["tiktok.com", "m.tiktok.com"].includes(host) &&
      /^\/@[^/]+\/video\/\d+\/?$/.test(url.pathname)
    )
      provider = "tiktok";
    if (
      ["vm.tiktok.com", "vt.tiktok.com"].includes(host) &&
      /^\/[\w-]+\/?$/.test(url.pathname)
    )
      provider = "tiktok";
    if (
      ["facebook.com", "m.facebook.com"].includes(host) &&
      (/^\/(?:reel\/\d+|watch)\/?$/.test(url.pathname) ||
        /^\/[^/]+\/videos\/\d+\/?$/.test(url.pathname))
    )
      provider = "facebook";
    if (host === "youtu.be" && /^\/[\w-]{11}$/.test(url.pathname))
      provider = "youtube";
    if (
      ["youtube.com", "m.youtube.com"].includes(host) &&
      (/^\/(?:shorts|embed)\/[\w-]{11}\/?$/.test(url.pathname) ||
        (url.pathname === "/watch" &&
          /^[\w-]{11}$/.test(url.searchParams.get("v") ?? "")))
    )
      provider = "youtube";
    if (
      ["x.com", "twitter.com"].includes(host) &&
      /^\/[^/]+\/status\/\d+\/?$/.test(url.pathname)
    )
      provider = "x";
    if (!provider) return;
    url.hash = "";
    for (const key of [...url.searchParams.keys()])
      if (key !== "v") url.searchParams.delete(key);
    return { provider, url: url.href };
  } catch {
    return;
  }
}

export const SOCIAL_VIDEO_UNAVAILABLE =
  "This video isn't available right now. Try another link or upload the file.";
