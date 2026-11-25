import {
  graphicFrame,
  normalizeGraphic,
  type MotionGraphic,
} from "@contracts/motion-graphics";
import {
  nativeGraphicTemplate,
  nativeGraphicSourceTime,
  nativeTextValue,
} from "@contracts/native-graphics";

interface Engine {
  add_font(bytes: Uint8Array): number;
  load_project(json: string): void;
  set_fitted_text(
    comp: number,
    layer: number,
    property: number,
    text: string
  ): number;
  scale_text(
    comp: number,
    layer: number,
    property: number,
    scale: number
  ): void;
  set_control(
    comp: number,
    layer: number,
    property: number,
    value: string
  ): void;
  render(comp: number, time: number, scale: number): Uint8Array;
}
let engine: Engine | undefined,
  selected = "",
  main = 0;
let cachedFrame: { key: string; pixels: Uint8Array } | undefined;
const scenes = new Map<string, { project: unknown; main: number }>(),
  fonts = new Set<string>();
async function bytes(url: string, compressed = false, digest?: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.body)
    throw Error("The animation could not load. Try again.");
  const body = compressed
    ? response.body.pipeThrough(new DecompressionStream("gzip"))
    : response.body;
  const data = new Uint8Array(await new Response(body).arrayBuffer());
  if (data.length > 32_000_000) throw Error("Animation resource is too large");
  if (digest) {
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", data))
    )
      .map(n => n.toString(16).padStart(2, "0"))
      .join("");
    if (hash !== digest)
      throw Error("An animation resource changed. Reload the page.");
  }
  return data;
}
async function configure(g: MotionGraphic) {
  const template = nativeGraphicTemplate(g.native?.id);
  if (!template || !g.native) throw Error("Unknown motion template");
  if (!engine) {
    const url = new URL(
      "/vendor/native-graphics/compositor.js",
      self.location.origin
    ).href;
    const module = await import(/* @vite-ignore */ url);
    await module.default({
      module_or_path: await bytes(
        "/vendor/native-graphics/compositor.bin",
        true
      ),
    });
    engine = new module.NativeCompositor() as Engine;
  }
  for (const font of template.fonts)
    if (!fonts.has(font.sha256)) {
      engine.add_font(await bytes(font.url, false, font.sha256));
      fonts.add(font.sha256);
    }
  const key = JSON.stringify([
    g.native,
    g.text,
    g.secondaryText,
    g.color,
    g.accent,
  ]);
  if (selected === key) return template;
  if (!scenes.has(template.id)) {
    const parsed = JSON.parse(
      new TextDecoder().decode(await bytes(template.url, true, template.sha256))
    );
    scenes.set(template.id, parsed);
    if (scenes.size > 4) scenes.delete(scenes.keys().next().value!);
  }
  const scene = scenes.get(template.id)!;
  // Configuration can fail after a partially applied edit. A later request
  // for the previous graphic must reload its project and reapply its controls.
  selected = "";
  cachedFrame = undefined;
  engine.load_project(JSON.stringify(scene.project));
  main = scene.main;
  const fits = new Map<string, number>();
  const points = new Map<
    number,
    { control: (typeof template.controls)[number]; value: [number, number] }
  >();
  const paired = template.controls.some(c => c.type === "text" && c.part);
  for (const control of template.controls) {
    if (control.type === "text")
      fits.set(
        control.key,
        engine.set_fitted_text(
          control.comp,
          control.layer,
          control.property,
          nativeTextValue(control, g)
        )
      );
    else {
      const override = g.native.values[control.key];
      const legacySlot = /^Text 0([1-4])/.exec(control.label)?.[1];
      const slot =
        control.colorSlot ??
        (legacySlot && !control.displayLabel
          ? (paired ? Number(legacySlot) <= 2 : Number(legacySlot) === 1)
            ? 0
            : 1
          : undefined);
      const color =
        slot === 0
          ? g.color
          : slot === 1
            ? g.accent
            : typeof override === "string"
              ? override
              : undefined;
      if (control.type === "color" && color)
        engine.set_control(
          control.comp,
          control.layer,
          control.property,
          JSON.stringify({
            t: "Color",
            v: [
              ...[1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255),
              1,
            ],
          })
        );
      else if (control.type === "number" && typeof override === "number") {
        if (control.component !== undefined && control.vector) {
          const point = points.get(control.property) ?? {
            control,
            value: [...control.vector] as [number, number],
          };
          point.value[control.component] = override;
          points.set(control.property, point);
        } else
          engine.set_control(
            control.comp,
            control.layer,
            control.property,
            JSON.stringify({
              t: control.valueType ?? "Scalar",
              v: control.valueType === "Bool" ? !!override : override,
            })
          );
      }
    }
  }
  for (const { control, value } of points.values())
    engine.set_control(
      control.comp,
      control.layer,
      control.property,
      JSON.stringify({ t: "Vec2", v: value })
    );
  for (const slot of [0, 1]) {
    const halves = template.controls.filter(
      c => c.type === "text" && c.part && c.textSlot === slot
    );
    if (halves.length !== 2) continue;
    const scale = Math.min(...halves.map(c => fits.get(c.key)!));
    for (const c of halves) {
      const ratio = scale / fits.get(c.key)!;
      if (ratio < 1) engine.scale_text(c.comp, c.layer, c.property, ratio);
    }
  }
  selected = key;
  return template;
}
const source = new OffscreenCanvas(1, 1),
  output = new OffscreenCanvas(1, 1);
