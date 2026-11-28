import fs from "node:fs";
import { sampleMotionCurve } from "./motion-curves.mjs";

const { paths, frames, fps } = JSON.parse(fs.readFileSync(0, "utf8"));
const samples = paths.map(path =>
  Array.from({ length: frames }, (_, i) =>
    ["X", "Y", "Z"].map(axis => sampleMotionCurve(path[axis], i / fps))
  )
);
process.stdout.write(JSON.stringify(samples));
