import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const { NativeCompositor } = createRequire(import.meta.url)(
  path.resolve(process.argv[2])
);
const engine = new NativeCompositor(),
  fonts = new Set();
for (const t of JSON.parse(
  await fs.readFile("contracts/native-graphics-data.json", "utf8")
)) {
  for (const f of t.fonts)
    if (!fonts.has(f.url)) {
      engine.add_font(await fs.readFile("public" + f.url));
      fonts.add(f.url);
    }
  const scene = JSON.parse(
    gunzipSync(await fs.readFile("public" + t.url)).toString()
  );
  engine.load_project(JSON.stringify(scene.project));
  const width = 480,
    height = Math.round((t.compHeight / t.compWidth) * width),
    pixels = engine.render(
      scene.main,
      (t.entranceEnd + t.exitStart) / 2,
      width / t.compWidth
    );
  const box = t.bounds,
    x = Math.round(box.x * width),
    y = Math.round(box.y * height),
    w = Math.round(box.width * width),
    h = Math.round(box.height * height);
  const encoded = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "rawvideo",
      "-pixel_format",
      "rgba",
      "-video_size",
      `${width}x${height}`,
      "-i",
      "pipe:0",
      "-vf",
      `crop=${w}:${h}:${x}:${y},scale=216:111:force_original_aspect_ratio=decrease,pad=240:135:(ow-iw)/2:(oh-ih)/2:color=black@0`,
      "-frames:v",
      "1",
      `public/native-graphics/${t.id}.png`,
    ],
    { input: pixels, maxBuffer: 1000000, windowsHide: true }
  );
  if (encoded.status !== 0) throw Error(encoded.stderr.toString());
}
engine.free();
console.log("42 native previews rendered");
