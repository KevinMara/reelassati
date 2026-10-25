import {
  allowedStockUrl,
  stockUrlSource,
  type StockKind,
  type StockMedia,
} from "../contracts/stock-media";

const MAX_MEDIA_BYTES = 40 * 1024 * 1024;
const COMMONS_ID = /^[1-9]\d{0,13}$/;
const OPENVERSE_ID =
  /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const plain = (value: unknown, maxLength = 350) =>
  String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(
      /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
      (entity, code: string) => {
        const named: Record<string, string> = {
          amp: "&",
          lt: "<",
          gt: ">",
          quot: '"',
          apos: "'",
          nbsp: " ",
        };
        if (!code.startsWith("#")) return named[code.toLowerCase()] ?? entity;
        const point =
          code[1].toLowerCase() === "x"
            ? parseInt(code.slice(2), 16)
            : Number(code.slice(1));
        return point > 0 &&
          point <= 0x10ffff &&
          !(point >= 0xd800 && point <= 0xdfff)
          ? String.fromCodePoint(point)
          : entity;
      }
    )
    .replace(/\p{Cc}/gu, " ")
    .trim()
    .slice(0, maxLength);
const positive = (value: unknown) => {
  const number =
    typeof value === "number" || typeof value === "string"
      ? Number(value)
      : NaN;
  return Number.isFinite(number) && number > 0 ? number : undefined;
};
const link = (value: unknown, fallback = "") => {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port
      ? url.href
      : fallback;
  } catch {
    return fallback;
  }
};
const thumbnail = (value: unknown) =>
  typeof value === "string" && allowedStockUrl(value) ? value : undefined;
const supportedMime = (kind: StockKind, type: string) =>
  ({
    image: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
    video: ["video/mp4", "video/webm", "video/ogg"],
    audio: [
      "audio/mpeg",
      "audio/mp3",
      "audio/mp4",
      "audio/ogg",
      "audio/wav",
      "audio/x-wav",
      "audio/wave",
      "audio/flac",
      "audio/x-flac",
      "audio/webm",
    ],
  })[kind].includes(type);

