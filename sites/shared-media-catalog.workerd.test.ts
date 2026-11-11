import { expect, it } from "vitest";
import { createRequire } from "node:module";
import { build } from "esbuild";

it("verifies catalog uploads and copies through native Workers R2 and D1", async () => {
  const require = createRequire(import.meta.url);
  const fromWrangler = createRequire(require.resolve("wrangler"));
  const { Miniflare } = await import(fromWrangler.resolve("miniflare"));
  const compiled = await build({
    stdin: {
      contents: `
        import {handleCatalogAdmin,handleCatalogPublic,copySharedCatalogMedia} from "./sites/shared-media-catalog";
        import {sha256} from "@noble/hashes/sha2.js";
        import {bytesToHex} from "@noble/hashes/utils.js";
        export default {async fetch(request,env){
          const chunkSize=16*1024*1024;
          const bytes=Uint8Array.from({length:chunkSize+51},(_,i)=>i%251);
          const digest=bytesToHex(sha256(bytes));
          const item={id:'stock-'+digest.slice(0,24),name:'Verified overlay',group:'Film frames',designId:'design-film-frame',variant:'1080p',kind:'video',tags:['film','frame'],duration:1,width:1920,height:1080,blendMode:'screen',media:{file:'media/'+digest+'.mp4',sha256:digest,bytes:bytes.length,contentType:'video/mp4'},license:'platform-licensed',credits:0};
          const poster=new Uint8Array([1,2,3]);const posterHash=bytesToHex(sha256(poster));
          item.poster={file:'media/'+posterHash+'.png',sha256:posterHash,bytes:poster.length,contentType:'image/png'};
          const admin=async(path,method='GET',body)=>{
            const req=new Request('https://catalog.test/api/catalog/admin/'+path,{method,...(body?{body}:{})});
            try{return await handleCatalogAdmin(req,env,new URL(req.url),true);}catch(e){if(e instanceof Response)return e;throw e;}
          };
          let oldError='';
          try{await env.BUCKET.put('old',new Blob([bytes]).stream().pipeThrough(new TransformStream()));}catch(e){oldError=e.message;}
          const staged=await admin('manifest','POST',JSON.stringify({schemaVersion:1,items:[item]}));
          if(!staged.ok) return staged;
          const bad=bytes.slice();bad[42]^=1;
          const rejected=await admin('object/'+item.id+'/media','PUT',bad);
          const before=await(await admin('status?ids='+item.id)).json();
          const part0=await admin('object/'+item.id+'/media/chunks/0','PUT',bytes.slice(0,chunkSize));
          const part1=await admin('object/'+item.id+'/media/chunks/1','PUT',bytes.slice(chunkSize));
          if(!part0.ok) return part0;if(!part1.ok)return part1;
          const uploaded=await admin('object/'+item.id+'/media/complete','POST');
          if(!uploaded.ok) return uploaded;
          const posted=await admin('object/'+item.id+'/poster','PUT',poster);
          if(!posted.ok) return posted;
          const after=await(await admin('status?ids='+item.id)).json();
          const mediaRequest=new Request('https://catalog.test/api/catalog/media/'+item.id+'/media',{headers:{Range:'bytes=42-104'}});
          const served=await handleCatalogPublic(mediaRequest,env,new URL(mediaRequest.url));
          const servedBytes=new Uint8Array(await served.arrayBuffer());
          await copySharedCatalogMedia(env,item.id,'private-copy',new AbortController().signal);
          const copy=await env.BUCKET.get('private-copy');
          const copyBytes=new Uint8Array(await copy.arrayBuffer());
          const pending=await env.BUCKET.list({prefix:'shared-catalog-pending/'});
          const parts=await env.BUCKET.list({prefix:'shared-catalog-parts/'});
          return Response.json({oldError,staged:staged.status,rejected:rejected.status,before:before.items[0].status,uploaded:uploaded.status,after:after.items[0].status,rangeStatus:served.status,range:Array.from(servedBytes),copyHash:bytesToHex(sha256(copyBytes)),expectedHash:digest,pending:pending.objects.length,parts:parts.objects.length});
        }};
      `,
      resolveDir: process.cwd(),
      sourcefile: "catalog-r2-regression.ts",
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
    d1Databases: ["DB"],
  });
  try {
    const response = await runtime.dispatchFetch("https://catalog.test/");
    expect(
      response.status,
      response.status === 200 ? undefined : await response.text()
    ).toBe(200);
    const result = await response.json();
    expect(result.oldError).toContain("known length");
    expect(result.staged).toBe(200);
    expect(result.rejected).toBe(422);
    expect(result.before).toBe("pending");
    expect(result.uploaded).toBe(200);
    expect(result.after).toBe("ready");
    expect(result.rangeStatus).toBe(206);
    expect(result.range).toEqual(Array.from({ length: 63 }, (_, i) => i + 42));
    expect(result.copyHash).toBe(result.expectedHash);
    expect(result.pending).toBe(0);
    expect(result.parts).toBe(0);
  } finally {
    await runtime.dispose();
  }
}, 30000);
