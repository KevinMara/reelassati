import {
  socialVideoSource,
  SOCIAL_VIDEO_UNAVAILABLE,
  type SocialVideoProvider,
} from "../contracts/social-video";
import { PUBLIC_VIDEO_MAX_BYTES } from "../contracts/public-video";

const CDN: Record<SocialVideoProvider, string[]> = {
  instagram: ["cdninstagram.com", "fbcdn.net"],
  facebook: ["fbcdn.net"],
  tiktok: [
    "tiktokcdn.com",
    "tiktokcdn-us.com",
    "tiktokcdn-eu.com",
    "tiktokv.com",
    "byteoversea.com",
    "ibytedtos.com",
  ],
  youtube: ["googlevideo.com"],
  x: ["video.twimg.com"],
};
export function allowedSocialMediaUrl(
  value: string,
  provider: SocialVideoProvider
) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      CDN[provider].some(
        domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`)
      )
    );
  } catch {
    return false;
  }
}

function decodeHtml(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, dec) => {
      const code = parseInt(hex ?? dec, hex ? 16 : 10);
      return code <= 0x10ffff ? String.fromCodePoint(code) : "";
    });
}

/** Extract only published media fields. Never execute page scripts or decipher protected URLs. */
export function socialMediaCandidates(
  html: string,
  provider: SocialVideoProvider
): string[] {
  const found = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value !== "string") return;
    const url = decodeHtml(value);
    if (allowedSocialMediaUrl(url, provider)) found.add(url);
  };
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = Object.fromEntries(
      [...tag[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)].map(m => [
        m[1].toLowerCase(),
        decodeHtml(m[3]),
      ])
    );
    if (
      /^(og:video(?::url|:secure_url)?|twitter:player:stream)$/.test(
        attrs.property ?? attrs.name ?? ""
      )
    )
      add(attrs.content);
  }
  for (const match of html.matchAll(
    /"(?:video_url|contentUrl|playAddr|downloadAddr|browser_native_hd_url|browser_native_sd_url)"\s*:\s*("(?:\\.|[^"\\])*")/g
  )) {
    try {
      add(JSON.parse(match[1]));
    } catch {
      /* Not a JSON string. */
    }
  }
  // TikTok and YouTube publish progressive sources in JSON script elements.
  let visited = 0;
  function walk(value: unknown, depth = 0) {
    if (!value || typeof value !== "object" || depth > 24 || ++visited > 30000)
      return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    const row = value as Record<string, unknown>;
    if (
      typeof row.mimeType === "string" &&
      /^video\/mp4/.test(row.mimeType) &&
      row.audioQuality
    )
      add(row.url);
    for (const [key, item] of Object.entries(row)) {
      if (
        [
          "video_url",
          "contentUrl",
          "playAddr",
          "downloadAddr",
          "browser_native_hd_url",
          "browser_native_sd_url",
        ].includes(key)
      ) {
        add(item);
        if (item && typeof item === "object") {
          const list = (item as { UrlList?: unknown }).UrlList;
          if (Array.isArray(list)) list.forEach(add);
        }
      }
      walk(item, depth + 1);
    }
  }
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(script[1]));
    } catch {
      /* Non-data scripts are never evaluated. */
    }
    // Instagram's public embed passes an escaped JSON string to its loader.
    // Parse literal data only; do not run the surrounding JavaScript.
    for (const literal of script[1].matchAll(/"(?:\\.|[^"\\])*"/g)) {
      if (!literal[0].startsWith('"{\\"')) continue;
      try {
        walk(JSON.parse(JSON.parse(literal[0])));
      } catch {
        /* Not JSON data. */
      }
    }
  }
  return [...found].slice(0, 4);
}

async function boundedText(response: Response, maxBytes: number) {
  if (!response.body) throw new Error(SOCIAL_VIDEO_UNAVAILABLE);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0,
    text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error(SOCIAL_VIDEO_UNAVAILABLE);
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function fetchSocialVideo(
  value: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch
): Promise<Response> {
  const source = socialVideoSource(value);
  if (!source) throw new Error(SOCIAL_VIDEO_UNAVAILABLE);
  let pageUrl = source.url;
  // The public Instagram player includes the downloadable source without requiring a session.
  if (source.provider === "instagram")
    pageUrl = `${new URL(source.url).origin}${new URL(source.url).pathname.replace(/\/$/, "")}/embed/`;
  let html = "";
  for (let redirects = 0; redirects <= 3; redirects++) {
    signal.throwIfAborted();
    const response = await fetcher(pageUrl, {
      redirect: "manual",
      signal,
      headers: { Accept: "text/html" },
    });
    if (response.status >= 300 && response.status < 400) {
      const next = new URL(response.headers.get("location") ?? "", pageUrl)
        .href;
      await response.body?.cancel();
      if (socialVideoSource(next)?.provider !== source.provider)
        throw new Error(SOCIAL_VIDEO_UNAVAILABLE);
      pageUrl = next;
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(SOCIAL_VIDEO_UNAVAILABLE);
    }
    html = await boundedText(response, 4 * 1024 * 1024);
    break;
  }
  const candidates = socialMediaCandidates(html, source.provider);
  for (const candidate of candidates) {
    let mediaUrl = candidate;
    for (let redirects = 0; redirects <= 3; redirects++) {
      signal.throwIfAborted();
      if (!allowedSocialMediaUrl(mediaUrl, source.provider)) break;
      const response = await fetcher(mediaUrl, { redirect: "manual", signal });
      if (response.status >= 300 && response.status < 400) {
        mediaUrl = new URL(response.headers.get("location") ?? "", mediaUrl)
          .href;
        await response.body?.cancel();
        continue;
      }
      const type = response.headers.get("content-type")?.split(";")[0] ?? "";
      if (
        !response.ok ||
        !response.body ||
        ![
          "video/mp4",
          "video/webm",
          "video/quicktime",
          "application/octet-stream",
        ].includes(type) ||
        Number(response.headers.get("content-length")) > PUBLIC_VIDEO_MAX_BYTES
      ) {
        await response.body?.cancel();
        break;
      }
      let bytes = 0;
      const body = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            bytes += chunk.byteLength;
            if (bytes > PUBLIC_VIDEO_MAX_BYTES)
              throw new Error(SOCIAL_VIDEO_UNAVAILABLE);
            controller.enqueue(chunk);
          },
        })
      );
      return new Response(body, {
        headers: {
          "Content-Type": type,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
  }
  throw new Error(SOCIAL_VIDEO_UNAVAILABLE);
}
