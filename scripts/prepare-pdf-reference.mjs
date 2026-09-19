import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const packageRoot = path.dirname(require.resolve("pdfjs-dist/package.json"));
const output = path.join(projectRoot, "public/vendor/pdfjs");
const manifest = JSON.parse(
  await readFile(path.join(packageRoot, "package.json"), "utf8")
);
await mkdir(output, { recursive: true });
for (const directory of ["cmaps", "standard_fonts"]) {
  await cp(path.join(packageRoot, directory), path.join(output, directory), {
    recursive: true,
  });
}
await cp(path.join(packageRoot, "LICENSE"), path.join(output, "LICENSE"));
await writeFile(
  path.join(output, "version.json"),
  JSON.stringify({ package: "pdfjs-dist", version: manifest.version }) + "\n"
);
console.log(`Prepared local PDF text resources (${manifest.version}).`);
