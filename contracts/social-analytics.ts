export const SOCIAL_METRICS = [
  "views",
  "likes",
  "comments",
  "shares",
  "saves",
  "impressions",
  "reach",
  "clicks",
] as const;
export type SocialMetric = (typeof SOCIAL_METRICS)[number];
export interface SocialPostMetrics {
  id: string;
  content: string;
  platform: string;
  publishedAt: string;
  url?: string;
  metrics: Record<SocialMetric, number | null>;
  updatedAt: string | null;
}
export interface SocialAnalyticsResponse {
  configured: boolean;
  connected: boolean;
  syncedAt: string | null;
  partial: boolean;
  posts: SocialPostMetrics[];
  message?: string;
}
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export function parseSocialPost(value: unknown): SocialPostMetrics | null {
  const row = object(value);
  const id = String(row.postId || row.id || "");
  const date = String(row.publishedAt || "");
  if (!id || !Number.isFinite(Date.parse(date))) return null;
  const analytics = object(row.analytics);
  const metrics = Object.fromEntries(
    SOCIAL_METRICS.map(key => [
      key,
      typeof analytics[key] === "number" &&
      Number.isFinite(analytics[key]) &&
      analytics[key] >= 0
        ? analytics[key]
        : null,
    ])
  ) as SocialPostMetrics["metrics"];
  const url = String(row.platformPostUrl || "");
  return {
    id,
    content: String(row.content || "").slice(0, 500),
    platform: String(row.platform || "Multiple platforms"),
    publishedAt: new Date(date).toISOString(),
    ...(url.startsWith("https://") ? { url } : {}),
    metrics,
    updatedAt:
      typeof analytics.lastUpdated === "string" ? analytics.lastUpdated : null,
  };
}
