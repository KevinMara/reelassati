export type CanvasRect = { x: number; y: number; width: number; height: number };

/** Candidate layout space in canvas percentages. This is composition guidance,
 * not a safety certificate: the renderer still checks every delivered frame. */
export function graphicLayoutSpace(obstacles: readonly CanvasRect[]): CanvasRect[] {
  let regions: CanvasRect[] = [{ x: 4, y: 4, width: 92, height: 92 }];
  const contains = (a: CanvasRect, b: CanvasRect) => a.x <= b.x && a.y <= b.y &&
    a.x + a.width >= b.x + b.width && a.y + a.height >= b.y + b.height;
  for (const obstacle of obstacles) {
    if (!Object.values(obstacle).every(Number.isFinite) || obstacle.width <= 0 || obstacle.height <= 0)
      return []; // Unknown geometry must never become permission to cover it.
    const left = obstacle.x - 2, top = obstacle.y - 2;
    const right = obstacle.x + obstacle.width + 2, bottom = obstacle.y + obstacle.height + 2;
    const split = regions.flatMap(region => {
      const r = region.x + region.width, b = region.y + region.height;
      if (right <= region.x || left >= r || bottom <= region.y || top >= b) return [region];
      const result: CanvasRect[] = [];
      if (left > region.x) result.push({ ...region, width: left - region.x });
      if (right < r) result.push({ ...region, x: right, width: r - right });
      if (top > region.y) result.push({ ...region, height: top - region.y });
      if (bottom < b) result.push({ ...region, y: bottom, height: b - bottom });
      return result;
    }).filter(r => r.width >= 8 && r.height >= 5);
    regions = split.filter((region, i) => !split.some((other, j) =>
      j !== i && contains(other, region) && (j < i || !contains(region, other))))
      .sort((a, b) => b.width * b.height - a.width * a.height).slice(0, 64);
  }
  return regions.slice(0, 12);
}
