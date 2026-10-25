import { afterEach, describe, expect, it, vi } from "vitest";
import { allowedStockUrl } from "../contracts/stock-media";
import { downloadStock, resolveStock, searchStock } from "./stock-media";
import type { StockMedia } from "../contracts/stock-media";
import { editAttribution } from "../contracts/media-attribution";
import type { Asset, EditProject } from "../contracts/workspace";

const mediaUrl =
  "https://upload.wikimedia.org/wikipedia/commons/a/ab/Example.webm";
const audioId = "8624ba61-57f1-4f98-8a85-ece206c319cf";
const signal = () => AbortSignal.timeout(1000);
const commons = (
  overrides: Record<string, unknown> = {},
  metadata: Record<string, unknown> = {}
) => ({
  pageid: 1,
  title: "File:Illustration",
  imageinfo: [
    {
      mime: "image/jpeg",
      url: mediaUrl.replace("webm", "jpg"),
      size: 2000,
      width: 1920,
      height: 1080,
      extmetadata: {
        LicenseShortName: { value: "CC BY 4.0" },
        LicenseUrl: { value: "https://creativecommons.org/licenses/by/4.0/" },
        Artist: { value: "<a>Alice</a>" },
        ...metadata,
      },
      ...overrides,
    },
  ],
});
const openverse = (overrides: Record<string, unknown> = {}) => ({
  id: audioId,
  license: "by",
  license_version: "4.0",
  creator: "Alice",
  license_url: "https://creativecommons.org/licenses/by/4.0/",
  url: "https://cdn.freesound.org/previews/10/10001_100-hq.mp3",
  duration: 1200,
  title: "Sound",
  category: "sound_effect",
  ...overrides,
});
afterEach(() => vi.unstubAllGlobals());

