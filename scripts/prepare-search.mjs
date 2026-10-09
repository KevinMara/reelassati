import { createRequire } from "node:module";
import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const transformersRoot = path.resolve(
  path.dirname(require.resolve("@huggingface/transformers")),
  ".."
);
const transformersRequire = createRequire(
  path.join(transformersRoot, "package.json")
);
const ortRoot = path.resolve(
  path.dirname(transformersRequire.resolve("onnxruntime-web")),
  ".."
);
const output = path.join(root, "public/vendor/search/ort");
const ortPackage = JSON.parse(
  await readFile(path.join(ortRoot, "package.json"), "utf8")
);
const transformersPackage = JSON.parse(
  await readFile(path.join(transformersRoot, "package.json"), "utf8")
);
await mkdir(output, { recursive: true });
await cp(
  path.join(transformersRoot, "dist/transformers.web.min.js"),
  path.join(root, "public/vendor/search/transformers.js")
);
// Transformers' browser runtime uses the JSEP factory even with the WASM
// execution provider. Copy only that factory and binary; never an entire dist.
const files = [
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
];
const manifest = [];
for (const file of files) {
  const source = path.join(ortRoot, "dist", file);
  const bytes = (await stat(source)).size;
  if (bytes >= 25 * 1024 * 1024)
    throw new Error(
      `Local inference runtime exceeds static asset limit: ${file}`
    );
  await cp(source, path.join(output, file));
  manifest.push({
    file,
    bytes,
    sha256: createHash("sha256")
      .update(await readFile(source))
      .digest("hex"),
  });
}
await cp(
  path.join(root, "public/vendor/search/ORT-LICENSE.txt"),
  path.join(output, "LICENSE.txt")
);
await cp(
  path.join(transformersRoot, "LICENSE"),
  path.join(output, "Transformers-LICENSE.txt")
);
await writeFile(
  path.join(output, "version.json"),
  JSON.stringify(
    {
      transformers: transformersPackage.version,
      onnxruntime: ortPackage.version,
      files: manifest,
    },
    null,
    2
  ) + "\n"
);
console.log(
  `Prepared local inference runtime (${transformersPackage.version}; one WASM thread).`
);
