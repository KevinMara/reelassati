import { expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { build } from "esbuild";

it("uses an explicit cancel to close the actual Workers-to-provider HTTP connection and retain only cleanup", async () => {
  const require = createRequire(import.meta.url);
  const { Miniflare } = require(
    require.resolve("miniflare", { paths: [require.resolve("wrangler")] })
  );
  let providerCalls = 0;
  let canceled = false;
  const provider = createServer((_, response) => {
    providerCalls++;
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    response.write(": OPENROUTER PROCESSING\n\n");
    response.on("close", () => {
      canceled = true;
    });
  });
  await new Promise<void>(resolve => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  if (!address || typeof address === "string")
    throw new Error("Test provider address missing");
  let runtime: InstanceType<typeof Miniflare> | undefined;
  try {
    const compiled = await build({
      stdin: {
        contents: `
        import { foregroundAnalysisResponse, readAnalysisCompletion } from './sites/analyzer-request.ts';
        export default { async fetch(request,env,ctx) {
          if(new URL(request.url).pathname === '/cancel') { await env.STATE.put('cancel','true'); return Response.json({canceled:true}); }
          return foregroundAnalysisResponse(request, async (scoped,control) => {
            control.onAbort(() => env.STATE.put('released','true'));
            control.onCheck = async () => (await env.STATE.get('cancel')) !== 'true';
            const response = await fetch('http://127.0.0.1:${address.port}/completions', {signal:control.signal});
            await env.STATE.put('started','true');
            return Response.json(await readAnalysisCompletion(response,control.signal));
          }, cleanup => ctx.waitUntil(cleanup));
        }};`,
        resolveDir: process.cwd(),
        sourcefile: "analyzer-lifetime-test.ts",
        loader: "ts",
      },
      bundle: true,
      write: false,
      platform: "browser",
      format: "esm",
    });
    runtime = new Miniflare({
      modules: true,
      script: compiled.outputFiles[0].text,
      compatibilityDate: "2026-05-22",
      kvNamespaces: ["STATE"],
    });
    const state = await runtime.getKVNamespace("STATE");
    const url = await runtime.ready;
    const response = await fetch(url);
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      "pending"
    );
    await vi.waitFor(
      async () => expect(await state.get("started")).toBe("true"),
      { timeout: 5000 }
    );
    expect(
      (await fetch(new URL("/cancel", url), { method: "POST" })).status
    ).toBe(200);
    await vi.waitFor(() => expect(canceled).toBe(true), { timeout: 12000 });
    await vi.waitFor(async () =>
      expect(await state.get("released")).toBe("true")
    );
    expect(providerCalls).toBe(1);
    await reader.cancel();
  } finally {
    await runtime?.dispose();
    provider.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      provider.close(error => (error ? reject(error) : resolve()))
    );
  }
}, 25000);
