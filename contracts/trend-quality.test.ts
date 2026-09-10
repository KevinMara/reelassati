import { describe, expect, it } from "vitest";
import type { TrendEvidenceItem } from "./trends";
import {
  balancedTrendSelection,
  performanceFromSource,
  sourceContainsDate,
} from "./trend-quality";
describe("trend evidence quality", () => {
  it("extracts labeled observed metrics, not arbitrary numbers or claims of virality", () => {
    expect(
      performanceFromSource(
        "1.2M views, 75K likes, 5,400 comments, shares: 12000"
      )
    ).toEqual({ views: 1200000, likes: 75000, comments: 5400, shares: 12000 });
    expect(
      performanceFromSource("Viral product! 2026 launch.").views
    ).toBeNull();
  });
  it("requires a dated source", () => {
    expect(
      sourceContainsDate(
        "September 7, 2026 · product demo",
        "2026-09-07T00:00:00Z"
      )
    ).toBe(true);
    expect(sourceContainsDate("This week!", "2026-09-07T00:00:00Z")).toBe(
      false
    );
  });
  it("balances reels and TikToks exactly and never fills with another platform", () => {
    const items = Array.from(
      { length: 9 },
      (_, i) =>
        ({
          id: String(i),
          platform: i < 7 ? "tiktok" : "instagram",
          brandName: `Brand ${i}`,
          metrics: { views: 1000000 + i },
        }) as TrendEvidenceItem
    );
    expect(balancedTrendSelection(items).map(t => t.platform)).toEqual([
      "instagram",
      "tiktok",
      "instagram",
      "tiktok",
    ]);
    expect(balancedTrendSelection(items.slice(0, 7))).toEqual([]);
  });
  it("does not count tracking variants of a source as independent evidence", () => {
    const base = { brandName: "Brand", metrics: { views: 1000000 } };
    const items = [
      {
        ...base,
        id: "a",
        platform: "instagram",
        sourceUrl: "https://www.instagram.com/reel/ABC/?utm_source=x",
      },
      {
        ...base,
        id: "b",
        platform: "instagram",
        sourceUrl: "https://instagram.com/reel/ABC",
      },
      {
        ...base,
        id: "c",
        platform: "tiktok",
        sourceUrl: "https://www.tiktok.com/@brand/video/123",
      },
      {
        ...base,
        id: "d",
        platform: "tiktok",
        sourceUrl: "https://www.tiktok.com/@brand/video/456",
      },
    ] as TrendEvidenceItem[];
    expect(balancedTrendSelection(items)).toHaveLength(2);
  });
});
