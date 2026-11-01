import { describe, expect, it } from "vitest";
import {
  createEmptyWorkspace,
  type EditProject,
  type ScheduledPost,
} from "@contracts/workspace";
import { buildWeeklyReview } from "./weekly-review";

const now = new Date("2026-11-01T12:00:00.000Z");
function project(
  id: string,
  status: EditProject["status"] = "editing"
): EditProject {
  return {
    id,
    title: id,
    status,
    template: "blank",
    platform: "instagram",
    aspectRatio: "9:16",
    duration: 10,
    playhead: 0,
    createdAt: "2026-10-27T12:00:00Z",
    updatedAt: "2026-10-28T12:00:00Z",
    clips: [],
    transcript: [],
    proposedChanges: [],
    qualitySignals: [],
    revisions: [],
  };
}
function post(id: string, status: ScheduledPost["status"]): ScheduledPost {
  return {
    id,
    status,
    caption: id,
    hashtags: [],
    accountIds: [],
    platforms: [],
    createdAt: "2026-10-28T12:00:00Z",
  };
}

describe("weekly coach evidence", () => {
  it("prioritizes failures and expired accounts, then links to exact reviewable work", () => {
    const workspace = createEmptyWorkspace("creator@example.com");
    workspace.posts = [
      post("failed one", "failed"),
      post("draft one", "draft"),
    ];
    workspace.accounts = [
      {
        id: "account",
        providerId: "provider",
        platform: "instagram",
        accountName: "Brand",
        status: "expired",
      },
    ];
    workspace.projects = [
      project("editing"),
      project("review & ready", "review"),
    ];
    const report = buildWeeklyReview(workspace, now);
    expect(report.actions.map(action => action.key)).toEqual([
      "failed",
      "connection",
      "edit",
      "draft",
    ]);
    expect(report.actions[0].to).toBe("/dashboard/publish?draft=failed%20one");
    expect(report.actions[2].to).toBe(
      "/dashboard/edit?project=review%20%26%20ready"
    );
    expect(report.actions[3].to).toBe("/dashboard/publish?draft=draft%20one");
    expect(report.projectsTouched).toBe(2);
  });

  it("does not claim future, invalid or undated publication records were published this week", () => {
    const workspace = createEmptyWorkspace("creator@example.com");
    workspace.posts = [
      { ...post("valid", "published"), publishedAt: "2026-10-28T12:00:00Z" },
      post("undated", "published"),
      { ...post("invalid", "published"), publishedAt: "bad" },
      {
        ...post("future", "published"),
        publishedAt: "2026-11-02T00:00:00Z",
        createdAt: "2026-11-02T00:00:00Z",
      },
      { ...post("schedule", "scheduled"), scheduledAt: "2026-11-03T00:00:00Z" },
      { ...post("stale", "scheduled"), scheduledAt: "2026-10-01T00:00:00Z" },
    ];
    const report = buildWeeklyReview(workspace, now);
    expect(report.postsPublished).toBe(1);
    expect(report.postsCreated).toBe(5);
    expect(report.scheduledPosts).toBe(1);
  });

  it("only suggests preparing a publication when there is ready visual media", () => {
    const workspace = createEmptyWorkspace("creator@example.com");
    workspace.accounts = [
      {
        id: "account",
        providerId: "provider",
        platform: "instagram",
        accountName: "Brand",
        status: "connected",
      },
    ];
    expect(
      buildWeeklyReview(workspace, now).actions.some(
        action => action.key === "publish"
      )
    ).toBe(false);
    workspace.assets = [
      {
        id: "asset one",
        name: "Clip",
        kind: "video",
        contentType: "video/mp4",
        size: 1,
        url: "",
        status: "ready",
        createdAt: now.toISOString(),
      },
    ];
    expect(
      buildWeeklyReview(workspace, now).actions.find(
        action => action.key === "publish"
      )?.to
    ).toBe("/dashboard/publish?asset=asset%20one");
  });

  it("compares goal completion ratios across units and ignores invalid targets", () => {
    const workspace = createEmptyWorkspace("creator@example.com");
    workspace.goals = [
      {
        id: "posts",
        label: "Posts",
        metric: "posts",
        current: 1,
        target: 2,
        createdAt: now.toISOString(),
      },
      {
        id: "views",
        label: "Views",
        metric: "views",
        current: 900,
        target: 1000,
        createdAt: now.toISOString(),
      },
      {
        id: "invalid",
        label: "Invalid",
        metric: "posts",
        current: -2,
        target: 0,
        createdAt: now.toISOString(),
      },
    ];
    const report = buildWeeklyReview(workspace, now);
    expect(report.activeGoals).toBe(2);
    expect(
      report.actions.find(action => action.key === "goal")?.values
    ).toEqual({ goal: "Views", percent: 90 });
  });
});
