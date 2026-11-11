import { build } from "esbuild";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, sep } from "node:path";

const roots = process.argv.slice(2);
if (!roots.length) throw new Error("Pass one or more prepared catalog folders.");
const compiled = await build({ entryPoints: ["contracts/shared-media-catalog.ts"], bundle: true, write: false, platform: "node", format: "esm" });
const { normalizeSharedCatalogItem } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
for (const folder of roots) {
  const root = resolve(folder);
  const manifest = JSON.parse(await readFile(resolve(root, "catalog.json"), "utf8"));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.items) || Object.keys(manifest).some(key => !["schemaVersion", "items"].includes(key))) throw new Error("Invalid manifest.");
  const ids = new Set(), designs = new Set(), objects = new Map(), kinds = {};
  for (const raw of manifest.items) {
    const item = normalizeSharedCatalogItem(raw);
    if (ids.has(item.id)) throw new Error(`Duplicate catalog ID: ${item.id}`);
    ids.add(item.id); designs.add(item.designId); kinds[item.kind] = (kinds[item.kind] || 0) + 1;
    for (const object of [item.media, item.poster].filter(Boolean)) {
      const previous = objects.get(object.file);
      if (previous && JSON.stringify(previous) !== JSON.stringify(object)) throw new Error("Conflicting object metadata.");
      objects.set(object.file, object);
    }
  }
  let bytes = 0;
  for (const object of objects.values()) {
    const path = resolve(root, object.file);
    if (!path.startsWith(root + sep) || (await stat(path)).size !== object.bytes) throw new Error(`File size/path mismatch: ${object.file}`);
    const hash = createHash("sha256"); for await (const chunk of createReadStream(path)) hash.update(chunk);
    if (hash.digest("hex") !== object.sha256) throw new Error(`Digest mismatch: ${object.file}`);
    bytes += object.bytes;
  }
  process.stdout.write(JSON.stringify({ folder: root, items: ids.size, designs: designs.size, objects: objects.size, bytes, kinds, localVerified: true, uploaded: false }) + "\n");
}
