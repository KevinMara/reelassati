import { describe, expect, it } from "vitest";
import { createEmptyWorkspace } from "@contracts/workspace";
import { analyticsMetricTotal, buildAnalyticsSeries } from "./analytics";

describe("analytics series", () => {
  it("counts real workspace output by UTC day without inventing metrics", () => {
    const workspace = createEmptyWorkspace("creator@example.com");
    workspace.assets = [
      {
        id: "asset-1",
        name: "Launch clip",
        kind: "video",
        contentType: "video/mp4",
        size: 1,
        url: "https://media.example/launch.mp4",
        status: "ready",
        createdAt: "2026-09-01T23:55:00.000Z",
      },
    ];
    workspace.scripts = [
      {
        id: "script-1",
        title: "Launch",
        hook: "Hook",
        body: "Body",
        cta: "CTA",
        fullScript: "Hook Body CTA",
        platform: "tiktok",
        tone: "direct",
        duration: 15,
        language: "en",
        createdAt: "2026-09-02T00:05:00.000Z",
      },
    ];
    workspace.posts = [
      {
        id: "post-1",
        caption: "Launch",
        hashtags: [],
        accountIds: [],
        platforms: ["instagram"],
        scheduledAt: "2026-09-01T18:00:00.000Z",
        publishedAt: "2026-09-02T08:00:00.000Z",
        status: "published",
        createdAt: "2026-08-31T10:00:00.000Z",
      },
    ];

    const series = buildAnalyticsSeries(
      workspace,
      7,
      new Date("2026-09-02T12:00:00.000Z")
    );

    expect(series).toHaveLength(7);
    expect(series.find(point => point.date === "2026-09-01")).toMatchObject({
      assets: 1,
      scheduled: 1,
      scripts: 0,
      published: 0,
    });
    expect(series.find(point => point.date === "2026-09-02")).toMatchObject({
      assets: 0,
      scheduled: 0,
      scripts: 1,
      published: 1,
    });
    expect(analyticsMetricTotal(series, "published")).toBe(1);
    expect(analyticsMetricTotal(series, "projects")).toBe(0);
  });
});
