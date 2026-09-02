import type { WorkspaceDocument } from "@contracts/workspace";

export type AnalyticsMetricKey =
  "published" | "scheduled" | "assets" | "scripts" | "projects";

export interface AnalyticsDataPoint {
  date: string;
  label: string;
  fullLabel: string;
  published: number;
  scheduled: number;
  assets: number;
  scripts: number;
  projects: number;
}

const DAY_MS = 86_400_000;

function utcDayKey(value: string): string | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString().slice(0, 10)
    : null;
}

export function buildAnalyticsSeries(
  workspace: WorkspaceDocument,
  dayCount = 14,
  now = new Date()
): AnalyticsDataPoint[] {
  const safeDayCount = Math.min(30, Math.max(7, Math.floor(dayCount)));
  const end = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const points = new Map<string, AnalyticsDataPoint>();

  for (let offset = safeDayCount - 1; offset >= 0; offset -= 1) {
    const date = new Date(end - offset * DAY_MS);
    const key = date.toISOString().slice(0, 10);
    points.set(key, {
      date: key,
      label: date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      fullLabel: date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      published: 0,
      scheduled: 0,
      assets: 0,
      scripts: 0,
      projects: 0,
    });
  }

  const increment = (value: string | undefined, metric: AnalyticsMetricKey) => {
    if (!value) return;
    const key = utcDayKey(value);
    const point = key ? points.get(key) : undefined;
    if (point) point[metric] += 1;
  };

  workspace.assets.forEach(asset => increment(asset.createdAt, "assets"));
  workspace.scripts.forEach(script => increment(script.createdAt, "scripts"));
  workspace.projects.forEach(project =>
    increment(project.createdAt, "projects")
  );
  workspace.posts.forEach(post => {
    if (post.scheduledAt) increment(post.scheduledAt, "scheduled");
    if (post.publishedAt || post.status === "published") {
      increment(post.publishedAt || post.createdAt, "published");
    }
  });

  return Array.from(points.values());
}

export function analyticsMetricTotal(
  series: AnalyticsDataPoint[],
  metric: AnalyticsMetricKey
): number {
  return series.reduce((total, point) => total + point[metric], 0);
}
