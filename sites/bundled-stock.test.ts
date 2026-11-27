import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { build } from "esbuild";
import release from "./bundled-stock.json";
import {
  CATALOG_CHUNK_BYTES,
  normalizeSharedCatalogItem,
} from "../contracts/shared-media-catalog";
import { normalizeCatalogEvidence } from "../contracts/catalog-evidence";
import {
  normalizeCatalogVisual,
  verifyEvidenceBlobs,
} from "./catalog-evidence";

it("ships complete verified objects and a frame-grounded review for every included item", async () => {
  for (const record of release) {
    const item = normalizeSharedCatalogItem(record.item);
    const packet = normalizeCatalogEvidence(
      JSON.parse(
        await readFile(
          "public/stock-release/" + item.media.sha256 + ".json",
          "utf8"
        )
      ),
      item
    );
    verifyEvidenceBlobs(packet);
    expect(normalizeCatalogVisual(record.visual, packet).sampleSha256).toBe(
      packet.visual!.sha256
    );
    for (const obj of [item.media, item.poster!]) {
      const hash = createHash("sha256");
      for (let i = 0; i * CATALOG_CHUNK_BYTES < obj.bytes; i++) {
        const part = await readFile(
          "public/stock-release/" + obj.sha256 + "." + i + ".bin"
        );
        expect(part.length).toBe(
          Math.min(CATALOG_CHUNK_BYTES, obj.bytes - i * CATALOG_CHUNK_BYTES)
        );
        hash.update(part);
      }
      expect(hash.digest("hex")).toBe(obj.sha256);
    }
  }
}, 60000);

it("finds an included image by its content, copies it into a project and reuses the verified R2 bytes", async () => {
  const require = createRequire(import.meta.url);
  const wrangler = createRequire(require.resolve("wrangler"));
  const { Miniflare } = await import(wrangler.resolve("miniflare"));
  const worker = await build({
    bundle: true,
    write: false,
    format: "esm",
    stdin: {
      resolveDir: process.cwd(),
      contents: `
    import {handleCatalogPublic,copySharedCatalogMedia} from "./sites/shared-media-catalog";
    import {catalogVisualEvidence} from "./sites/catalog-visual-evidence";
    export default {async fetch(req,env) {
      const url=new URL(req.url);
      if(url.pathname==="/copy"){
        const item=await copySharedCatalogMedia(env,url.searchParams.get("id"),"project/test",req.signal);
        const proof=await catalogVisualEvidence(env,[item],req.signal);
        return Response.json({bytes:(await env.BUCKET.get("project/test")).size, evidence:proof.parts.filter(part=>part.type==="text")});
      }
      return handleCatalogPublic(req,env,url);
    }}
  `,
    },
  });
  const requests: string[] = [];
  const runtime = new Miniflare({
    modules: true,
    script: worker.outputFiles[0].text,
    compatibilityDate: "2026-05-01",
    r2Buckets: ["BUCKET"],
    d1Databases: ["DB"],
    serviceBindings: {
      ASSETS: async (request: Request) => {
        const path = new URL(request.url).pathname;
        requests.push(path);
        const data = await readFile("public" + path);
        return new Response(new Uint8Array(data));
      },
    },
  });
  try {
    const { items } = await (
      await runtime.dispatchFetch(
        "https://studio.test/api/catalog/search?q=antlered+deer"
      )
    ).json();
    expect(items).toHaveLength(1);
    const item = items[0],
      path = "https://studio.test/api/catalog/media/" + item.id + "/media";
    const first = await runtime.dispatchFetch(path, {
      headers: { Range: "bytes=3-17" },
    });
    expect(first.status).toBe(206);
    const original = await readFile(
      "public/stock-release/" + item.media.sha256 + ".0.bin"
    );
    expect(Buffer.from(await first.arrayBuffer())).toEqual(
      original.subarray(3, 18)
    );
    const copied = await (
      await runtime.dispatchFetch("https://studio.test/copy?id=" + item.id)
    ).json();
    expect(copied.bytes).toBe(original.length);
    expect(JSON.stringify(copied.evidence)).toContain(
      "A lone deer faces the camera"
    );
    expect(requests.filter(path => path.endsWith(".bin"))).toHaveLength(1);
    expect(requests.some(path => path.endsWith(".json"))).toBe(true);
  } finally {
    await runtime.dispose();
  }
}, 60000);
