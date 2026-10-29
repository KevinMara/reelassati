import {
  normalizeVisual,
  visualClock,
  type VisualPose,
  type VisualEasing,
} from "@contracts/clip-visual";
import type { TimelineClip } from "@contracts/workspace";

const n = (v: number) => Number(v.toFixed(6)).toString();
const clamp = (s: string) => `clip(${s},0,1)`;
function ease(p: string, easing: VisualEasing) {
  return easing === "hold"
    ? "0"
    : easing === "ease-in"
      ? `pow(${p},2)`
      : easing === "ease-out"
        ? `(1-pow(1-${p},2))`
        : easing === "ease-in-out"
          ? `(pow(${p},2)*(3-2*${p}))`
          : p;
}

/** Fixed-size inverse affine sampling avoids dynamic scale/rotate frame clipping. */
export function visualRenderFilter(
  clip: TimelineClip,
  canvas?: { width: number; height: number }
): string {
  if (!clip.visual) return "";
  const v = normalizeVisual(clip.visual),
    clock = visualClock(clip),
    speed = clip.speed ?? 1;
  const progress = clamp(
    `(${n(clip.inPoint - clock.start)}+T*${n(speed)})/${n(clock.duration)}`
  );
  function curve(key: keyof VisualPose) {
    const keys = v.keyframes;
    if (!keys.length) return n(v[key]);
    let expr = n(keys[keys.length - 1][key]);
    for (let i = keys.length - 1; i > 0; i--) {
      const a = keys[i - 1],
        b = keys[i];
      const p = ease(
        clamp(`(${progress}-${n(a.at)})/${n(b.at - a.at)}`),
        a.easing
      );
      const value =
        a[key] === b[key]
          ? n(a[key])
          : `(${n(a[key])}+${n(b[key] - a[key])}*${p})`;
      expr = `if(lt(${progress},${n(b.at)}),${value},${expr})`;
    }
    return expr;
  }
  const y = curve("y");
  let x = curve("x"),
    scale = curve("scale"),
    opacity = curve("opacity");
  const angle = `(${curve("rotation")}*PI/180)`;
  const reveals: string[] = [];
  const span = clock.duration / speed;
  for (const [effect, distance] of [
    [
      v.entrance,
      `((${n(clip.inPoint - (v.entrance.at ?? clock.start))}+T*${n(speed)})/${n(clock.duration)})`,
    ],
    [
      v.exit,
      `((${n((v.exit.at ?? clock.start + clock.duration) - clip.inPoint)}-T*${n(speed)})/${n(clock.duration)})`,
    ],
  ] as const) {
    const q = clamp(
      `${distance}*${n(span / Math.min(effect.duration, span / 2))}`
    );
    if (effect.kind === "dissolve" || effect.kind === "zoom")
      opacity = `(${opacity}*${q})`;
    if (effect.kind === "zoom") scale = `(${scale}*(0.8+0.2*${q}))`;
    if (effect.kind === "slide-left") x = `(${x}-100*(1-${q}))`;
    if (effect.kind === "slide-right") x = `(${x}+100*(1-${q}))`;
    if (effect.kind === "wipe-left") reveals.push(`lt(X,W*${q})`);
    if (effect.kind === "wipe-right") reveals.push(`gte(X,W*(1-${q}))`);
    if (effect.kind === "wipe-up") reveals.push(`lt(Y,H*${q})`);
    if (effect.kind === "wipe-down") reveals.push(`gte(Y,H*(1-${q}))`);
  }
  // Evaluate each curve once per channel; use pixel centers so flips keep edge pixels.
  const setup = `st(2,${x});st(3,${y});st(4,${scale});st(5,sin(${angle}));st(6,cos(${angle}));st(8,X+0.5-W/2-W*ld(2)/100);st(9,Y+0.5-H/2-H*ld(3)/100);`;
  const sx = `((ld(8)*ld(6)+ld(9)*ld(5))/ld(4)*${v.flipX ? -1 : 1}+W/2)`;
  const sy = `((-ld(8)*ld(5)+ld(9)*ld(6))/ld(4)*${v.flipY ? -1 : 1}+H/2)`;
  const coords = `${setup}st(0,${sx});st(1,${sy});`;
  const { left, right, top, bottom } = v.crop;
  const crop = `gte(ld(0),W*${n(left / 100)})*lt(ld(0),W*${n(1 - right / 100)})*gte(ld(1),H*${n(top / 100)})*lt(ld(1),H*${n(1 - bottom / 100)})`;
  let mask = "1";
  if (v.mask === "ellipse")
    mask = "lte(pow((ld(0)-W/2)/(W/2),2)+pow((ld(1)-H/2)/(H/2),2),1)";
  if (v.mask === "rounded" && v.radius > 0) {
    const rx = `W*${n(v.radius / 100)}`,
      ry = `H*${n(v.radius / 100)}`;
    mask = `lte(pow(max(abs(ld(0)-W/2)-(W/2-${rx}),0)/${rx},2)+pow(max(abs(ld(1)-H/2)-(H/2-${ry}),0)/${ry},2),1)`;
  }
  if (v.mask === "polygon") {
    const edges = v.polygon.flatMap((a, i) => {
      const b = v.polygon[(i + 1) % v.polygon.length];
      if (a.y === b.y) return [];
      const ax = n(a.x / 100),
        ay = n(a.y / 100),
        by = n(b.y / 100);
      return [
        `(not(eq(gt(H*${ay},ld(1)),gt(H*${by},ld(1))))*lt(ld(0),W*${ax}+(ld(1)-H*${ay})*W*${n((b.x - a.x) / 100)}/(H*${n((b.y - a.y) / 100)})))`,
      ];
    });
    mask = edges.length ? `mod(${edges.join("+")},2)` : "0";
  }
  const identity =
    !v.keyframes.length &&
    v.x === 0 &&
    v.y === 0 &&
    v.scale === 1 &&
    v.rotation === 0 &&
    v.opacity === 1 &&
    !v.flipX &&
    !v.flipY &&
    !Object.values(v.crop).some(Boolean) &&
    v.mask === "none" &&
    v.entrance.kind === "none" &&
    v.exit.kind === "none";
  if (identity) return "";
  const plainGeometry =
    !v.keyframes.length &&
    v.x === 0 &&
    v.y === 0 &&
    v.scale === 1 &&
    v.rotation === 0 &&
    !v.flipX &&
    !v.flipY &&
    !Object.values(v.crop).some(Boolean) &&
    v.mask === "none";
  // Static contained logos need only scale + transparent padding, rather than
  // an inverse transform evaluated for every pixel of every exported frame.
  const scaledWidth = canvas
    ? Math.max(1, Math.round(canvas.width * v.scale))
    : 0;
  const scaledHeight = canvas
    ? Math.max(1, Math.round(canvas.height * v.scale))
    : 0;
  const leftPad = canvas
    ? Math.round(canvas.width * (0.5 + v.x / 100) - scaledWidth / 2)
    : 0;
  const topPad = canvas
    ? Math.round(canvas.height * (0.5 + v.y / 100) - scaledHeight / 2)
    : 0;
  const containedPose =
    canvas &&
    !v.keyframes.length &&
    v.scale < 1 &&
    v.rotation === 0 &&
    !v.flipX &&
    !v.flipY &&
    !Object.values(v.crop).some(Boolean) &&
    v.mask === "none" &&
    leftPad >= 0 &&
    topPad >= 0 &&
    leftPad + scaledWidth <= canvas.width &&
    topPad + scaledHeight <= canvas.height;
  // A static enlarged crop is also affine without per-pixel expressions.
  // Restrict this path to a source that covers the whole canvas; off-canvas
  // transparency, rotations, masks and animated poses retain inverse sampling.
  const coveringPose =
    canvas &&
    !v.keyframes.length &&
    v.scale > 1 &&
    v.rotation === 0 &&
    !v.flipX &&
    !v.flipY &&
    !Object.values(v.crop).some(Boolean) &&
    v.mask === "none" &&
    leftPad <= 0 &&
    topPad <= 0 &&
    leftPad + scaledWidth >= canvas.width &&
    topPad + scaledHeight >= canvas.height;
  if (
    (plainGeometry || containedPose || coveringPose) &&
    [v.entrance.kind, v.exit.kind].every(
      kind => kind === "none" || kind === "dissolve"
    )
  ) {
    const filters = ["format=rgba", "settb=AVTB"];
    if (containedPose)
      filters.push(
        `scale=${scaledWidth}:${scaledHeight}:flags=bilinear`,
        `pad=${canvas!.width}:${canvas!.height}:${leftPad}:${topPad}:color=black@0`
      );
    if (coveringPose)
      filters.push(
        `scale=${scaledWidth}:${scaledHeight}:flags=bilinear`,
        `crop=${canvas!.width}:${canvas!.height}:${-leftPad}:${-topPad}`
      );
    if (v.opacity !== 1) filters.push(`colorchannelmixer=aa=${n(v.opacity)}`);
    for (const [type, effect] of [
      ["in", v.entrance],
      ["out", v.exit],
    ] as const) {
      if (effect.kind === "none") continue;
      const duration = Math.min(effect.duration, span / 2);
      const anchor =
        type === "in"
          ? (effect.at ?? clock.start)
          : (effect.at ?? clock.start + clock.duration);
      const start =
        (anchor - clip.inPoint) / speed - (type === "out" ? duration : 0);
      const phase = Math.max(0, -start);
      if (phase) filters.push(`setpts=PTS+${n(phase)}/TB`);
      filters.push(
        `fade=t=${type}:st=${n(Math.max(0, start))}:d=${n(duration)}:alpha=1`
      );
      if (phase) filters.push(`setpts=PTS-${n(phase)}/TB`);
    }
    return filters.join(",");
  }
  return `format=gbrap,geq=r='${coords}r(ld(0)-0.5,ld(1)-0.5)':g='${coords}g(ld(0)-0.5,ld(1)-0.5)':b='${coords}b(ld(0)-0.5,ld(1)-0.5)':a='${coords}alpha(ld(0)-0.5,ld(1)-0.5)*(${opacity})*(${crop})*(${mask})${reveals.length ? `*${reveals.join("*")}` : ""}',format=rgba`;
}

