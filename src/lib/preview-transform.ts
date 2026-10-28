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
