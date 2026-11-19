import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
const [bindings] = process.argv.slice(2);
if (!bindings) throw Error("Supply the wasm-bindgen web output directory");
const hash = b => createHash("sha256").update(b).digest("hex");
const source = await fs.readFile("native/compositor/src/lib.rs");
const wasm = await fs.readFile(
  path.join(bindings, "reel_native_compositor_bg.wasm")
);
const js = await fs.readFile(path.join(bindings, "reel_native_compositor.js"));
const out = "public/vendor/native-graphics";
await fs.mkdir(out, { recursive: true });
await fs.writeFile(`${out}/compositor.js`, js);
await fs.writeFile(`${out}/compositor.bin`, gzipSync(wasm, { level: 9 }));
await fs.writeFile(
  `${out}/manifest.json`,
  JSON.stringify(
    {
      effectcraftCommit: "665bfac0b33904b1dcda6de889f43f43a94ad3f8",
      wasmBindgen: "0.2.129",
      sourceSha256: hash(source),
      jsSha256: hash(js),
      wasmSha256: hash(wasm),
      wasmBytes: wasm.length,
    },
    null,
    2
  ) + "\n"
);
console.log("Packaged native compositor", wasm.length, "bytes");
