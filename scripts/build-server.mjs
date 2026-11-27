import { build } from "esbuild";
import { access, copyFile, cp, mkdir, readdir, unlink } from "node:fs/promises";

await access("dist/client/index.html");

await mkdir("dist/server", { recursive: true });
await build({
  entryPoints: ["sites/server.ts"],
  platform: "browser",
  bundle: true,
  format: "esm",
  target: "es2022",
  outfile: "dist/server/index.js",
});

await mkdir("dist/.openai", { recursive: true });
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
await cp("drizzle", "dist/.openai/drizzle", { recursive: true });

// Vercel publishes the complete client build. The Sites Worker archive only
// needs the review packets and release marker beside its normal static assets.
const stockDirectory = new URL("../dist/client/stock-release/", import.meta.url);
for (const file of await readdir(stockDirectory)) {
  if (/^[0-9a-f]{64}\.\d+\.bin$/.test(file)) {
    await unlink(new URL(file, stockDirectory));
  }
}