/** Blend RGB in sRGB, then restore the transformed upper alpha before compositing.
 * Masks, fades, contain padding and timeline gaps retain the lower layer. */
export function visualCompositeFilters(
  clip: TimelineClip,
  lower: string,
  upper: string,
  output: string
): string[] {
  const enable = `gte(t,${n(clip.start)})*lt(t,${n(clip.start + clip.duration)})`;
  const mode = normalizeVisual(clip.visual).blendMode;
  const overlay = (a: string, b: string) =>
    `[${a}][${b}]overlay=eof_action=pass:repeatlast=0:enable='${enable}'[${output}]`;
  if (mode === "normal") return [overlay(lower, upper)];
  const p = output;
  return [
    `[${lower}]split[${p}under][${p}bg]`,
    `[${upper}]split[${p}color][${p}a]`,
    `[${p}a]alphaextract[${p}alpha]`,
    `[${p}bg]format=gbrp[${p}bgrgb]`,
    `[${p}color]format=gbrp[${p}rgb]`,
    `[${p}bgrgb][${p}rgb]blend=all_mode=${mode}:eof_action=pass:repeatlast=0[${p}blend]`,
    `[${p}blend][${p}alpha]alphamerge[${p}merged]`,
    overlay(`${p}under`, `${p}merged`),
  ];
}
