import type { TimelineClip } from "@contracts/workspace";
import {
  normalizeVisual,
  patchVisual,
  visualFrame,
} from "@contracts/clip-visual";
import { normalizeGraphic } from "@contracts/motion-graphics";

export type PreviewTransform = {
  dx?: number;
  dy?: number;
  scale?: number;
  rotation?: number;
};

export type PreviewBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export function unionPreviewBounds(
  boxes: PreviewBounds[]
): PreviewBounds | undefined {
  if (!boxes.length) return undefined;
  const x = Math.min(...boxes.map(b => b.x)),
    y = Math.min(...boxes.map(b => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map(b => b.x + b.width)) - x,
    height: Math.max(...boxes.map(b => b.y + b.height)) - y,
  };
}
export function previewContains(b: PreviewBounds, x: number, y: number) {
  return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
}

/** Snap in canvas units, using a screen-pixel tolerance supplied by the caller. */
export function snapPreviewMove(
  box: PreviewBounds,
  dx: number,
  dy: number,
  others: PreviewBounds[],
  width: number,
  height: number,
  toleranceX: number,
  toleranceY: number
) {
  const guides: { axis: "x" | "y"; at: number }[] = [];
  const axis = (
    start: number,
    size: number,
    delta: number,
    extent: number,
    other: { start: number; size: number }[],
    tolerance: number,
    name: "x" | "y"
  ) => {
    const targets = [
      0,
      extent * 0.05,
      extent / 2,
      extent * 0.95,
      extent,
      ...other.flatMap(b => [b.start, b.start + b.size / 2, b.start + b.size]),
    ];
    // Equal spacing: fit midway between two neighbours, or repeat their gap.
    const equalStarts: number[] = [];
    const sorted = [...other].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1],
        b = sorted[i],
        gap = b.start - a.start - a.size;
      if (gap >= size) equalStarts.push(a.start + a.size + (gap - size) / 2);
      if (gap >= 0)
        equalStarts.push(b.start + b.size + gap, a.start - gap - size);
    }
    let correction = tolerance + 1,
      guide: number | undefined;
    for (const target of targets)
      for (const edge of [
        start + delta,
        start + delta + size / 2,
        start + delta + size,
      ]) {
        const d = target - edge;
        if (Math.abs(d) < Math.abs(correction)) {
          correction = d;
          guide = target;
        }
      }
    for (const target of equalStarts) {
      const d = target - (start + delta);
      if (Math.abs(d) < Math.abs(correction)) {
        correction = d;
        guide = target + size / 2;
      }
    }
    if (guide !== undefined && Math.abs(correction) <= tolerance) {
      guides.push({ axis: name, at: guide });
      return delta + correction;
    }
    return delta;
  };
  return {
    dx: axis(
      box.x,
      box.width,
      dx,
      width,
      others.map(b => ({ start: b.x, size: b.width })),
      toleranceX,
      "x"
    ),
    dy: axis(
      box.y,
      box.height,
      dy,
      height,
      others.map(b => ({ start: b.y, size: b.height })),
      toleranceY,
      "y"
    ),
    guides,
  };
}

export function snapPreviewScale(
  box: PreviewBounds,
  scale: number,
  others: PreviewBounds[],
  width: number,
  height: number,
  toleranceX: number,
  toleranceY: number
) {
  const candidates = [
    1,
    ...[0.25, 1 / 3, 0.5, 0.75, 1].flatMap(f => [
      (width * f) / box.width,
      (height * f) / box.height,
    ]),
    ...others.flatMap(b => [b.width / box.width, b.height / box.height]),
  ];
  return (
    candidates
      .filter(n => Number.isFinite(n) && n >= 0.1 && n <= 4)
      .map(n => ({
        n,
        d: Math.max(
          (Math.abs(n - scale) * box.width) / toleranceX,
          (Math.abs(n - scale) * box.height) / toleranceY
        ),
      }))
      .filter(v => v.d <= 1)
      .sort((a, b) => a.d - b.d)[0]?.n ?? scale
  );
}

/** Bounds of the visible picture, including contain letterboxing, crop and rotation. */
export function mediaSelectionBounds(
  clip: TimelineClip,
  time: number,
  width: number,
  height: number,
  source?: { width: number; height: number }
) {
  const frame = visualFrame(clip, time);
  let pictureWidth = width,
    pictureHeight = height;
  if (clip.fit !== "cover" && source && source.width > 0 && source.height > 0) {
    const fit = Math.min(width / source.width, height / source.height);
    pictureWidth = source.width * fit;
    pictureHeight = source.height * fit;
  }
  const crop = frame.visual.crop;
  const left = Math.max((width - pictureWidth) / 2, (width * crop.left) / 100);
  const right = Math.min(
    (width + pictureWidth) / 2,
    width * (1 - crop.right / 100)
  );
  const top = Math.max((height - pictureHeight) / 2, (height * crop.top) / 100);
  const bottom = Math.min(
    (height + pictureHeight) / 2,
    height * (1 - crop.bottom / 100)
  );
  if (right <= left || bottom <= top) return undefined;
  const radians = (frame.rotation * Math.PI) / 180;
  const points = [
    [left, top],
    [right, top],
    [left, bottom],
    [right, bottom],
  ].map(([x, y]) => {
    const dx = (x - width / 2) * frame.scale * (frame.visual.flipX ? -1 : 1);
    const dy = (y - height / 2) * frame.scale * (frame.visual.flipY ? -1 : 1);
    return {
      x:
        width / 2 +
        (frame.x * width) / 100 +
        dx * Math.cos(radians) -
        dy * Math.sin(radians),
      y:
        height / 2 +
        (frame.y * height) / 100 +
        dx * Math.sin(radians) +
        dy * Math.cos(radians),
    };
  });
  const x = Math.min(...points.map(p => p.x)),
    y = Math.min(...points.map(p => p.y));
  return {
    x,
    y,
    width: Math.max(...points.map(p => p.x)) - x,
    height: Math.max(...points.map(p => p.y)) - y,
  };
}

/** Apply a canvas gesture to the whole animation path, not only its base pose. */
export function transformPreviewClip(
  clip: TimelineClip,
  change: PreviewTransform
): TimelineClip {
  if (clip.locked) return clip;
  const { dx = 0, dy = 0, scale = 1, rotation = 0 } = change;
  if (![dx, dy, scale, rotation].every(Number.isFinite) || scale <= 0)
    return clip;
  if (clip.graphic) {
    const g = clip.graphic;
    return {
      ...clip,
      graphic: normalizeGraphic({
        ...g,
        x: g.x + dx,
        y: g.y + dy,
        size: g.size * scale,
        width: g.width === undefined ? undefined : g.width * scale,
        height: g.height === undefined ? undefined : g.height * scale,
        padding: g.padding === undefined ? undefined : g.padding * scale,
        rotation: (g.rotation ?? 0) + rotation,
        motion: g.motion?.map(k => ({
          ...k,
          x: k.x + dx,
          y: k.y + dy,
          rotation: k.rotation + rotation,
        })),
      }),
    };
  }
  const v = normalizeVisual(clip.visual);
  return {
    ...clip,
    visual: patchVisual(clip, {
      x: v.x + dx,
      y: v.y + dy,
      scale: v.scale * scale,
      rotation: v.rotation + rotation,
      keyframes: v.keyframes.map(k => ({
        ...k,
        x: k.x + dx,
        y: k.y + dy,
        scale: k.scale * scale,
        rotation: k.rotation + rotation,
      })),
    }),
  };
}
