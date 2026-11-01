import type { WorkspaceDocument, WorkspaceEvent } from "@contracts/workspace";

export type MomentumMetric = "actions" | "published" | "assets";

export interface MomentumPoint {
  date: string;
  actions: number;
  published: number;
  assets: number;
}

const DAY_MS = 86_400_000;

/** Calendar days in UTC, including today only up to the supplied instant. */
export function progressWindow(now: Date, days = 7) {
  const count = Number.isFinite(days)
    ? Math.min(90, Math.max(1, Math.floor(days)))
    : 7;
  const end = now.getTime();
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  return { start: today - (count - 1) * DAY_MS, end, today, days: count };
}

export function isInProgressWindow(
  timestamp: string | undefined,
  window: { start: number; end: number }
) {
  const time = timestamp ? Date.parse(timestamp) : NaN;
  return Number.isFinite(time) && time >= window.start && time <= window.end;
}

// Planning assumptions, not measured savings. Count completed assisted work
// only: starts, failures, manual edits and publishing records earn no estimate.
const ASSISTED_MINUTES: Readonly<
  Partial<Record<WorkspaceEvent["type"], Record<string, number>>>
> = {
  generation: {
    "Image generated": 18,
    "Video generated": 18,
    "Video analysis completed": 18,
    "Voice note transcribed": 18,
  },
  script: {
    "Script generated": 12,
    "Interview script generated": 12,
    "Voice note turned into script": 12,
  },
};

export function estimatedAssistedMinutes(event: WorkspaceEvent) {
  const assumptions = ASSISTED_MINUTES[event.type];
  return assumptions && Object.hasOwn(assumptions, event.label)
    ? assumptions[event.label]
    : 0;
}

export function buildMomentumSeries(
  workspace: WorkspaceDocument,
  days = 7,
  now = new Date()
): MomentumPoint[] {
  const window = progressWindow(now, days);
  const points = new Map<string, MomentumPoint>();
  for (let offset = 0; offset < window.days; offset += 1) {
    const date = new Date(window.start + offset * DAY_MS)
      .toISOString()
      .slice(0, 10);
    points.set(date, { date, actions: 0, published: 0, assets: 0 });
  }
  const count = (timestamp: string | undefined, metric: MomentumMetric) => {
    if (!isInProgressWindow(timestamp, window)) return;
    const point = points.get(new Date(timestamp!).toISOString().slice(0, 10));
    if (point) point[metric] += 1;
  };
  const seenEvents = new Set<string>();
  for (const event of workspace.activity) {
    if (
      seenEvents.has(event.id) ||
      !isInProgressWindow(event.createdAt, window)
    )
      continue;
    seenEvents.add(event.id);
    count(event.createdAt, "actions");
  }
  for (const asset of workspace.assets) count(asset.createdAt, "assets");
  for (const post of workspace.posts) {
    if (post.status === "published") count(post.publishedAt, "published");
  }
  return [...points.values()];
}

export function summarizeWeeklyProgress(
  workspace: WorkspaceDocument,
  now = new Date()
) {
  const window = progressWindow(now);
  const seenEvents = new Set<string>();
  const weekActivity = workspace.activity.filter(event => {
    if (
      seenEvents.has(event.id) ||
      !isInProgressWindow(event.createdAt, window)
    )
      return false;
    seenEvents.add(event.id);
    return true;
  });
  const series = buildMomentumSeries(workspace, 7, now);
  return {
    actions: weekActivity.length,
    activeDays: series.filter(point => point.actions > 0).length,
    estimatedMinutesSaved: weekActivity.reduce(
      (sum, event) => sum + estimatedAssistedMinutes(event),
      0
    ),
    published: series.reduce((sum, point) => sum + point.published, 0),
  };
}
