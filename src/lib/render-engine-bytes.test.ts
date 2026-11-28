import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { afterEach, expect, it, vi } from "vitest";
import { renderEngineBytes } from "./render-engine-bytes";

afterEach(() => vi.unstubAllGlobals());

it("recovers a truncated response body and retries only a corrupt part", async () => {
  const chunks = ["WASM header", "rest of module"].map(text => Buffer.from(text));
  const parts = chunks.map(chunk => ({
    size: chunk.length, hash: createHash("sha256").update(chunk).digest("hex"),
  }));
  const compressed = (input: Buffer) => new Response(new Uint8Array(input));
  const fetch = vi.fn(async (url: string, options: RequestInit) => {
    if (url.endsWith("/core.bin")) return compressed(gzipSync(chunks[0]).subarray(0, 9));
    if (url.endsWith(".json")) return Response.json({ parts });
    const index = parts.findIndex(part => url.endsWith(part.hash + ".bin"));
    if (index === 1 && options.cache !== "reload")
      return compressed(gzipSync(Buffer.alloc(parts[index].size)));
    return compressed(gzipSync(chunks[index]));
  });
  vi.stubGlobal("fetch", fetch);
  const result = await renderEngineBytes(new AbortController().signal);
  expect(Buffer.from(await result.arrayBuffer())).toEqual(Buffer.concat(chunks));
  expect(fetch.mock.calls.filter(([url]) => url.includes(parts[0].hash))).toHaveLength(1);
  expect(fetch.mock.calls.filter(([url]) => url.includes(parts[1].hash))).toHaveLength(2);
});

it("stops recovery when the export is canceled", async () => {
  const abort = new AbortController();
  const fetch = vi.fn(async () => {
    abort.abort();
    throw new TypeError("Failed to fetch");
  });
  vi.stubGlobal("fetch", fetch);
  await expect(renderEngineBytes(abort.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(fetch).toHaveBeenCalledOnce();
});
