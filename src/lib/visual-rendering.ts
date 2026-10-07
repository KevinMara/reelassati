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
export function visualRenderFilter(clip: TimelineClip): string {
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
  if (
    plainGeometry &&
    [v.entrance.kind, v.exit.kind].every(
      kind => kind === "none" || kind === "dissolve"
    )
  ) {
    const filters = ["format=rgba", "settb=AVTB"];
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
