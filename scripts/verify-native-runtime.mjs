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
  const png = await fs.readFile(`public/native-graphics/${t.id}.png`);
  if (
    png.length < 33 ||
    png.readUInt32BE(0) !== 0x89504e47 ||
    png.readUInt32BE(16) !== 240 ||
    png.readUInt32BE(20) !== 135
  )
    throw Error("Invalid native preview: " + t.id);
  const source = gunzipSync(await fs.readFile("public" + t.url));
  if (hash(source) !== t.sha256) throw Error("Changed native graph: " + t.id);
  for (const f of t.fonts)
    if (hash(await fs.readFile("public" + f.url)) !== f.sha256)
      throw Error("Changed template font: " + f.url);
}
console.log(`Verified compositor and ${templates.length} graph/font bundles`);
const mattes = Object.values(JSON.parse(await fs.readFile("contracts/native-matte-data.json", "utf8")));
const verifiedSheets = new Set();
for (const matte of mattes) {
  if (matte.sheets.length !== Math.ceil(matte.frames / (matte.columns * matte.rows)))
    throw Error("Incomplete authored mask clock: " + matte.sourceName);
  for (const digest of matte.sheets) {
    if (verifiedSheets.has(digest)) continue;
    if (!/^[a-f0-9]{64}$/.test(digest)) throw Error("Invalid mask sheet digest");
    const sheet = await fs.readFile(`public/native-mattes/${digest}.png`);
    if (hash(sheet) !== digest || sheet.readUInt32BE(16) !== matte.width * matte.columns ||
        sheet.readUInt32BE(20) !== matte.height * matte.rows)
      throw Error("Invalid authored mask sheet: " + matte.sourceName);
    verifiedSheets.add(digest);
  }
}
console.log(`Verified ${mattes.length} authored masks and ${verifiedSheets.size} lossless sheets`);
