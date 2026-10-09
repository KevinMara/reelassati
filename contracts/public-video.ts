export const PUBLIC_VIDEO_MAX_BYTES = 256 * 1024 * 1024;
export const PUBLIC_VIDEO_TIMEOUT_MS = 120_000;
export const PUBLIC_VIDEO_MAX_SECONDS = 120;
export const DIRECT_VIDEO_HELP = "Use the final HTTPS MP4, MOV or WebM file URL with browser download access. Social pages, redirects and protected links need the original video uploaded instead.";

/** WHATWG canonicalization also catches integer/hex/shortened IPv4 spellings. */
export function validateDirectVideoUrl(value: string): string | null {
  if (!value.trim()) return "Enter a direct HTTPS video file URL.";
  if (value.length > 4000) return "The video URL is too long.";
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443"))
      return "Use an HTTPS video URL without credentials or custom ports.";
    // Domain-only addresses avoid IPv4/IPv6 literal tricks and private network hosts.
    if (host.includes(":") || /^[\d.]+$/.test(host) || !host.includes(".") ||
      ["localhost", "local", "internal", "test", "invalid", "example", "home", "lan"].some(suffix => host === suffix || host.endsWith(`.${suffix}`)))
      return "Use a public video host, not a local or numeric network address.";
    if (["youtube.com", "youtu.be", "tiktok.com", "instagram.com", "facebook.com", "fb.watch", "x.com", "twitter.com"].some(domain => host === domain || host.endsWith(`.${domain}`)))
      return "Social video pages are unsupported. Upload the original video you are authorized to use.";
    if (!/\.(mp4|mov|webm)$/i.test(url.pathname))
      return "Use the final MP4, MOV or WebM file URL. Upload the original for a webpage or redirect link.";
    return null;
  } catch {
    return "Enter a valid direct HTTPS video URL.";
  }
}

export function directVideoType(bytes: Uint8Array): "video/mp4" | "video/quicktime" | "video/webm" | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    const text = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 4096)));
    return text.includes("webm") ? "video/webm" : null;
  }
  if (String.fromCharCode(...bytes.subarray(4, 8)) !== "ftyp") return null;
  const brand = String.fromCharCode(...bytes.subarray(8, 12));
  if (brand === "qt  ") return "video/quicktime";
  // An ISO audio-only m4a signature is not a video source.
  if (["M4A ", "M4B ", "M4P ", "F4A ", "F4B "].includes(brand)) return null;
  return /^(isom|iso[2-9]|mp4[12]|avc1|M4V |dash|MSNV|3gp[456])$/.test(brand) ? "video/mp4" : null;
}
