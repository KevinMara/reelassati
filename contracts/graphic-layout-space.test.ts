import { expect, it } from "vitest";
import { graphicLayoutSpace } from "./graphic-layout-space";

it("finds the top comparison strip when moving demonstrations occupy the lower frame", () => {
  const occupied = [
    {x: 28, y: 13, width: 45, height: 42},
    {x: 20, y: 52, width: 60, height: 10},
    {x: 5, y: 55, width: 55, height: 45},
    {x: 45, y: 50, width: 50, height: 50},
    {x: 35, y: 50, width: 55, height: 50},
  ];
  const regions = graphicLayoutSpace(occupied);
  expect(regions.some(r => r.width >= 90 && r.y + r.height <= 11)).toBe(true);
  for (const region of regions) for (const block of occupied)
    expect(region.x + region.width <= block.x - 2 || region.x >= block.x + block.width + 2 ||
      region.y + region.height <= block.y - 2 || region.y >= block.y + block.height + 2).toBe(true);
});
it("does not suggest space for a full-frame protected card or invalid source geometry", () => {
  expect(graphicLayoutSpace([{x: 0, y: 0, width: 100, height: 100}])).toEqual([]);
  expect(graphicLayoutSpace([{x: NaN, y: 0, width: 100, height: 100}])).toEqual([]);
});
