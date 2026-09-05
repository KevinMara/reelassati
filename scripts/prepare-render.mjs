import { build } from "esbuild";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
await mkdir("public/vendor/render", { recursive: true });
await copyFile(
  "node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js",
  "public/vendor/render/core.js"
);
// Compressed binary stays below the host's individual static asset limit.
await writeFile(
  "public/vendor/render/core.bin",
  gzipSync(
    await readFile("node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm")
  )
);

await build({
  entryPoints: ["node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js"],
  outfile: "public/vendor/render/worker.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  minify: true,
});
