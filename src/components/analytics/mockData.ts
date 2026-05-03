// Mock data for the Analytics agent.

export type Platform = "instagram" | "tiktok" | "youtube" | "facebook" | "linkedin";

export type PlatformMeta = {
  id: Platform;
  name: string;
  color: string; // hsl
};

export const PLATFORMS: PlatformMeta[] = [
  { id: "instagram", name: "Instagram", color: "330 80% 60%" },
  { id: "tiktok", name: "TikTok", color: "200 90% 55%" },
  { id: "youtube", name: "YouTube", color: "0 75% 55%" },
  { id: "facebook", name: "Facebook", color: "220 80% 55%" },
  { id: "linkedin", name: "LinkedIn", color: "210 65% 40%" },
];

export type Range = "7d" | "30d" | "90d";

export type Kpi = {
  label: string;
  value: string;
  delta: number; // percent vs prev
  spark: number[];
};

export const KPIS: Record<Range, Kpi[]> = {
  "7d": [
    { label: "Views", value: "284,712", delta: 18.4, spark: [12, 18, 14, 22, 28, 24, 38] },
    { label: "Engagement rate", value: "7.2%", delta: 1.1, spark: [5.8, 6.1, 6.4, 6.7, 7.0, 7.1, 7.2] },
    { label: "Followers gained", value: "1,847", delta: 32.6, spark: [120, 180, 210, 240, 280, 310, 340] },
    { label: "Avg watch time", value: "11.4s", delta: -2.3, spark: [13, 12.5, 12, 11.8, 11.6, 11.5, 11.4] },
  ],
  "30d": [
    { label: "Views", value: "1.12M", delta: 24.1, spark: [40, 55, 48, 72, 85, 92, 110] },
    { label: "Engagement rate", value: "6.8%", delta: 0.4, spark: [6.2, 6.4, 6.5, 6.6, 6.7, 6.8, 6.8] },
    { label: "Followers gained", value: "7,213", delta: 41.2, spark: [400, 520, 610, 720, 850, 1100, 1400] },
    { label: "Avg watch time", value: "12.1s", delta: 4.7, spark: [10.8, 11.2, 11.5, 11.7, 11.9, 12.0, 12.1] },
  ],
  "90d": [
    { label: "Views", value: "3.47M", delta: 51.8, spark: [120, 180, 210, 280, 340, 410, 520] },
    { label: "Engagement rate", value: "6.4%", delta: 1.8, spark: [4.8, 5.2, 5.5, 5.9, 6.1, 6.3, 6.4] },
    { label: "Followers gained", value: "21,604", delta: 67.4, spark: [1200, 1800, 2400, 3100, 4200, 5300, 6800] },
    { label: "Avg watch time", value: "11.7s", delta: 8.2, spark: [9.8, 10.2, 10.6, 10.9, 11.2, 11.5, 11.7] },
  ],
};

export type SeriesPoint = { x: number; y: number };

export function buildPlatformSeries(platform: Platform, range: Range): SeriesPoint[] {
  const len = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const seed = platform.length * 7;
  const points: SeriesPoint[] = [];
  for (let i = 0; i < len; i++) {
    const trend = i * (0.8 + (seed % 5) / 10);
    const wave = Math.sin(i / 3 + seed) * 12;
    const noise = ((Math.cos(i * 1.3 + seed * 0.7) + 1) / 2) * 18;
    points.push({ x: i, y: Math.max(2, trend + wave + noise + 12) });
  }
  return points;
}

export type PostRow = {
  id: string;
  thumb: string;
  title: string;
  platform: Platform;
  publishedAt: string; // relative
  views: number;
  engagement: number; // %
  watchPct: number; // 0..1 retention through full clip
  predictionDelta: number; // % over predicted score
};

export const POSTS: PostRow[] = [
  { id: "p1", thumb: "🍕", title: "The contrarian — v1",       platform: "tiktok",    publishedAt: "2d ago",  views: 184_200, engagement: 9.4, watchPct: 0.78, predictionDelta: 12 },
  { id: "p2", thumb: "🥖", title: "72-hour dough reveal",       platform: "instagram", publishedAt: "3d ago",  views: 92_410,  engagement: 7.8, watchPct: 0.71, predictionDelta: 4 },
  { id: "p3", thumb: "🔥", title: "Wood-fired in 90 seconds",   platform: "youtube",   publishedAt: "5d ago",  views: 41_230,  engagement: 5.2, watchPct: 0.62, predictionDelta: -8 },
  { id: "p4", thumb: "👨‍🍳", title: "Marco answers your DMs",   platform: "tiktok",    publishedAt: "6d ago",  views: 67_840,  engagement: 8.1, watchPct: 0.74, predictionDelta: 18 },
  { id: "p5", thumb: "🍅", title: "The San Marzano question",   platform: "instagram", publishedAt: "8d ago",  views: 34_120,  engagement: 6.4, watchPct: 0.59, predictionDelta: -2 },
  { id: "p6", thumb: "🧀", title: "Why we stopped using fior di latte", platform: "linkedin", publishedAt: "10d ago", views: 8_240, engagement: 4.1, watchPct: 0.48, predictionDelta: -15 },
  { id: "p7", thumb: "⏱️", title: "POV: 72-hour wait",           platform: "tiktok",    publishedAt: "12d ago", views: 312_700, engagement: 11.2, watchPct: 0.82, predictionDelta: 27 },
  { id: "p8", thumb: "🍷", title: "Pairing night — recap",       platform: "facebook",  publishedAt: "14d ago", views: 12_840,  engagement: 5.8, watchPct: 0.55, predictionDelta: -4 },
];

export type Insight = {
  id: string;
  kind: "win" | "warn" | "idea";
  title: string;
  body: string;
};

export const INSIGHTS: Insight[] = [
  {
    id: "i1",
    kind: "win",
    title: "POV-style hooks outperform by 34%",
    body: "Your last 4 first-person POV opens averaged 11.2% engagement vs 7.0% baseline. The model suggests doubling down for the next 2 weeks.",
  },
  {
    id: "i2",
    kind: "warn",
    title: "LinkedIn watch-through is bleeding at 6s",
    body: "Three of four LinkedIn posts dropped below 50% retention at the 6s mark. Try moving the value claim earlier and removing the brand intro.",
  },
  {
    id: "i3",
    kind: "idea",
    title: "Tuesday 19:00 is your TikTok peak",
    body: "Posts shipped Tue 18:30–19:30 are getting 2.1× the reach of other slots. The Publisher can auto-schedule there.",
  },
];
