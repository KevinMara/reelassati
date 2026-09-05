import { describe, it, expect } from "vitest";
import { parseSocialPost } from "./social-analytics";
describe("social performance evidence", () => {
  it("preserves zero and missing metrics as different states", () => {
    const p = parseSocialPost({
      id: "p",
      publishedAt: "2026-09-01T00:00:00Z",
      analytics: { views: 0, likes: 12, reach: null, clicks: -1, shares: "23" },
      platformPostUrl: "javascript:bad",
    });
    expect(p?.metrics.views).toBe(0);
    expect(p?.metrics.likes).toBe(12);
    expect(p?.metrics.reach).toBeNull();
    expect(p?.metrics.clicks).toBeNull();
    expect(p?.metrics.shares).toBeNull();
    expect(p?.url).toBeUndefined();
  });
  it("rejects undated records instead of plotting them as recent", () => {
    expect(
      parseSocialPost({ id: "p", analytics: { views: 100000 } })
    ).toBeNull();
  });
});
