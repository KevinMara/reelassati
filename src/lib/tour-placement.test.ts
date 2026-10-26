import { describe, it, expect } from "vitest";
import { visibleTourRect, placeTourCard } from "./tour-placement";
describe("guided controls stay in the viewport", () => {
  it("rejects hidden targets with no drawable area", () => {
    expect(
      visibleTourRect({ left: 100, top: 100, width: 0, height: 0 }, 800, 600)
    ).toBeNull();
  });
  it("clips scrolled target rather than drawing beyond the page", () => {
    expect(
      visibleTourRect(
        { left: 20, top: -100, width: 300, height: 200 },
        800,
        600
      )
    ).toEqual({ left: 16, top: 8, width: 308, height: 96 });
  });
  it("hides a target entirely scrolled away", () => {
    expect(
      visibleTourRect({ left: 0, top: -500, width: 300, height: 200 }, 800, 600)
    ).toBeNull();
  });
  it("uses the opposite side instead of covering the control", () => {
    expect(
      placeTourCard(
        { left: 600, top: 100, width: 160, height: 36 },
        { width: 320, height: 220 },
        { width: 800, height: 600 }
      )
    ).toEqual({ left: 264, top: 100 });
  });
  it("keeps the card visible on a narrow screen", () => {
    const p = placeTourCard(
      { left: 16, top: 540, width: 340, height: 60 },
      { width: 320, height: 246 },
      { width: 390, height: 690 }
    );
    expect(p.left).toBeGreaterThanOrEqual(16);
    expect(p.left + 320).toBeLessThanOrEqual(374);
    expect(p.top + 246).toBeLessThanOrEqual(674);
  });
});
