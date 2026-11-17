import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { parseFusionSetting } from "./lib/fusion-setting.mjs";
import { compileFusionFrameProgram } from "./lib/fusion-frame-program.mjs";

const [input, output, frameCount = "180", frameRate = "30"] =
  process.argv.slice(2);
if (!input || !output || resolve(input) === resolve(output)) {
  throw new Error(
    "Usage: node scripts/compile-fusion-setting.mjs input.setting output.json [frames] [fps]. Output must differ from source."
  );
}
const bytes = await readFile(input);
const program = compileFusionFrameProgram(
  parseFusionSetting(bytes.toString("utf8")),
  {
    frames: Number(frameCount),
    fps: Number(frameRate),
  }
);
await writeFile(
  output,
  JSON.stringify(
    {
      ...program,
      sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    },
    null,
    2
  ) + "\n",
  { flag: "wx" }
);
console.log(
  JSON.stringify({
    output: resolve(output),
    nodes: program.nodes.length,
    frames: program.frames,
    admission: program.admission,
  })
);
