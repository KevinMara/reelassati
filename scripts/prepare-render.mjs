import "./prepare-pdf-reference.mjs";
import "./prepare-search.mjs";
import "./verify-native-runtime.mjs";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
await mkdir("public/vendor/render", { recursive: true });
await copyFile(
  "node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js",
  "public/vendor/render/core.js"
);
// Compressed binary stays below the host's individual static asset limit.
const wasm = await readFile("node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm");
await writeFile("public/vendor/render/core.bin", gzipSync(wasm));
// Each recovery part is independently decompressible. A dropped connection
// cannot invalidate megabytes already fetched for the same engine version.
const partSize = 2 * 1024 * 1024;
const parts = [];
for (let start = 0; start < wasm.length; start += partSize) {
  const bytes = wasm.subarray(start, start + partSize);
  const hash = createHash("sha256").update(bytes).digest("hex");
  parts.push({ hash, size: bytes.length });
  await writeFile(`public/vendor/render/${hash}.bin`, gzipSync(bytes));
}
await writeFile("public/vendor/render/core-parts.json", JSON.stringify({ parts }));

await build({
  entryPoints: ["node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js"],
  outfile: "public/vendor/render/worker.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  minify: true,
});
