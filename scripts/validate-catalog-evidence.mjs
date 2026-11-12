import { build } from "esbuild";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const [manifestPath, evidencePath] = process.argv.slice(2);
if (!manifestPath || !evidencePath)
  throw new Error("Pass the catalog manifest and evidence directory.");
const compiled = await build({
  stdin: {
    contents:
      "export { normalizeCatalogEvidence } from './contracts/catalog-evidence'; export { verifyEvidenceBlobs } from './sites/catalog-evidence';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const { normalizeCatalogEvidence, verifyEvidenceBlobs } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const items = new Map(manifest.items.map(item => [item.id, item]));
const files = (await readdir(evidencePath)).filter(name =>
  /^stock-[a-f0-9]{24}\.json$/.test(name)
);
const failures = [],
  kinds = {};
for (const file of files) {
  try {
    const value = JSON.parse(
      await readFile(resolve(evidencePath, file), "utf8")
    );
    const item = items.get(value.catalogId);
    if (!item || file !== `${item.id}.json`)
      throw new Error("Unknown catalog identity.");
    const packet = normalizeCatalogEvidence(value, item);
    verifyEvidenceBlobs(packet);
    kinds[packet.kind] = (kinds[packet.kind] || 0) + 1;
  } catch (error) {
    failures.push({ file, error: error.message });
  }
}
process.stdout.write(
  JSON.stringify(
    {
      catalog: items.size,
      present: files.length,
      valid: files.length - failures.length,
      kinds,
      failures,
    },
    null,
    2
  ) + "\n"
);
if (failures.length) process.exitCode = 1;
