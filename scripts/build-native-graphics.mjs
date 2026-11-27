import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import fontSubstitutions from "../contracts/native-font-substitutions.json" with { type: "json" };
import {
  adaptAdobeProject,
  adobeMainComposition,
} from "./lib/native-adobe-adapter.mjs";
import { labelPhoneAlertFields, nativeGraphicDesign } from "./lib/native-graphic-design.mjs";
import { restorePhoneFills } from "./lib/native-adobe-fill.mjs";
import {
  controlOnlyAdobeReport,
  verifyAdobeControlGroups,
  applyNotificationDefaults,
  adobeStrictExpressionProbe,
} from "./lib/native-adobe-controls.mjs";

// The archive corpus is supplied explicitly; rebuilding never downloads private
// source files or invokes a model. Only graphs with a clean pixel/asset report
// are eligible. Render/control evidence is a separate admission requirement.
const [corpus, binding, ...sourceDigests] = process.argv.slice(2);
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
// Same family, weight and slant under the PostScript names emitted by the
// official variable-font static instances. Preserve this mapping as provenance;
// it is not a claim about the version used by the original template author.
const fontAliases = {
  ...fontSubstitutions,
  "MontserratRoman-Black": "Montserrat-Black",
  "Montserrat-BlackItalic": "MontserratItalic-BlackItalic",
  "Montserrat-ExtraBoldItalic": "MontserratItalic-ExtraBoldItalic",
};
for (const name of Object.values(fontAliases))
  if (!fonts.some(f => f.postscript === name))
    throw Error("Unavailable font alias target " + name);
const candidates = rows.filter(r =>
  controlOnlyAdobeReport(r.report, fontAliases)
);
await fs.mkdir(out, { recursive: true });
const existing = JSON.parse(
  await fs.readFile("contracts/native-graphics-data.json", "utf8")
);
const selected = sourceDigests.length
  ? candidates.filter(r => sourceDigests.includes(r.sha256))
  : candidates;
if (sourceDigests.length && selected.length !== new Set(sourceDigests).size)
  throw Error("Selected source is missing or ineligible");
const keep = id =>
  !selected.some(r => id === "motion-" + r.sha256.slice(0, 12));
const manifest = sourceDigests.length ? existing.filter(t => keep(t.id)) : existing.filter(t => t.presentation === "poster");
const evidence = sourceDigests.length
  ? JSON.parse(
      await fs.readFile(path.join(base, "conversion-evidence.json"), "utf8")
    ).filter(t => keep(t.id))
  : [];
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
  "06": "Three-line cascade",
  "07": "Split stack",
  "08": "Two-line reveal",
};
const excluded = sourceDigests.length
  ? JSON.parse(
      await fs.readFile(path.join(base, "conversion-exclusions.json"), "utf8")
    ).filter(r => !sourceDigests.includes(r.sourceSha256))
  : [];