async function readBytes(
  response: Response,
  limit: number,
  signal: AbortSignal
) {
  if (!response.body)
    throw new Error("The stock provider returned an empty response.");
  if (Number(response.headers.get("content-length")) > limit) {
    await response.body.cancel();
    throw new Error("The stock response is too large.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    for (;;) {
      signal.throwIfAborted();
      const part = await reader.read();
      signal.throwIfAborted();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) throw new Error("The stock response is too large.");
      chunks.push(new Uint8Array(part.value));
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  if (!size) throw new Error("The stock file is empty.");
  return chunks;
}

async function read(url: URL, signal: AbortSignal) {
  signal.throwIfAborted();
  const response = await fetch(url, {
    signal,
    redirect: "error",
    headers: {
      "User-Agent": "REELassati/1.0 (on-demand media search)",
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("The stock provider is unavailable. Try again later.");
  }
  const chunks = await readBytes(response, 2 * 1024 * 1024, signal);
  return record(JSON.parse(await new Blob(chunks).text()));
}

function licenseLink(value: unknown, license: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(String(value));
  } catch {
    return;
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.port
  )
    return;
  if (
    !["creativecommons.org", "www.creativecommons.org"].includes(
      parsed.hostname
    )
  )
    return;
  const by =
    /^CC BY (1\.0|2\.0|2\.5|3\.0|4\.0)(?: ([a-z]{2}(?:-[a-z]+)?))?$/i.exec(
      license
    );
  const expected = by
    ? `/licenses/by/${by[1]}/${by[2] ? `${by[2].toLowerCase()}/` : ""}`
    : /^CC0(?: 1\.0)?$/i.test(license)
      ? "/publicdomain/zero/1.0/"
      : "";
  if (
    !expected ||
    !(
      parsed.pathname === expected ||
      parsed.pathname === expected.slice(0, -1) ||
      parsed.pathname.startsWith(`${expected}deed`)
    )
  )
    return;
  return `https://creativecommons.org${expected}`;
}

function commonsItem(
  page: Record<string, unknown>,
  kind: StockKind
): StockMedia | undefined {
  const info = record(
    Array.isArray(page.imageinfo) ? page.imageinfo[0] : undefined
  );
  const meta = record(info.extmetadata);
  const id = String(page.pageid);
  const license = plain(record(meta.LicenseShortName).value);
  const creator = plain(record(meta.Artist).value);
  const isPublicDomain = /^Public domain$/i.test(license);
  const licenseUrl = isPublicDomain
    ? "https://commons.wikimedia.org/wiki/Commons:Public_domain"
    : licenseLink(record(meta.LicenseUrl).value, license);
  if (
    !COMMONS_ID.test(id) ||
    !licenseUrl ||
    (/^CC BY/i.test(license) && !creator) ||
    typeof info.url !== "string" ||
    stockUrlSource(info.url) !== "commons" ||
    (positive(info.size) ?? 0) > MAX_MEDIA_BYTES ||
    !supportedMime(kind, String(info.mime))
  )
    return;
  return {
    id,
    provider: "commons",
    kind,
    title: plain(page.title).replace(/^File:/, ""),
    creator: creator || "Unknown creator",
    attribution: plain(record(meta.Attribution).value, 2000) || undefined,
    source: `https://commons.wikimedia.org/?curid=${id}`,
    license,
    licenseUrl,
    url: info.url,
    thumbnail: thumbnail(info.thumburl),
    duration: positive(info.duration),
    width: positive(info.width),
    height: positive(info.height),
  };
}

function openverseItem(raw: unknown): StockMedia | undefined {
  const item = record(raw);
  const id = String(item.id);
  const license =
    `${item.license === "cc0" ? "CC0" : "CC BY"} ${item.license_version ?? ""}`.trim();
  const licenseUrl = licenseLink(item.license_url, license);
  const creator = plain(item.creator);
  if (
    !OPENVERSE_ID.test(id) ||
    !["cc0", "by"].includes(String(item.license)) ||
    !licenseUrl ||
    (item.license === "by" && !creator) ||
    typeof item.url !== "string" ||
    !allowedStockUrl(item.url) ||
    (positive(item.filesize) ?? 0) > MAX_MEDIA_BYTES ||
    item.category === "pronunciation"
  )
    return;
  return {
    id,
    provider: "openverse",
    kind: "audio",
    title: plain(item.title),
    creator: creator || "Unknown creator",
    attribution: plain(item.attribution, 2000) || undefined,
    source: link(item.foreign_landing_url, `https://openverse.org/audio/${id}`),
    license,
    licenseUrl,
    url: item.url,
    thumbnail: thumbnail(item.thumbnail),
    duration: positive(item.duration)
      ? positive(item.duration)! / 1000
      : undefined,
  };
}

export async function searchStock(
  kind: StockKind,
  query: string,
  signal: AbortSignal
): Promise<StockMedia[]> {
  if (kind === "audio") {
    const url = new URL("https://api.openverse.org/v1/audio/");
    url.search = new URLSearchParams({
      q: query.slice(0, 150),
      license: "cc0,by",
      page_size: "20",
    }).toString();
    const data = await read(url, signal);
    return (
      Array.isArray(data.results) ? data.results.slice(0, 20) : []
    ).flatMap(row => {
      const item = openverseItem(row);
      return item ? [item] : [];
    });
  }
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: `${query.slice(0, 150)} filetype:${kind === "video" ? "video" : "bitmap"}`,
    gsrnamespace: "6",
    gsrlimit: "20",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "420",
  }).toString();
  const data = await read(url, signal);
  return Object.values(record(record(data.query).pages))
    .slice(0, 20)
    .flatMap(page => {
      const item = commonsItem(record(page), kind);
      return item ? [item] : [];
    });
}

/** Re-fetch provider-owned metadata. The client never chooses a download URL. */
export async function resolveStock(
  provider: string,
  id: string,
  kind: StockKind,
  signal: AbortSignal
): Promise<StockMedia> {
  let result: StockMedia | undefined;
  if (typeof provider !== "string" || typeof id !== "string")
    throw new Error("This media no longer has an eligible source or license.");
  if (provider === "commons" && COMMONS_ID.test(id)) {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.search = new URLSearchParams({
      action: "query",
      format: "json",
      pageids: id,
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      iiurlwidth: "420",
    }).toString();
    const data = await read(url, signal);
    result = commonsItem(record(record(record(data.query).pages)[id]), kind);
  } else if (
    provider === "openverse" &&
    OPENVERSE_ID.test(id) &&
    kind === "audio"
  ) {
    result = openverseItem(
      await read(new URL(`https://api.openverse.org/v1/audio/${id}/`), signal)
    );
  }
  if (!result || result.id.toLowerCase() !== id.toLowerCase())
    throw new Error("This media no longer has an eligible source or license.");
  return result;
}

export async function downloadStock(item: StockMedia, signal: AbortSignal) {
  let url = item.url;
  const source = stockUrlSource(url);
  for (let redirects = 0; redirects <= 3; redirects++) {
    signal.throwIfAborted();
    if (!source || stockUrlSource(url) !== source)
      throw new Error("Unsupported stock download host or path.");
    const response = await fetch(url, { signal, redirect: "manual" });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || redirects === 3)
        throw new Error("The stock provider returned an invalid redirect.");
      url = new URL(location, url).href;
      continue;
    }
    const type =
      response.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() ?? "";
    if (!response.ok || !supportedMime(item.kind, type)) {
      await response.body?.cancel();
      throw new Error("The provider did not return playable media.");
    }
    return new Blob(await readBytes(response, MAX_MEDIA_BYTES, signal), {
      type,
    });
  }
  throw new Error("The stock provider returned an invalid redirect.");
}