describe("on-demand licensed stock", () => {
  it("accepts only known public media hosts and paths", () => {
    for (const url of [
      "http://upload.wikimedia.org/wikipedia/commons/a.jpg",
      "https://127.0.0.1/a",
      "https://upload.wikimedia.org.attacker.test/a",
      "https://secret@upload.wikimedia.org/wikipedia/commons/a.jpg",
      "https://upload.wikimedia.org:8443/wikipedia/commons/a.jpg",
      "https://other.upload.wikimedia.org/wikipedia/commons/a.jpg",
      "https://archive.org/services/search/v1/scrape",
      "https://private.archive.org/download/id/a.mp3",
      "https://freesound.org/apiv2/me/",
      "https://cdn.freesound.org/previews/1/%2e%2e%2fprivate",
    ])
      expect(allowedStockUrl(url), url).toBe(false);
    for (const url of [
      mediaUrl,
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Example.webm/500px-Example.jpg",
      "https://cdn.freesound.org/previews/10/10001_100-hq.mp3",
      "https://freesound.org/data/previews/10/10001_100-hq.mp3",
      "https://archive.org/download/recording/sound.mp3",
      "https://ia800405.us.archive.org/6/items/recording/sound.mp3",
    ])
      expect(allowedStockUrl(url), url).toBe(true);
  });

  it("filters restricted or inconsistent licenses and preserves creator characters", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          query: {
            pages: {
              1: commons(
                {},
                {
                  Artist: { value: "<a>Jo&#227;o &amp; Alice</a>" },
                  Attribution: { value: "Courtesy of <b>Alice's archive</b>" },
                }
              ),
              2: {
                ...commons(
                  {},
                  { LicenseShortName: { value: "All rights reserved" } }
                ),
                pageid: 2,
              },
              3: {
                ...commons(
                  {},
                  {
                    LicenseUrl: {
                      value: "https://creativecommons.org/licenses/by-nc/4.0/",
                    },
                  }
                ),
                pageid: 3,
              },
              4: { ...commons({}, { Artist: { value: "" } }), pageid: 4 },
            },
          },
        })
      )
    );
    const result = await searchStock("image", "brain", signal());
    expect(result).toHaveLength(1);
    expect(result[0].creator).toBe("João & Alice");
    expect(result[0].attribution).toBe("Courtesy of Alice's archive");
    const credits = editAttribution(
      {
        clips: [
          { assetId: "stock-asset" },
          { assetId: "stock-asset" },
        ] as EditProject["clips"],
      },
      [{ id: "stock-asset", stock: result[0] } as Asset]
    );
    expect(credits).toContain("Courtesy of Alice's archive");
    expect(credits.match(/João & Alice/g)).toHaveLength(1);
    expect(result[0].licenseUrl).toBe(
      "https://creativecommons.org/licenses/by/4.0/"
    );
    expect(result[0].source).toBe("https://commons.wikimedia.org/?curid=1");
  });

  it("accepts ported CC BY licenses and current Wikimedia thumbnails", async () => {
    const thumb =
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Example.webm/500px-Example.jpg";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          query: {
            pages: {
              1: commons(
                {
                  mime: "video/webm",
                  url: mediaUrl,
                  duration: 15.523,
                  thumburl: thumb,
                },
                {
                  LicenseShortName: { value: "CC BY 2.5 au" },
                  LicenseUrl: {
                    value:
                      "http://creativecommons.org/licenses/by/2.5/au/deed.en",
                  },
                }
              ),
            },
          },
        })
      )
    );
    const [item] = await searchStock("video", "rain", signal());
    expect(item).toMatchObject({
      duration: 15.523,
      thumbnail: thumb,
      licenseUrl: "https://creativecommons.org/licenses/by/2.5/au/",
    });
  });

  it("rejects unusable images and unsafe thumbnails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          query: {
            pages: {
              1: commons({
                thumburl: "https://127.0.0.1/private",
                width: -5,
                height: "Infinity",
              }),
              2: { ...commons({ mime: "image/svg+xml" }), pageid: 2 },
              3: {
                ...commons({ url: "https://archive.org/download/id/a.jpg" }),
                pageid: 3,
              },
            },
          },
        })
      )
    );
    const result = await searchStock("image", "illustration", signal());
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      thumbnail: undefined,
      width: undefined,
      height: undefined,
    });
  });

  it("revalidates opaque IDs without accepting a client download URL", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    for (const [provider, id, kind] of [
      ["commons", "https://attacker.test", "video"],
      ["commons", "0", "image"],
      ["openverse", "------------------------------------", "audio"],
    ] as const)
      await expect(resolveStock(provider, id, kind, signal())).rejects.toThrow(
        "eligible"
      );
    await expect(
      resolveStock("commons", 123 as unknown as string, "video", signal())
    ).rejects.toThrow("eligible");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("checks that a provider detail response still identifies the requested work", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(openverse({ id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }))
      )
    );
    await expect(
      resolveStock("openverse", audioId, "audio", signal())
    ).rejects.toThrow("eligible");
  });

  it("reads Openverse milliseconds as seconds and filters oversized audio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          results: [openverse(), openverse({ filesize: 41 * 1024 * 1024 })],
        })
      )
    );
    const items = await searchStock("audio", "click", signal());
    expect(items).toHaveLength(1);
    expect(items[0].duration).toBe(1.2);
  });

  it("checks redirects before following them, including other allowed providers", async () => {
    for (const location of [
      "https://127.0.0.1/secrets",
      "https://archive.org/download/id/other.webm",
    ]) {
      const fetcher = vi.fn(
        async () => new Response(null, { status: 302, headers: { location } })
      );
      vi.stubGlobal("fetch", fetcher);
      await expect(
        downloadStock({ url: mediaUrl, kind: "video" } as StockMedia, signal())
      ).rejects.toThrow("host");
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it("downloads valid archive redirects and preserves the actual MIME type", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location:
              "https://ia800405.us.archive.org/6/items/recording/sound.mp3",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "audio/mpeg; charset=binary" },
        })
      );
    vi.stubGlobal("fetch", fetcher);
    const blob = await downloadStock(
      {
        url: "https://archive.org/download/recording/sound.mp3",
        kind: "audio",
      } as StockMedia,
      signal()
    );
    expect(blob.size).toBe(3);
    expect(blob.type).toBe("audio/mpeg");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("bounds redirect loops and closes each response", async () => {
    const canceled = vi.fn();
    const fetcher = vi.fn(
      async () =>
        new Response(new ReadableStream({ cancel: canceled }), {
          status: 302,
          headers: { location: mediaUrl },
        })
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      downloadStock({ url: mediaUrl, kind: "video" } as StockMedia, signal())
    ).rejects.toThrow("redirect");
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(canceled).toHaveBeenCalledTimes(4);
  });

  it("closes unsupported responses and enforces the streaming size limit", async () => {
    const canceled = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new ReadableStream({ cancel: canceled }), {
            headers: { "content-type": "text/html" },
          })
      )
    );
    await expect(
      downloadStock({ url: mediaUrl, kind: "video" } as StockMedia, signal())
    ).rejects.toThrow("playable");
    expect(canceled).toHaveBeenCalledOnce();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array(41 * 1024 * 1024));
              },
              cancel: canceled,
            }),
            { headers: { "content-type": "video/webm" } }
          )
      )
    );
    await expect(
      downloadStock({ url: mediaUrl, kind: "video" } as StockMedia, signal())
    ).rejects.toThrow("large");
    expect(canceled).toHaveBeenCalledTimes(2);
  });

  it("bounds provider metadata and stops before issuing an aborted request", async () => {
    const canceled = vi.fn();
    const fetcher = vi.fn(
      async () =>
        new Response(new ReadableStream({ cancel: canceled }), {
          headers: { "content-length": String(3 * 1024 * 1024) },
        })
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(searchStock("image", "rain", signal())).rejects.toThrow(
      "large"
    );
    expect(canceled).toHaveBeenCalledOnce();
    const aborted = AbortSignal.abort();
    await expect(searchStock("image", "rain", aborted)).rejects.toThrow();
    await expect(
      downloadStock({ url: mediaUrl, kind: "video" } as StockMedia, aborted)
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
