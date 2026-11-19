import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
const hash = b => createHash("sha256").update(b).digest("hex");
const base = "public/vendor/native-graphics",
  manifest = JSON.parse(await fs.readFile(`${base}/manifest.json`, "utf8"));
for (const [file, digest, compressed] of [
  ["native/compositor/src/lib.rs", manifest.sourceSha256, false],
  [`${base}/compositor.js`, manifest.jsSha256, false],
  [`${base}/compositor.bin`, manifest.wasmSha256, true],
]) {
  const data = await fs.readFile(file);
  if (hash(compressed ? gunzipSync(data) : data) !== digest)
    throw Error("Native renderer build is stale: " + file);
}
const templates = JSON.parse(
  await fs.readFile("contracts/native-graphics-data.json", "utf8")
);
for (const t of templates) {
  const source = gunzipSync(await fs.readFile("public" + t.url));
  if (hash(source) !== t.sha256) throw Error("Changed native graph: " + t.id);
  for (const f of t.fonts)
    if (hash(await fs.readFile("public" + f.url)) !== f.sha256)
      throw Error("Changed template font: " + f.url);
}
console.log(`Verified compositor and ${templates.length} graph/font bundles`);
