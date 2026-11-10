import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  AtSign,
  BarChart3,
  CalendarDays,
  ChartLine,
  FileText,
  Library,
  Scissors,
} from "lucide-react";
import type { WorkspaceDocument } from "@contracts/workspace";
import { MomentumCalendar } from "./MomentumCalendar";
import { StudioSelect } from "@/components/ui/studio-select";
import { formatMinutesDuration } from "@/lib/format-duration";
import { getUiLocale, useUiText } from "@/lib/i18n/ui";
import {
  buildMomentumSeries,
  summarizeWeeklyProgress,
  type MomentumMetric,
} from "@/lib/workspace-progress";

const CHART_TYPES = [
  { key: "bars", label: "Bar chart", icon: BarChart3 },
  { key: "line", label: "Line chart", icon: ChartLine },
  { key: "calendar", label: "Activity calendar", icon: CalendarDays },
] as const;

export function WorkspaceMomentum({
  workspace,
  now,
}: {
  workspace: WorkspaceDocument;
  now: number;
}) {
  const ui = useUiText();
  const locale = getUiLocale();
  const [metric, setMetric] = useState<MomentumMetric>("actions");
  const [days, setDays] = useState(7);
  const [chartType, setChartType] =
    useState<(typeof CHART_TYPES)[number]["key"]>("bars");
  const weekly = useMemo(
    () => summarizeWeeklyProgress(workspace, new Date(now)),
    [workspace, now]
  );
  const series = useMemo(
    () => buildMomentumSeries(workspace, days, new Date(now)),
    [workspace, days, now]
  );
  const metricLabels = {
    actions: ui("Recorded actions"),
    published: ui("Published posts"),
    assets: ui("Created media"),
  };
  const total = series.reduce((sum, point) => sum + point[metric], 0);
  const maximum = Math.max(1, ...series.map(point => point[metric]));
  const chartWidth = 800;
  const chartHeight = 96;
  const step = chartWidth / series.length;
  const coordinates = series.map((point, index) => ({
    x: step * (index + 0.5),
    y: chartHeight - (point[metric] / maximum) * 80,
  }));
  const line = coordinates.map(point => `${point.x},${point.y}`).join(" ");
  const formatDay = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  const stats = [
    {
      label: "Editing projects",
      value: workspace.projects.length,
      detail: ui("Edits in progress: {{count}}", {
        count: workspace.projects.filter(project =>
          ["draft", "editing", "review"].includes(project.status)
        ).length,
      }),
      icon: Scissors,
      to: "/dashboard/edit",
    },
    {
      label: "Media assets",
      value: workspace.assets.length,
      detail: ui("Stored in your private library"),
      icon: Library,
      to: "/dashboard/library",
    },
    {
      label: "Published posts",
      value: weekly.published,
      detail: ui("Last 7 days · UTC"),
      icon: FileText,
      to: "/dashboard/analytics",
    },
    {
      label: "Connected accounts",
      value: workspace.accounts.filter(
        account => account.status === "connected"
      ).length,
      detail: ui("Publishing destinations"),
      icon: AtSign,
      to: "/dashboard/social",
    },
  ];

  return (
    <section
      className="my-8 border-y border-border py-6"
      aria-labelledby="weekly-momentum-title"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            id="weekly-momentum-title"
            className="flex items-center gap-2 text-base font-semibold"
          >
            <Activity className="h-4 w-4 text-primary" aria-hidden />
            {ui("Weekly momentum")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {ui(
              "A little progress, made visible. Your last 7 calendar days in UTC."
            )}
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-7 gap-y-2 text-xs">
          <div>
            <dt className="text-muted-foreground">{ui("Recorded actions")}</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums">
              {weekly.actions.toLocaleString(locale)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{ui("Active days")}</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums">
              {weekly.activeDays}{" "}
              <span className="font-normal text-muted-foreground">/ 7</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {ui("Time reclaimed · estimate")}
            </dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-primary">
              {formatMinutesDuration(weekly.estimatedMinutesSaved, locale)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-surface lg:grid-cols-4">
        {stats.map(stat => (
          <Link
            key={stat.to}
            to={stat.to}
            className="group border-b border-border p-4 transition-colors hover:bg-primary/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&:nth-child(odd)]:border-r [&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0 lg:[&:not(:last-child)]:border-r"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {ui(stat.label)}
              </span>
              <stat.icon
                className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary"
                aria-hidden
              />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {stat.value.toLocaleString(locale)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.detail}</p>
          </Link>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          <strong className="font-medium tabular-nums text-foreground">
            {total.toLocaleString(locale)}
          </strong>{" "}
          {metricLabels[metric].toLocaleLowerCase(locale)}{" "}
          <span className="mx-1">·</span>{" "}
          {ui("{{count}} days", { count: days })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <StudioSelect
            aria-label={ui("Momentum metric")}
            value={metric}
            onChange={event => setMetric(event.target.value as MomentumMetric)}
            className="h-8 w-[156px] rounded-lg text-xs"
          >
            <option value="actions">{metricLabels.actions}</option>
            <option value="published">{metricLabels.published}</option>
            <option value="assets">{metricLabels.assets}</option>
          </StudioSelect>
          <StudioSelect
            aria-label={ui("Momentum time range")}
            value={days}
            onChange={event => setDays(Number(event.target.value))}
            className="h-8 w-[94px] rounded-lg text-xs"
          >
            {[7, 14, 30].map(count => (
              <option key={count} value={count}>
                {ui("{{count}} days", { count })}
              </option>
            ))}
          </StudioSelect>
          <div
            className="flex rounded-lg border border-border p-0.5"
            role="group"
            aria-label={ui("Chart type")}
          >
            {CHART_TYPES.map(type => (
              <button
                key={type.key}
                type="button"
                title={ui(type.label)}
                aria-label={ui(type.label)}
                aria-pressed={chartType === type.key}
                onClick={() => setChartType(type.key)}
                className={`rounded-md p-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${chartType === type.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
              >
                <type.icon className="h-3.5 w-3.5" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>
      <figure className="mt-3" aria-label={`${metricLabels[metric]}: ${total}`}>
        {chartType === "calendar" ? (
          <MomentumCalendar
            series={series}
            metric={metric}
            label={metricLabels[metric]}
          />
        ) : (
          <>
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight + 2}`}
              className="h-28 w-full overflow-visible text-primary"
              preserveAspectRatio="none"
              role="img"
              aria-label={ui("Daily workspace activity chart")}
            >
              <title>{metricLabels[metric]}</title>
              {[0, 0.5, 1].map(ratio => (
                <line
                  key={ratio}
                  x1={0}
                  x2={chartWidth}
                  y1={chartHeight - ratio * 80}
                  y2={chartHeight - ratio * 80}
                  stroke="currentColor"
                  strokeOpacity={ratio === 0 ? 0.2 : 0.07}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {chartType !== "bars" && total > 0 ? (
                <polyline
                  points={line}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {series.map((point, index) =>
                chartType === "bars" ? (
                  <rect
                    key={point.date}
                    x={coordinates[index].x - step * 0.27}
                    y={coordinates[index].y}
                    width={step * 0.54}
                    height={chartHeight - coordinates[index].y}
                    rx={2}
                    fill="currentColor"
                    fillOpacity={0.6}
                  >
                    <title>
                      {formatDay(point.date)}: {point[metric]}
                    </title>
                  </rect>
                ) : (
                  <circle
                    key={point.date}
                    cx={coordinates[index].x}
                    cy={coordinates[index].y}
                    r={point[metric] ? 2 : 0}
                    fill="currentColor"
                  >
                    <title>
                      {formatDay(point.date)}: {point[metric]}
                    </title>
                  </circle>
                )
              )}
            </svg>
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>{formatDay(series[0].date)}</span>
              <span>
                {total === 0
                  ? ui("No records in this period")
                  : ui("Daily records · UTC")}
              </span>
              <span>{formatDay(series.at(-1)!.date)}</span>
            </div>
          </>
        )}
        <figcaption className="sr-only">
          <table>
            <caption>{metricLabels[metric]}</caption>
            <thead>
              <tr>
                <th>{ui("Date")}</th>
                <th>{ui("Count")}</th>
              </tr>
            </thead>
            <tbody>
              {series.map(point => (
                <tr key={point.date}>
                  <td>{formatDay(point.date)}</td>
                  <td>{point[metric]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figcaption>
      </figure>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
          {ui(
            "Time estimate: 18 min per completed image/video generation, analysis or transcription; 12 min per generated script. A planning assumption, not measured time saved. Activity reflects retained workspace records."
          )}
        </p>
        <Link
          to="/dashboard/analytics"
          className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          {ui("View analytics")}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
