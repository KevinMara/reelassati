export type TrendPlatform = "tiktok" | "instagram" | "youtube";

export type TrendLifecycle =
  "seed" | "emerging" | "breakout" | "mainstream" | "saturated" | "decaying";

export type TrendContentType =
  | "overall"
  | "creator-led"
  | "product-demo"
  | "educational"
  | "faceless"
  | "ugc"
  | "storytelling";

export type TrendObjective =
  "overall" | "reach" | "engagement" | "retention" | "conversion";

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
  brandName: string;
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
  organicEvidence: string;
  viralityEvidence: string;
  hypothesis: string;
  adaptation: string;
  passSignal: string;
}

export interface TrendScope {
  query: string;
  platform: "all" | TrendPlatform;
  contentType: TrendContentType;
  objective: TrendObjective;
  region: string;
  language: string;
}

export interface TrendFeedResponse {
  trends: TrendEvidenceItem[];
  generatedAt: string;
  nextRefreshAt: string;
  freshness: "live" | "cached";
  kind: "weekly" | "custom";
  status: "ready" | "preparing";
  scope: TrendScope;
  creditCost: number;
  availableCredits: number;
  cacheNote: string;
}
