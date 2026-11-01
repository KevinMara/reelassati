import { describe, expect, it } from "vitest";
import {
  createEmptyWorkspace,
  type WorkspaceEvent,
} from "@contracts/workspace";
import {
  buildMomentumSeries,
  summarizeWeeklyProgress,
} from "./workspace-progress";

const now = new Date("2026-11-01T12:00:00.000Z");
function event(
  id: string,
  createdAt: string,
  type: WorkspaceEvent["type"] = "generation",
  label = "Video generated"
): WorkspaceEvent {
  return { id, createdAt, type, label, detail: "" };
}

describe("workspace momentum", () => {
  it("uses seven UTC calendar days, excluding invalid, future and duplicate activity", () => {
    const workspace = createEmptyWorkspace("creator@example.com");
    workspace.activity = [
      event("first", "2026-10-26T00:00:00.000Z"),
      event("old", "2026-10-25T23:59:59.999Z"),
      event("today", now.toISOString()),
      event("today", now.toISOString()),
      event("future", "2026-11-01T12:00:00.001Z"),
      event("invalid", "invalid"),
    ];
    const summary = summarizeWeeklyProgress(workspace, now);
    expect(summary).toMatchObject({
      actions: 2,
      activeDays: 2,
      estimatedMinutesSaved: 36,
      published: 0,
    });
    const series = buildMomentumSeries(workspace, 7, now);
    expect(series).toHaveLength(7);
    expect(series[0]).toMatchObject({ date: "2026-10-26", actions: 1 });
    expect(series.at(-1)).toMatchObject({ date: "2026-11-01", actions: 1 });
  });

  it("estimates completed assisted work without rewarding failures, starts or manual edits", () => {
    const workspace = createEmptyWorkspace("creator@example.com");
    workspace.activity = [
      event("generated", now.toISOString()),
      event("script", now.toISOString(), "script", "Script generated"),
      event(
        "failed",
        now.toISOString(),
        "generation",
        "Video generation failed"
      ),
      event(
        "started",
        now.toISOString(),
        "generation",
        "Video generation started"
      ),
      event("updated", now.toISOString(), "script", "Script updated"),
      event("project", now.toISOString(), "project", "Project created"),
      event("fake", now.toISOString(), "generation", "Unrecognized action"),
      event("prototype", now.toISOString(), "generation", "toString"),
    ];
    expect(summarizeWeeklyProgress(workspace, now)).toMatchObject({
      actions: 8,
      activeDays: 1,
      estimatedMinutesSaved: 30,
    });
  });

  it("counts dated confirmed publications once and leaves missing evidence empty", () => {
    const workspace = createEmptyWorkspace("creator@example.com");
    const post = {
      id: "confirmed",
      caption: "",
      hashtags: [],
      accountIds: [],
      platforms: [] as [],
      createdAt: now.toISOString(),
      publishedAt: now.toISOString(),
      status: "published" as const,
    };
    workspace.posts = [
      post,
      { ...post, id: "missing", publishedAt: undefined },
      { ...post, id: "failed", status: "failed" },
      { ...post, id: "future", publishedAt: "2026-11-02T00:00:00Z" },
    ];
    workspace.assets = [
      {
        id: "asset",
        name: "Clip",
        kind: "video",
        contentType: "video/mp4",
        size: 1,
        url: "",
        status: "ready",
        createdAt: "2026-10-31T23:30:00-02:00",
      },
    ];
    const series = buildMomentumSeries(workspace, 14, now);
    expect(series).toHaveLength(14);
    expect(series.at(-1)).toMatchObject({ published: 1, assets: 1 });
    expect(summarizeWeeklyProgress(workspace, now).published).toBe(1);
    expect(
      buildMomentumSeries(
        createEmptyWorkspace("empty@example.com"),
        30,
        now
      ).every(
        point =>
          point.actions === 0 && point.assets === 0 && point.published === 0
      )
    ).toBe(true);
  });
});
