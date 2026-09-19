import { it, expect } from "vitest";
import { createRequire } from "node:module";
import { build } from "esbuild";

/** Exercise the actual Workers R2 binding, not a Node mock: ordinary streams do
 * not carry the runtime's fixed-length brand, even when all bytes are known. */
it("saves a chunked generated-video stream through actual workerd R2 multipart storage", async () => {
  const require = createRequire(import.meta.url);
  const fromWrangler = createRequire(require.resolve("wrangler"));
  const { Miniflare } = await import(fromWrangler.resolve("miniflare"));
  const compiled = await build({
    stdin: {
      contents: `
        import {storeMediaParts,mp4Marker,inspectMp4Stream,hashMediaStream} from "./sites/media-streams";
        export default {async fetch(request,env){
          const bytes=Uint8Array.from({length:170013},(_,i)=>i%251);
          const make=()=>new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=71)c.enqueue(bytes.slice(i,i+71));c.close();}});
          let oldError="";
          try {await env.BUCKET.put("old.mp4",make());} catch(e){oldError=e.message;}
          const marker=mp4Marker("0123456789abcdef_generated_video");
          const upload=await env.BUCKET.createMultipartUpload("saved.mp4",{httpMetadata:{contentType:"video/mp4"}});
          const saved=await storeMediaParts(upload,make(),{partSize:5*1024*1024,maxBytes:10*1024*1024,suffix:marker});
          const object=await env.BUCKET.get("saved.mp4");
          const verified=await inspectMp4Stream(object.body);
          return Response.json({oldError,size:saved.size,storedSize:object.size,token:verified.marker?.token,fingerprint:verified.fingerprint,originalHash:await hashMediaStream(make())});
        }};
      `,
      resolveDir: process.cwd(),
      sourcefile: "media-r2-regression.ts",
      loader: "ts",
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
  });
  const runtime = new Miniflare({
    modules: true,
    script: compiled.outputFiles[0].text,
    compatibilityDate: "2026-05-01",
    r2Buckets: ["BUCKET"],
  });
  try {
    const response = await runtime.dispatchFetch("http://media.test/");
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.oldError).toContain("known length");
    expect(result.size).toBe(result.storedSize);
    expect(result.size).toBeGreaterThan(170013);
    expect(result.token).toBe("0123456789abcdef_generated_video");
    expect(result.fingerprint).toBe(result.originalHash);
  } finally {
    await runtime.dispose();
  }
}, 30000);
