export type TourRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};
export function visibleTourRect(
  rect: TourRect,
  width: number,
  height: number,
  topInset = 8
): TourRect | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const left = Math.max(8, rect.left - 4),
    top = Math.max(topInset, rect.top - 4);
  const right = Math.min(width - 8, rect.left + rect.width + 4),
    bottom = Math.min(height - 8, rect.top + rect.height + 4);
  return right > left && bottom > top
    ? { left, top, width: right - left, height: bottom - top }
    : null;
}
export function placeTourCard(
  target: TourRect,
  card: { width: number; height: number },
  viewport: { width: number; height: number }
) {
  const gap = 16,
    edge = 16;
  const candidates = [
    { left: target.left + target.width + gap, top: target.top },
    { left: target.left - card.width - gap, top: target.top },
    { left: target.left, top: target.top + target.height + gap },
    { left: target.left, top: target.top - card.height - gap },
  ].map(p => ({
    left: Math.max(edge, Math.min(viewport.width - card.width - edge, p.left)),
    top: Math.max(edge, Math.min(viewport.height - card.height - edge, p.top)),
  }));
  const overlap = (p: { left: number; top: number }) =>
    Math.max(
      0,
      Math.min(p.left + card.width, target.left + target.width) -
        Math.max(p.left, target.left)
    ) *
    Math.max(
      0,
      Math.min(p.top + card.height, target.top + target.height) -
        Math.max(p.top, target.top)
    );
  return candidates.sort((a, b) => overlap(a) - overlap(b))[0];
}
