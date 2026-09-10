import type { TrendEvidenceItem, TrendMetrics } from "./trends";

export function performanceFromSource(text: string): TrendMetrics {
  const metrics: TrendMetrics = {
    views: null,
    likes: null,
    comments: null,
    shares: null,
  };
  const amount =
    "([0-9]+(?:[,.][0-9]+)*)(?:\\s*(billion|million|thousand|[kmb]))?";
  for (const key of ["views", "likes", "comments", "shares"] as const) {
    const label =
      key === "views" ? "(?:views?|plays?|visualizzazioni)" : `${key}?`;
    const matches = [
      new RegExp(`${amount}\\s*${label}\\b`, "gi"),
      new RegExp(`\\b${label}\\s*[:=]?\\s*${amount}`, "gi"),
    ];
    for (const regex of matches)
      for (const match of text.matchAll(regex)) {
        const n = Number(match[1].replaceAll(",", ""));
        const suffix = match[2]?.toLowerCase();
        const scale =
          suffix === "b" || suffix === "billion"
            ? 1e9
            : suffix === "m" || suffix === "million"
              ? 1e6
              : suffix === "k" || suffix === "thousand"
                ? 1e3
                : 1;
        if (Number.isFinite(n))
          metrics[key] = Math.max(metrics[key] ?? 0, Math.round(n * scale));
      }
  }
  return metrics;
}

export function balancedTrendSelection(
  items: TrendEvidenceItem[],
  perPlatform = 6
): TrendEvidenceItem[] {
  const rank = (t: TrendEvidenceItem) =>
    Math.max(
      t.metrics.views ?? 0,
      (t.metrics.likes ?? 0) * 10,
      (t.metrics.shares ?? 0) * 50,
      (t.metrics.comments ?? 0) * 100
    );
  const select = (platform: string) => {
    const brands = new Map<string, number>();
    const sources = new Set<string>();
    return items
      .filter(t => t.platform === platform)
      .sort((a, b) => rank(b) - rank(a))
      .filter(t => {
        let source = t.sourceUrl || t.id;
        try {
          const url = new URL(source);
          source = `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
        } catch {
          /* Existing validated IDs remain distinct. */
        }
        if (sources.has(source)) return false;
        const key = t.brandName.toLowerCase().trim();
        const count = brands.get(key) ?? 0;
        if (count >= 2) return false;
        brands.set(key, count + 1);
        sources.add(source);
        return true;
      });
  };
  const reels = select("instagram");
  const tiktoks = select("tiktok");
  const count = Math.min(perPlatform, reels.length, tiktoks.length);
  return Array.from({ length: count }, (_, i) => [reels[i], tiktoks[i]]).flat();
}

export function sourceContainsDate(text: string, iso: string): boolean {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return false;
  if (text.includes(date.toISOString().slice(0, 10))) return true;
  const month = date.toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  return new RegExp(
    `(?:${month}[a-z]*\\s+0?${day}(?:st|nd|rd|th)?[,]?\\s+${year}|0?${day}\\s+${month}[a-z]*[,]?\\s+${year})`,
    "i"
  ).test(text);
}
