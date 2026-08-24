export type TrendPlatform = "tiktok" | "instagram" | "youtube";

export type TrendLifecycle =
  | "seed"
  | "emerging"
  | "breakout"
  | "mainstream"
  | "saturated"
  | "decaying";

export interface TrendMetrics {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

export interface TrendEvidenceItem {
  id: string;
  platform: TrendPlatform;
  title: string;
  creator: string;
  sourceUrl: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  observedAt: string;
  niche: string;
  region: string;
  language: string;
  hook: string;
  pattern: string;
  lifecycle: TrendLifecycle;
  confidence: number;
  metrics: TrendMetrics;
  evidence: string[];
  hypothesis: string;
  adaptation: string;
  passSignal: string;
}

export interface TrendScope {
  query: string;
  platform: "all" | TrendPlatform;
  region: string;
  language: string;
}

export interface TrendFeedResponse {
  trends: TrendEvidenceItem[];
  generatedAt: string;
  nextRefreshAt: string;
  freshness: "live" | "cached";
  scope: TrendScope;
  creditCost: number;
  availableCredits: number;
  starterCredits: number;
  cacheNote: string;
}