let serial = Promise.resolve();
self.onmessage = ({ data }) => {
  serial = serial.then(async () => {
    try {
      const g = normalizeGraphic(data.graphic),
        { width, height, duration, elapsed } = data;
      if (
        !g?.native ||
        ![width, height, duration, elapsed].every(Number.isFinite) ||
        width < 1 ||
        height < 1 ||
        width * height > 8_300_000 ||
        duration <= 0
      )
        throw Error("Invalid animation frame");
      const template = await configure(g);
      self.postMessage({ id: data.id, phase: "rendering" });
      const pose = graphicFrame(g, elapsed, duration),
        box = template.bounds;
      const maximum = Math.floor(
        Math.sqrt((8_294_400 * template.compWidth) / template.compHeight)
      );
      const fullWidth = Math.max(
        2,
        Math.min(maximum, Math.ceil((width * g.size) / 10 / box.width))
      );
      const scale = fullWidth / template.compWidth,
        fullHeight = Math.round(template.compHeight * scale);
      const time = nativeGraphicSourceTime(
        template,
        g.native,
        Math.max(0, elapsed),
        duration
      );
      const frameKey = `${selected}:${main}:${time}:${fullWidth}`;
      const pixels =
        cachedFrame?.key === frameKey
          ? cachedFrame.pixels
          : engine!.render(
              main,
              Math.min(template.duration - 1 / 3000, time),
              scale
            );
      cachedFrame = { key: frameKey, pixels };
      if (pixels.length !== fullWidth * fullHeight * 4)
        throw Error("The animation returned an incomplete frame");
      source.width = fullWidth;
      source.height = fullHeight;
      source
        .getContext("2d")!
        .putImageData(
          new ImageData(new Uint8ClampedArray(pixels), fullWidth, fullHeight),
          0,
          0
        );
      output.width = width;
      output.height = height;
      const ctx = output.getContext("2d")!;
      const displayedWidth = (width * g.size) / 10 / box.width;
      ctx.translate((width * pose.x) / 100, (height * pose.y) / 100);
      ctx.rotate((pose.rotation * Math.PI) / 180);
      ctx.scale(pose.scale, pose.scale);
      ctx.globalAlpha = pose.opacity;
      const displayedHeight =
        (displayedWidth * template.compHeight) / template.compWidth;
      ctx.drawImage(
        source,
        -(box.x + box.width / 2) * displayedWidth,
        -(box.y + box.height / 2) * displayedHeight,
        displayedWidth,
        displayedHeight
      );
      const rgba = ctx.getImageData(0, 0, width, height).data;
      self.postMessage(
        { id: data.id, width, height, pixels: rgba },
        { transfer: [rgba.buffer] }
      );
    } catch (error) {
      selected = "";
      self.postMessage({
        id: data.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
};
