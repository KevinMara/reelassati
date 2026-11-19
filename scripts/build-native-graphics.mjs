import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import {
  adaptAdobeProject,
  adobeMainComposition,
} from "./lib/native-adobe-adapter.mjs";
import { nativeGraphicDesign } from "./lib/native-graphic-design.mjs";

// The archive corpus is supplied explicitly; rebuilding never downloads private
// source files or invokes a model. Only graphs with a clean pixel/asset report
// are eligible. Render/control evidence is a separate admission requirement.
const [corpus, binding] = process.argv.slice(2);
if (!corpus || !binding)
  throw Error(
    "Usage: node scripts/build-native-graphics.mjs CORPUS COMPOSITOR_BINDING"
  );
const { NativeCompositor } = createRequire(import.meta.url)(
  path.resolve(binding)
);
const root = process.cwd(),
  base = path.resolve(corpus),
  out = path.join(root, "public/native-graphics");
const engine = new NativeCompositor(),
  fonts = JSON.parse(
    await fs.readFile("public/fonts/editor-fonts.json", "utf8")
  ).faces;
for (const font of fonts)
  engine.add_font(await fs.readFile(path.join(root, "public", font.url)));
const rows = JSON.parse(
  await fs.readFile(path.join(base, "current-import-reports.json"), "utf8")
);
const candidates = rows.filter(
  r =>
    r.report &&
    r.report.losses.every(l => l.category === "markers") &&
    !r.report.missingFonts.length &&
    !r.report.missingFootage.length
);
await fs.mkdir(out, { recursive: true });
const manifest = [],
  evidence = [];
