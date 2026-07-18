import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";

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
