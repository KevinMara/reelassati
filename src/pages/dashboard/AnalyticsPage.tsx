import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  FileText,
  Film,
  ImageIcon,
  Radio,
  Send,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { Platform } from "@contracts/workspace";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  analyticsMetricTotal,
  buildAnalyticsSeries,
  type AnalyticsMetricKey,
} from "@/lib/analytics";
import { useWorkspace } from "@/providers/workspace";

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  twitter: "X / Twitter",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  threads: "Threads",
};

const ANALYTICS_METRICS: Array<{
  key: AnalyticsMetricKey;
  label: string;
  shortLabel: string;
  color: string;
  icon: LucideIcon;
}> = [
  {
    key: "published",
    label: "Published posts",
    shortLabel: "Published",
    color: "hsl(var(--primary))",
    icon: Send,
  },
  {
    key: "scheduled",
    label: "Scheduled posts",
    shortLabel: "Scheduled",
    color: "#f59e0b",
    icon: CalendarClock,
  },
  {
    key: "assets",
    label: "Created media",
    shortLabel: "Media",
    color: "#10b981",
    icon: ImageIcon,
  },
  {
    key: "scripts",
    label: "Created scripts",
    shortLabel: "Scripts",
    color: "#38bdf8",
    icon: FileText,
  },
  {
    key: "projects",
    label: "Started edits",
    shortLabel: "Edits",
    color: "#f472b6",
    icon: Film,
  },
];

const ANALYTICS_CHART_CONFIG = Object.fromEntries(
  ANALYTICS_METRICS.map(metric => [
    metric.key,
    { label: metric.label, color: metric.color },
  ])
) as ChartConfig;

const ANALYTICS_RANGES = [
  { days: 7, label: "7D" },
  { days: 14, label: "14D" },
  { days: 30, label: "30D" },
  { days: 90, label: "90D" },
] as const;

