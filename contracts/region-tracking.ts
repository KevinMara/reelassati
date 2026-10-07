export interface GrayFrame {
  width: number;
  height: number;
  pixels: Uint8Array;
}
export interface TrackingRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface TrackingTemplate {
  offsets: Array<[number, number]>;
  values: number[];
  energy: number;
  halfWidth: number;
  halfHeight: number;
}
export interface RegionObservation {
  x: number;
  y: number;
  confidence: number;
  margin: number;
}

export function trackingTemplate(
  frame: GrayFrame,
  region: TrackingRegion
): TrackingTemplate {
  if (
    frame.width < 8 ||
    frame.height < 8 ||
    frame.pixels.length !== frame.width * frame.height
  )
    throw new Error("The decoded frame is not valid for tracking.");
  if (
    ![region.x, region.y, region.width, region.height].every(Number.isFinite) ||
    region.width < 0.02 ||
    region.height < 0.02 ||
    region.x < 0 ||
    region.y < 0 ||
    region.x + region.width > 1 ||
    region.y + region.height > 1
  )
    throw new Error("Choose a textured region inside the frame.");
  const cx = Math.round((region.x + region.width / 2) * frame.width - 0.5);
  const cy = Math.round((region.y + region.height / 2) * frame.height - 0.5);
  const hw = Math.max(3, Math.round((region.width * frame.width) / 2));
  const hh = Math.max(3, Math.round((region.height * frame.height) / 2));
  if (
    cx - hw < 0 ||
    cy - hh < 0 ||
    cx + hw >= frame.width ||
    cy + hh >= frame.height
  )
    throw new Error("Keep the tracking region away from the frame edge.");
  const offsets: Array<[number, number]> = [];
  const values: number[] = [];
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const dx = Math.round(((x / 15) * 2 - 1) * hw),
        dy = Math.round(((y / 15) * 2 - 1) * hh);
      offsets.push([dx, dy]);
      values.push(frame.pixels[(cy + dy) * frame.width + cx + dx]);
    }
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const centered = values.map(v => v - mean);
  const energy = centered.reduce((sum, v) => sum + v * v, 0);
  if (Math.sqrt(energy / values.length) < 10)
    throw new Error(
      "This region has too little detail to track. Choose an edge, logo, or textured object."
    );
  return { offsets, values: centered, energy, halfWidth: hw, halfHeight: hh };
}

/** Translation-only normalized correlation. Ambiguous or lost matches stop instead
 * of inventing positions. No predictive points enter the saved path. */
export function observeRegion(
  frame: GrayFrame,
  template: TrackingTemplate,
  previous: { x: number; y: number },
  radius = 30
): RegionObservation | undefined {
  const ox = Math.round(previous.x * frame.width - 0.5),
    oy = Math.round(previous.y * frame.height - 0.5);
  const minX = Math.max(template.halfWidth, ox - radius),
    maxX = Math.min(frame.width - 1 - template.halfWidth, ox + radius);
  const minY = Math.max(template.halfHeight, oy - radius),
    maxY = Math.min(frame.height - 1 - template.halfHeight, oy + radius);
  const score = (cx: number, cy: number) => {
    let sum = 0,
      squares = 0,
      covariance = 0;
    for (let i = 0; i < template.offsets.length; i++) {
      const [dx, dy] = template.offsets[i],
        v = frame.pixels[(cy + dy) * frame.width + cx + dx];
      sum += v;
      squares += v * v;
      covariance += template.values[i] * v;
    }
    const energy = squares - (sum * sum) / template.values.length;
    return energy > 1 ? covariance / Math.sqrt(template.energy * energy) : -1;
  };
  const candidates: Array<{ x: number; y: number; score: number }> = [];
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++)
      candidates.push({ x, y, score: score(x, y) });
  if (!candidates.length) return undefined;
  const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
  const exclusion = Math.max(
    5,
    Math.min(template.halfWidth, template.halfHeight) / 2
  );
  const second = candidates
    .filter(c => Math.hypot(c.x - best.x, c.y - best.y) >= exclusion)
    .reduce((max, c) => Math.max(max, c.score), -1);
  const margin = best.score - second;
  if (!Number.isFinite(best.score) || best.score < 0.78 || margin < 0.08)
    return undefined;
  return {
    x: (best.x + 0.5) / frame.width,
    y: (best.y + 0.5) / frame.height,
    confidence: best.score,
    margin,
  };
}

export interface TrackedPoint {
  time: number;
  x: number;
  y: number;
  confidence: number;
}
/** Keep observed endpoints, simplifying only within a bounded positional error. */
export function simplifyTracking(
  points: readonly TrackedPoint[],
  tolerance = 0.0015
): TrackedPoint[] {
  if (points.length <= 2) return [...points];
  const keep = new Set([0, points.length - 1]);
  const visit = (first: number, last: number) => {
    const a = points[first],
      b = points[last];
    let error = tolerance,
      selected = -1;
    for (let i = first + 1; i < last; i++) {
      const t = (points[i].time - a.time) / (b.time - a.time);
      const e = Math.hypot(
        points[i].x - a.x - (b.x - a.x) * t,
        points[i].y - a.y - (b.y - a.y) * t
      );
      if (e > error) {
        error = e;
        selected = i;
      }
    }
    if (selected >= 0) {
      keep.add(selected);
      visit(first, selected);
      visit(selected, last);
    }
  };
  visit(0, points.length - 1);
  return [...keep].sort((a, b) => a - b).map(i => points[i]);
}