const previouslyShipped = new Set(
  JSON.parse(
    await fs.readFile("contracts/native-graphics-data.json", "utf8")
  ).map(t => t.sourceSha256)
);
for (const row of selected) {
  try {
    const source = await fs.readFile(path.join(base, "..", row.url));
    if (hash(source) !== row.sha256) throw Error("Source digest changed");
    engine.load_aep(source, true);
    const aliases = [];
    for (const original of row.report.missingFonts) {
      const replacement = fontAliases[original];
      const changed = engine.apply_font_alias(original, replacement);
      if (!changed) throw Error("Unresolved font declaration " + original);
      aliases.push({
        kind: Object.hasOwn(fontSubstitutions, original) ? "font-substitution" : "font-postscript-alias",
        original,
        replacement,
        changed,
      });
    }
    const { project, repairs } = adaptAdobeProject(
      JSON.parse(engine.project_json())
    );
    const controlGroups = verifyAdobeControlGroups(project);
    if (controlGroups.length !== row.report.imported.placeholderEffects)
      throw Error("A placeholder operation has no verified control group");
    repairs.push(...aliases);
    if (Object.values(project.items).some(item => item.kind.type === "Footage"))
      throw Error("External footage requires a verified runtime asset binding");
    const definition = JSON.parse(
      await fs.readFile(path.join(base, "..", row.definition), "utf8")
    );
    const main = adobeMainComposition(project, definition),
      controls = [],
      requiredFonts = new Set(),
      derived = new Set();
    repairs.push(...applyNotificationDefaults(main, definition));
    const phoneRepairs = restorePhoneFills(main, source);
    repairs.push(...phoneRepairs);
    const visit = (comp, layer, group) => {
      for (const p of group.children ?? []) {
        if (p.node === "Group") {
          visit(comp, layer, p);
          continue;
        }
        if (p.value?.t === "Text") {
          requiredFonts.add(p.value.v.font);
          if (p.expr?.enabled && !p.keys?.length) {
            const expr = p.expr.text.replace(/"[^"\\]*"|\s+/g, part => part.startsWith('"') ? part : "");
            const source = {
              'Math.round(thisComp.layer("Control Layer").effect("Calendar Icon Control")(2))':
                "Calendar Icon Control · Number",
              'Math.round(thisComp.layer("Control Layer").effect("Bell Control")(3))':
                "Bell Control · Number Count",
              'idx=thisComp.layer("Control Layer").effect("Calendar Icon Control")(1);words=["MON","TUE","WED","THU","FRI","SAT","SUN"]words[idx-1]':
                "Calendar Icon Control · Day",
            }[expr];
            if (source) {
              derived.add(source);
              continue;
            }
          }
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
            allCaps: !!p.value.v.all_caps,
          });
        } else if (
          group.kind?.effect?.startsWith("Pseudo/") &&
          !p.expr?.enabled &&
          !p.keys?.length
        ) {
          const common = {
            comp: comp.id,
            layer: layer.id,
            property: p.uid,
            label: `${group.name} · ${p.name}`,
            displayLabel: `${group.name.replace(/ Control$/, "")} · ${p.name}`,
          };
          if (p.value.t === "Color")
            controls.push({
              ...common,
              key: `color-${p.uid}`,
              type: "color",
              default: color(p.value.v),
              sourceTextColor: /^Text ([A-E]) Color$/.exec(p.name)?.[1],
            });
          else if (p.value.t === "Scalar")
            controls.push({
              ...common,
              key: `number-${p.uid}`,
              type: "number",
              default: p.value.v,
              min: p.ui?.slider_min ?? p.ui?.min ?? -500,
              max: p.ui?.slider_max ?? p.ui?.max ?? 500,
            });
          else if (p.value.t === "Vec2")
            for (const component of [0, 1])
              controls.push({
                ...common,
                key: `point-${p.uid}-${component}`,
                type: "number",
                displayLabel: `${common.displayLabel} ${component ? "Y" : "X"}`,
                default: p.value.v[component],
                component,
                vector: p.value.v,
                min: -Math.max(main.kind.width, main.kind.height) * 2,
                max: Math.max(main.kind.width, main.kind.height) * 2,
              });
          else if (p.value.t === "Bool" || p.value.t === "Enum")
            controls.push({
              ...common,
              key: `number-${p.uid}`,
              type: "number",
              valueType: p.value.t,
              default: Number(p.value.v),
              min: 0,
              max: p.value.t === "Bool" ? 1 : p.ui.options.length - 1,
              ...(p.value.t === "Enum" ? { options: p.ui.options } : {}),
            });
          else throw Error("Unsupported native control type: " + p.value.t);
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
    if (!textControls.length || textControls.length > 8)
      throw Error("Unsupported text control count");
    if (main.name === "Modern Text Animation 08") {
      if (
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
    if (
      (regions.length !== 2 || regions[0].time !== 0) &&
      cuePairs.length !== 1
    )
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
    // Exercise entrance as well as the settled frame: elastic controls can be
    // meaningful only while the graphic is moving.
    const controlTime = phoneRepairs.find(r => r.kind === "source-fill-compositing-opacity")?.keys[1] ?? enter / 2;
    const controlScale = Math.min(scale, 240 / main.kind.width);
    const controlHold = hash(engine.render(main.id, holdTime, controlScale));
    const motionFrame = engine.render(main.id, controlTime, controlScale);
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
              : c.component !== undefined
                ? {
                    t: "Vec2",
                    v: c.vector.map((v, i) => (i === c.component ? v + 40 : v)),
                  }
                : c.valueType === "Bool"
                  ? { t: "Bool", v: !c.default }
                  : c.valueType === "Enum"
                    ? { t: "Enum", v: (c.default + 1) % c.options.length }
                    : {
                        t: "Scalar",
                        v:
                          c.default < c.max
                            ? Math.min(
                                c.max,
                                c.default + Math.max(1, (c.max - c.min) * 0.1)
                              )
                            : Math.max(
                                c.min,
                                c.default - Math.max(1, (c.max - c.min) * 0.1)
                              ),
                      }
          )
        );
      const saved = engine.project_json();
      engine.load_project(saved);
      if (engine.project_json() !== saved)
        throw Error("Control changed during save/reload");
      const edited = engine.render(main.id, holdTime, controlScale);
      const changed =
        hash(edited) !== controlHold ||
        hash(engine.render(main.id, controlTime, controlScale)) !== hash(motionFrame);
      editHashes.push({
        key: c.key,
        changed,
        sha256: hash(edited),
        reload: true,
      });
    }
    // Do not offer dead controls. A dormant secondary box control can still be
    // preserved in the source graph without misleading the user with a slider.
    const liveControls = controls.filter(
      c => editHashes.find(e => e.key === c.key)?.changed
    );
    if (
      !controlGroups.length &&
      textControls.some(c => !liveControls.includes(c))
    )
      throw Error("Text control does not change settled pixels");
    const liveTexts = liveControls.filter(c => c.type === "text");
    for (const label of derived) {
      const c = liveControls.find(
        c => c.label === label && c.type === "number"
      );
      if (!c)
        throw Error(
          "Displayed expression has no working source control: " + label
        );
      c.displayedValue = true;
    }
    if (!liveTexts.length) throw Error("No editable text is visible");
    if (main.name !== "Modern Text Animation 08")
      liveTexts.forEach((c, i) => {
        c.textSlot = i;
      });
    for (const c of liveControls)
      if (c.sourceTextColor) {
        const text = liveTexts.find(
          t => t.label === `Text ${c.sourceTextColor}`
        );
        if (text) c.colorSlot = text.textSlot;
        delete c.sourceTextColor;
      }
    for (const c of liveControls)
      if (c.type === "color" && !c.displayLabel) {
        const index = /^Text 0([1-4])/.exec(c.label)?.[1];
        if (index) {
          c.colorSlot = textControls[Number(index) - 1]?.textSlot;
          if (c.colorSlot >= 2)
            c.displayLabel = `Text ${c.colorSlot + 1} color`;
        }
      }
    engine.load_project(JSON.stringify(project));
    const frameHashes = [];
    for (const t of [0.2, enter / 2, enter, holdTime, exit, duration - 0.2])
      frameHashes.push({
        time: t,
        sha256: hash(engine.render(main.id, t, scale)),
      });
    const strictProbe = adobeStrictExpressionProbe(project);
    if (controlGroups.length) {
      engine.load_project(JSON.stringify(strictProbe.project));
      for (const f of frameHashes)
        if (hash(engine.render(main.id, f.time, scale)) !== f.sha256)
          throw Error(
            "An authored exception fallback hides a rendering failure"
          );
    }
    const id = `motion-${row.sha256.slice(0, 12)}`,
      title = /Modern Text Animation (\d+)/.exec(main.name),
      social = /^([LR])\d+(.+)$/.exec(main.name),
      notification =
        /^\[Interface\]\[Notifications\]\[(Social Media|Others|Phone)\] - (\d+)$/.exec(
          main.name
        );
    if (!title && !social && !notification)
      throw Error("Unreviewed template identity");
    if (social?.[2] === "Twiter") social[2] = "X";
    const name = title
      ? titleNames[title[1]]
      : social
        ? `${social[2]} ${liveTexts.length > 1 ? "profile" : "handle"} · ${social[1] === "L" ? "left" : "right"}`
        : `${notification[1] === "Phone" ? "Phone alert" : notification[1] === "Others" ? "Reminder card" : "Message card"} · ${notification[2]}`;
    labelPhoneAlertFields(name, liveControls);
    const description = title
      ? "Editable bold kinetic title with authored text animation and a transparent background. Keep the copy short."
      : social
        ? `Animated ${social[2]} icon and handle bar. Use only for an actual supplied ${social[2]} handle or an explicit promotion request.`
        : "Editable animated notification card. Use for an explicit message, notification or app-interface demonstration with supplied copy. Never invent a real message, social reaction or system alert.";
    const payload = Buffer.from(JSON.stringify({ project, main: main.id })),
      compressed = gzipSync(payload, { level: 9 });
    await fs.writeFile(path.join(out, `${id}.bin`), compressed);
    manifest.push({
      id,
      name,
      description,
      design: nativeGraphicDesign(name, social?.[2]),
      category: title ? "title" : social ? "social" : "notification",
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
      controlGroups,
      strictExpressionProbe: strictProbe.changed,
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
  } catch (error) {
    excluded.push({
      sourceSha256: row.sha256,
      source: row.source,
      error: String(error),
    });
    console.error("Not admitted", row.sha256.slice(0, 12), String(error));
    if (previouslyShipped.has(row.sha256)) throw error;
  }
}
engine.free();
await fs.writeFile(
  "contracts/native-graphics-data.json",
  JSON.stringify(manifest, null, 2) + "\n"
);
await fs.writeFile(
  path.join(base, "conversion-exclusions.json"),
  JSON.stringify(excluded, null, 2) + "\n"
);
await fs.writeFile(
  path.join(base, "conversion-evidence.json"),
  JSON.stringify(evidence, null, 2)
);
