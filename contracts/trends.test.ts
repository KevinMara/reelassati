import { describe, expect, it } from "vitest";
import { weeklyTrendFeedStatus } from "./trends";

describe("weekly trend freshness", () => {
  const now = Date.parse("2026-09-05T12:00:00Z");
  it("keeps an expired verified edition available without calling it current", () => {
    expect(weeklyTrendFeedStatus("2026-09-04T12:00:00Z", null, now)).toBe(
      "stale"
    );
    expect(weeklyTrendFeedStatus("2026-09-06T12:00:00Z", null, now)).toBe(
      "ready"
    );
  });
  it("does not describe an ended or failed first refresh as still preparing", () => {
    expect(weeklyTrendFeedStatus(null, "2026-09-05T11:59:00Z", now)).toBe(
      "unavailable"
    );
    expect(weeklyTrendFeedStatus(null, "2026-09-05T12:01:00Z", now)).toBe(
      "preparing"
    );
  });
});