const seconds = t => t / 254016000000;
const hash = b => createHash("sha256").update(b).digest("hex");
const color = v =>
  "#" +
  v
    .slice(0, 3)
    .map(n =>
      Math.round(n * 255)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")
    .toUpperCase();
const titleNames = {
  "01": "Rising word",
  "03": "Split two-line",
  "04": "Stacked outline",
  "05": "Scrolling outline",
  "07": "Split stack",
  "08": "Two-line reveal",
};
for (const row of candidates) {
  const source = await fs.readFile(path.join(base, "..", row.url));
  if (hash(source) !== row.sha256) throw Error("Source digest changed");
  engine.load_aep(source, true);
  const { project, repairs } = adaptAdobeProject(
    JSON.parse(engine.project_json())
  );
  if (Object.values(project.items).some(item => item.kind.type === "Footage"))
    throw Error("External footage requires a verified runtime asset binding");
  const definition = JSON.parse(
    await fs.readFile(path.join(base, "..", row.definition), "utf8")
  );
  const main = adobeMainComposition(project, definition),
    controls = [],
    requiredFonts = new Set();
  const visit = (comp, layer, group) => {
    for (const p of group.children ?? []) {
      if (p.node === "Group") {
        visit(comp, layer, p);
        continue;
      }
      if (p.value?.t === "Text") {
        requiredFonts.add(p.value.v.font);
        if (p.expr?.enabled || p.keys?.length)
          throw Error("Source text is not statically editable");
        controls.push({
          key: `text-${controls.filter(x => x.type === "text").length + 1}`,
          type: "text",
          label: layer.name,
          comp: comp.id,
          layer: layer.id,
          property: p.uid,
          default: p.value.v.text,
          font: p.value.v.font,
          fontSize: p.value.v.size,
          justify: p.value.v.justify,
        });
      } else if (
        layer.name === "CONTROLLER" &&
        group.match === "ec.control.color" &&
        !p.expr?.enabled &&
        !p.keys?.length
      ) {
        controls.push({
          key: `color-${p.uid}`,
          type: "color",
          label: group.name,
          comp: comp.id,
          layer: layer.id,
          property: p.uid,
          default: color(p.value.v),
        });
      } else if (
        layer.name === "CONTROLLER" &&
        group.match === "ec.control.slider" &&
        !p.expr?.enabled &&
        !p.keys?.length
      ) {
        const exposed = definition.clientControls.find(c =>
          c.uiName?.strDB.some(s => s.str === group.name)
        );
        controls.push({
          key: `number-${p.uid}`,
          type: "number",
          label: group.name,
          comp: comp.id,
          layer: layer.id,
          property: p.uid,
          default: p.value.v,
          min: exposed?.min ?? -500,
          max: exposed?.max ?? 500,
        });
      }
    }
  };
  for (const c of Object.values(project.items).filter(
    c => c.kind.type === "Comp"
  ))
    for (const l of c.kind.layers) visit(c, l, l.props);
  const textControls = controls.filter(c => c.type === "text");
  if (!textControls.length || textControls.length > 4)
    throw Error("Unsupported text control count");
  if (textControls.length > 2) {
    if (
      main.name !== "Modern Text Animation 08" ||
      textControls.map(c => c.justify).join(",") !== "Right,Left,Right,Left"
    )
      throw Error("Unreviewed split text arrangement");
    textControls.forEach((c, i) => {
      c.textSlot = Math.floor(i / 2);
      c.part = i % 2 ? "right" : "left";
    });
  } else
    textControls.forEach((c, i) => {
      c.textSlot = i;
    });
  const fontFiles = [...requiredFonts].map(name => {
    const f = fonts.find(f => f.postscript === name);
    if (!f) throw Error("Missing exact font " + name);
    return { url: f.url, sha256: f.sha256 };
  });
  const regions = main.kind.markers
    .filter(m => m.duration > 0)
    .sort((a, b) => a.time - b.time);
  const duration = seconds(main.kind.duration);
  const cuePairs = Object.values(project.items)
    .filter(
      c => c.kind.type === "Comp" && c.kind.duration === main.kind.duration
    )
    .flatMap(c => c.kind.layers.map(l => l.markers ?? []))
    .filter(
      markers =>
        markers.length === 2 &&
        markers[0].comment.toLowerCase() === "in" &&
        markers[1].comment.toLowerCase() === "out"
    );
  if ((regions.length !== 2 || regions[0].time !== 0) && cuePairs.length !== 1)
    throw Error("Missing authored entrance/exit regions: " + main.name);
  const enter = seconds(
      regions.length === 2 ? regions[0].duration : cuePairs[0][0].time
    ),
    exit = seconds(
      regions.length === 2 ? regions[1].time : cuePairs[0][1].time
    );
  if (!(enter > 0 && exit > enter && exit < duration))
    throw Error("Invalid authored regions");
  engine.load_project(JSON.stringify(project));
  const scale = 480 / main.kind.width,
    w = 480,
    h = Math.round(main.kind.height * scale),
    holdTime = (enter + exit) / 2;
  const frame = engine.render(main.id, holdTime, scale);
  let left = w,
    top = h,
    right = -1,
    bottom = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (frame[(y * w + x) * 4 + 3] > 16) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  if (right < left || bottom < top) throw Error("Empty settled graphic");
  const editHashes = [];
  for (const c of controls) {
    engine.load_project(JSON.stringify(project));
    if (c.type === "text")
      engine.set_text(
        c.comp,
        c.layer,
        c.property,
        c.default === "world" ? "EDIT" : "REEL"
      );
    else
      engine.set_control(
        c.comp,
        c.layer,
        c.property,
        JSON.stringify(
          c.type === "color"
            ? { t: "Color", v: [0.23, 0.74, 0.58, 1] }
            : { t: "Scalar", v: Math.min(c.max, c.default + 100) }
        )
      );
    const edited = engine.render(main.id, holdTime, scale),
      saved = engine.project_json();
    engine.load_project(saved);
    const reloaded = engine.render(main.id, holdTime, scale);
    if (!Buffer.from(edited).equals(Buffer.from(reloaded)))
      throw Error("Control changed during save/reload");
    editHashes.push({
      key: c.key,
      changed: hash(edited) !== hash(frame),
      sha256: hash(edited),
      reload: true,
    });
  }
  // Do not offer dead controls. A dormant secondary box control can still be
  // preserved in the source graph without misleading the user with a slider.
  const liveControls = controls.filter(
    c => editHashes.find(e => e.key === c.key)?.changed
  );
  if (textControls.some(c => !liveControls.includes(c)))
    throw Error("Text control does not change settled pixels");
  engine.load_project(JSON.stringify(project));
  const frameHashes = [];
  for (const t of [0.2, enter / 2, enter, holdTime, exit, duration - 0.2])
    frameHashes.push({
      time: t,
      sha256: hash(engine.render(main.id, t, scale)),
    });
  const id = `motion-${row.sha256.slice(0, 12)}`,
    title = /Modern Text Animation (\d+)/.exec(main.name),
    social = /^([LR])\d+(.+)$/.exec(main.name);
  if (!title && !social) throw Error("Unreviewed template identity");
  if (social?.[2] === "Twiter") social[2] = "X";
  const name = title
    ? titleNames[title[1]]
    : `${social[2]} handle · ${social[1] === "L" ? "left" : "right"}`;
  const description = title
    ? "Editable bold kinetic title with authored text animation and a transparent background. Keep the copy short."
    : `Animated ${social[2]} icon and handle bar. Use only for an actual supplied ${social[2]} handle or an explicit promotion request.`;
  const payload = Buffer.from(JSON.stringify({ project, main: main.id })),
    compressed = gzipSync(payload, { level: 9 });
  await fs.writeFile(path.join(out, `${id}.bin`), compressed);
  manifest.push({
    id,
    name,
    description,
    design: nativeGraphicDesign(name, social?.[2]),
    category: title ? "title" : "social",
    ...(social ? { platform: social[2] } : {}),
    url: `/native-graphics/${id}.bin`,
    sha256: hash(payload),
    sourceSha256: row.sha256,
    compWidth: main.kind.width,
    compHeight: main.kind.height,
    duration,
    entranceEnd: enter,
    exitStart: exit,
    staticHold:
      frameHashes[2].sha256 === frameHashes[3].sha256 &&
      frameHashes[3].sha256 === frameHashes[4].sha256,
    bounds: {
      x: left / w,
      y: top / h,
      width: (right - left + 1) / w,
      height: (bottom - top + 1) / h,
    },
    fonts: fontFiles,
    controls: liveControls,
  });
  evidence.push({
    id,
    source: row.source,
    repairs,
    controls: editHashes,
    frames: frameHashes,
  });
  console.log(
    "Verified",
    manifest.length,
    id,
    name,
    liveControls.length + " live controls"
  );
}
engine.free();
await fs.writeFile(
  "contracts/native-graphics-data.json",
  JSON.stringify(manifest, null, 2) + "\n"
);
await fs.writeFile(
  path.join(base, "conversion-evidence.json"),
  JSON.stringify(evidence, null, 2)
);