export default function AnalyticsPage() {
  const { workspace, capabilities, loading } = useWorkspace();
  const [selectedMetrics, setSelectedMetrics] = useState<AnalyticsMetricKey[]>([
    "published",
    "scheduled",
    "assets",
  ]);
  const [rangeDays, setRangeDays] = useState(14);

  const chartSeries = useMemo(
    () => buildAnalyticsSeries(workspace, rangeDays),
    [rangeDays, workspace]
  );
  const metricTotals = useMemo(
    () =>
      ANALYTICS_METRICS.reduce(
        (totals, metric) => {
          totals[metric.key] = analyticsMetricTotal(chartSeries, metric.key);
          return totals;
        },
        {} as Record<AnalyticsMetricKey, number>
      ),
    [chartSeries]
  );
  const selectedTotal = selectedMetrics.reduce(
    (total, metric) => total + metricTotals[metric],
    0
  );

  const toggleMetric = (metric: AnalyticsMetricKey) => {
    setSelectedMetrics(current => {
      if (!current.includes(metric)) return [...current, metric];
      return current.length === 1
        ? current
        : current.filter(item => item !== metric);
    });
  };

  const publishedPosts = useMemo(
    () =>
      workspace.posts.filter(
        post => post.status === "published" || Boolean(post.publishedAt)
      ),
    [workspace.posts]
  );
  const scheduledPosts = useMemo(
    () => workspace.posts.filter(post => post.status === "scheduled"),
    [workspace.posts]
  );
  const activeProjects = useMemo(
    () =>
      workspace.projects.filter(
        project =>
          project.status === "editing" ||
          project.status === "review" ||
          project.status === "draft"
      ),
    [workspace.projects]
  );
  const readyAssets = useMemo(
    () => workspace.assets.filter(asset => asset.status === "ready"),
    [workspace.assets]
  );

  const platformRows = useMemo(() => {
    const totals = new Map<
      Platform,
      {
        platform: Platform;
        drafts: number;
        scheduled: number;
        published: number;
      }
    >();
    for (const post of workspace.posts) {
      for (const platform of post.platforms) {
        const row = totals.get(platform) || {
          platform,
          drafts: 0,
          scheduled: 0,
          published: 0,
        };
        if (post.status === "published" || post.publishedAt) row.published += 1;
        else if (post.status === "scheduled") row.scheduled += 1;
        else if (post.status === "draft") row.drafts += 1;
        totals.set(platform, row);
      }
    }
    return Array.from(totals.values()).sort(
      (left, right) =>
        right.published +
        right.scheduled +
        right.drafts -
        (left.published + left.scheduled + left.drafts)
    );
  }, [workspace.posts]);

  const publicationHistory = useMemo(
    () =>
      [...publishedPosts]
        .sort((left, right) =>
          (right.publishedAt || right.createdAt).localeCompare(
            left.publishedAt || left.createdAt
          )
        )
        .slice(0, 8),
    [publishedPosts]
  );

  if (loading) {
    return <div className="min-h-[45vh] animate-pulse rounded-xl bg-surface" />;
  }

  const kpis = [
    {
      label: "Active edits",
      value: activeProjects.length,
      detail: `${workspace.projects.length} total projects`,
      icon: Film,
    },
    {
      label: "Ready assets",
      value: readyAssets.length,
      detail: `${workspace.assets.length} stored assets`,
      icon: CheckCircle2,
    },
    {
      label: "Scheduled",
      value: scheduledPosts.length,
      detail: "Saved to the publishing queue",
      icon: CalendarClock,
    },
    {
      label: "Published records",
      value: publishedPosts.length,
      detail: "Recorded by this workspace",
      icon: Send,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <p className="mono-eyebrow mb-2 text-primary">Measured workspace</p>
        <h1 className="text-3xl font-semibold">Analytics</h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground/55">
          Production and publication facts currently stored in REELassati.
          Reach, retention, and engagement are never estimated.
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(kpi => (
          <article
            key={kpi.label}
            className="group relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/[0.06]"
          >
            <div className="pointer-events-none absolute -right-10 -top-12 h-24 w-24 rounded-full bg-primary/[0.06] blur-2xl transition group-hover:bg-primary/[0.11]" />
            <div className="mb-4 flex items-center justify-between">
              <p className="mono-eyebrow text-[10px] text-foreground/45">
                {kpi.label}
              </p>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/[0.08] text-primary transition group-hover:scale-105 group-hover:bg-primary/[0.13]">
                <kpi.icon className="h-4 w-4" />
              </span>
            </div>
            <p className="relative text-3xl font-semibold tabular-nums">
              {kpi.value}
            </p>
            <p className="mt-1 text-xs text-foreground/45">{kpi.detail}</p>
          </article>
        ))}
      </div>

      <section className="relative mb-6 overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.09] via-surface to-surface p-5 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/[0.12] blur-3xl" />
        <div className="relative mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <p className="mono-eyebrow text-[10px] text-primary">
                Output momentum
              </p>
            </div>
            <h2 className="mt-2 text-lg font-medium">
              Your last {rangeDays} days
            </h2>
            <p className="mt-1 text-xs text-foreground/45">
              Toggle one metric or compare several. Every point comes from your
              saved workspace records.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex rounded-xl border border-border/70 bg-background/55 p-1 backdrop-blur"
              role="group"
              aria-label="Analytics time range"
            >
              {ANALYTICS_RANGES.map(range => {
                const selected = rangeDays === range.days;
                return (
                  <button
                    key={range.days}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setRangeDays(range.days)}
                    className={`rounded-lg px-2.5 py-1.5 font-mono text-[10px] font-medium transition duration-200 ${
                      selected
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                        : "text-foreground/45 hover:bg-surface hover:text-foreground/75"
                    }`}
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>
            <div className="rounded-xl border border-primary/15 bg-background/70 px-4 py-2.5 text-right backdrop-blur">
              <p className="text-2xl font-semibold tabular-nums text-primary">
                {selectedTotal}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-foreground/40">
                selected output
              </p>
            </div>
          </div>
        </div>

        <div
          className="relative mb-5 flex flex-wrap gap-2"
          role="group"
          aria-label="Chart metrics"
        >
          {ANALYTICS_METRICS.map(metric => {
            const selected = selectedMetrics.includes(metric.key);
            const isOnlySelection = selected && selectedMetrics.length === 1;
            return (
              <button
                key={metric.key}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleMetric(metric.key)}
                title={
                  isOnlySelection
                    ? "Keep at least one metric selected"
                    : `${selected ? "Hide" : "Show"} ${metric.label.toLowerCase()}`
                }
                className={`group/metric inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition duration-200 hover:-translate-y-px ${
                  selected
                    ? "border-primary/20 bg-background text-foreground shadow-sm"
                    : "border-border/70 bg-background/35 text-foreground/45 hover:border-border hover:text-foreground/70"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full transition ${selected ? "scale-110 shadow-[0_0_10px_currentColor]" : "opacity-45"}`}
                  style={{ backgroundColor: metric.color, color: metric.color }}
                />
                {metric.shortLabel}
                <span
                  className={`font-mono text-[10px] tabular-nums ${selected ? "text-foreground/50" : "text-foreground/30"}`}
                >
                  {metricTotals[metric.key]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative rounded-xl border border-border/70 bg-background/70 p-2 shadow-inner backdrop-blur sm:p-4">
          <ChartContainer
            config={ANALYTICS_CHART_CONFIG}
            className="h-[300px] w-full aspect-auto"
          >
            <LineChart
              accessibilityLayer
              data={chartSeries}
              margin={{ top: 12, right: 12, left: -12, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 6" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <ChartTooltip
                cursor={{
                  stroke: "hsl(var(--foreground) / 0.16)",
                  strokeDasharray: "4 4",
                }}
                content={<ChartTooltipContent indicator="line" />}
              />
              {selectedMetrics.map(metric => (
                <Line
                  key={metric}
                  type="monotone"
                  dataKey={metric}
                  stroke={`var(--color-${metric})`}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{
                    r: 5,
                    strokeWidth: 2,
                    fill: "hsl(var(--background))",
                  }}
                  isAnimationActive
                  animationDuration={650}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <h2 className="font-medium">Audience metrics are not synced yet</h2>
            <p className="mt-1 text-sm leading-relaxed text-foreground/55">
              {capabilities.publishing
                ? "Connected distribution is ready, but account-level views, watch time, retention, and engagement are not yet imported into this workspace."
                : "Publishing is not connected, and no platform analytics source is available."}{" "}
              This screen will not manufacture performance numbers.
            </p>
            <Link
              to="/dashboard/social"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
            >
              <Radio className="h-4 w-4" />
              Review publishing connections
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-6">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="mono-eyebrow text-[10px] text-foreground/45">
                Distribution footprint
              </p>
              <h2 className="mt-1 font-medium">Posts by platform</h2>
            </div>
            <span className="text-xs text-foreground/40">
              Workspace records only
            </span>
          </div>
          {platformRows.length ? (
            <div className="space-y-3">
              {platformRows.map(row => {
                const total = row.drafts + row.scheduled + row.published;
                return (
                  <div
                    key={row.platform}
                    className="rounded-lg border border-border bg-background p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {PLATFORM_LABELS[row.platform]}
                      </p>
                      <span className="font-mono text-xs text-foreground/45">
                        {total} {total === 1 ? "post" : "posts"}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-foreground/40">
                          Draft
                        </dt>
                        <dd className="mt-1 text-sm font-semibold">
                          {row.drafts}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-foreground/40">
                          Scheduled
                        </dt>
                        <dd className="mt-1 text-sm font-semibold">
                          {row.scheduled}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-foreground/40">
                          Published
                        </dt>
                        <dd className="mt-1 text-sm font-semibold">
                          {row.published}
                        </dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm font-medium">
                No platform distribution data yet
              </p>
              <p className="mt-1 text-xs text-foreground/45">
                Saving a draft with a connected account will create the first
                record.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-6">
          <div className="mb-5">
            <p className="mono-eyebrow text-[10px] text-foreground/45">
              Verified output
            </p>
            <h2 className="mt-1 font-medium">Publication history</h2>
          </div>
          {publicationHistory.length ? (
            <div className="space-y-3">
              {publicationHistory.map(post => (
                <article
                  key={post.id}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <p className="line-clamp-2 text-sm font-medium">
                    {post.caption.trim() || "Untitled publication"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/45">
                    <span>
                      {post.platforms
                        .map(platform => PLATFORM_LABELS[platform])
                        .join(", ") || "No platform recorded"}
                    </span>
                    <time dateTime={post.publishedAt || post.createdAt}>
                      {new Date(
                        post.publishedAt || post.createdAt
                      ).toLocaleDateString()}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm font-medium">
                Nothing has been recorded as published
              </p>
              <p className="mt-1 text-xs text-foreground/45">
                Publishing history will appear after a real distribution action.
              </p>
              <Link
                to="/dashboard/publish"
                className="mt-4 inline-flex text-sm font-medium text-primary"
              >
                Open Publisher
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
