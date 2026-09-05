import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  SOCIAL_METRICS,
  type SocialAnalyticsResponse,
  type SocialMetric,
} from "@contracts/social-analytics";
import { platformApi } from "@/lib/platform-api";

const COLORS = [
  "#a78bfa",
  "#f472b6",
  "#38bdf8",
  "#2dd4bf",
  "#fbbf24",
  "#fb923c",
  "#4ade80",
  "#e879f9",
];
export function SocialPerformance() {
  const [result, setResult] = useState<SocialAnalyticsResponse | null>(null);
  const [days, setDays] = useState(30);
  const [metrics, setMetrics] = useState<SocialMetric[]>(["views", "likes"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    platformApi
      .socialAnalytics()
      .then(data => {
        if (active) setResult(data);
      })
      .catch(() => {
        if (active) setError("Performance could not load. Try syncing again.");
      });
    return () => {
      active = false;
    };
  }, []);
  async function sync() {
    setBusy(true);
    setError("");
    try {
      setResult(await platformApi.socialAnalytics(true));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Sync failed. Previous results are still shown."
      );
    } finally {
      setBusy(false);
    }
  }
  const data = useMemo(() => {
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    return Array.from({ length: days }, (_, i) => {
      const date = new Date(end);
      date.setUTCDate(date.getUTCDate() - days + 1 + i);
      const day = date.toISOString().slice(0, 10);
      const posts =
        result?.posts.filter(post => post.publishedAt.slice(0, 10) === day) ||
        [];
      return {
        day,
        ...Object.fromEntries(
          SOCIAL_METRICS.map(metric => {
            const known = posts.flatMap(post =>
              post.metrics[metric] === null ? [] : [post.metrics[metric]!]
            );
            return [
              metric,
              known.length ? known.reduce((a, b) => a + b, 0) : null,
            ];
          })
        ),
      };
    });
  }, [days, result]);
  const posts =
    result?.posts
      .filter(
        post =>
          post.publishedAt.slice(0, 10) >= data[0].day &&
          post.publishedAt.slice(0, 10) <= data[data.length - 1].day
      )
      .sort(
        (a, b) => (b.metrics[metrics[0]] ?? -1) - (a.metrics[metrics[0]] ?? -1)
      ) || [];
  return (
    <section className="mb-6 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Social performance</h2>
          <p className="mt-2 text-sm text-foreground/70">
            Lifetime results for posts published in the selected period. Reach
            is summed per post, not deduplicated across people.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            aria-label="Social performance period"
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="rounded-lg border border-border bg-background p-2 text-sm"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
          <button
            type="button"
            onClick={() => void sync()}
            disabled={busy || !result?.configured || !result.connected}
            className="rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Syncing…" : "Sync results"}
          </button>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {SOCIAL_METRICS.map((metric, i) => (
          <button
            type="button"
            key={metric}
            aria-pressed={metrics.includes(metric)}
            onClick={() =>
              setMetrics(current =>
                current.includes(metric)
                  ? current.length > 1
                    ? current.filter(m => m !== metric)
                    : current
                  : [...current, metric]
              )
            }
            className={`rounded-pill border px-3 py-2 text-sm capitalize ${metrics.includes(metric) ? "border-primary/50 bg-primary/10" : "border-border bg-background"}`}
          >
            <span
              className="mr-2 inline-block h-2 w-2 rounded-full"
              style={{ background: COLORS[i] }}
            />
            {metric}
          </button>
        ))}
      </div>
      <div
        className="mt-5 h-60"
        aria-label="Social metrics by publication date"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            accessibilityLayer
            margin={{ left: -15, right: 10 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="currentColor"
              opacity={0.12}
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="day"
              tickFormatter={day => String(day).slice(5)}
              minTickGap={25}
              tick={{ fontSize: 12, fill: "currentColor" }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "currentColor" }}
              domain={[0, "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--background))",
                borderRadius: 12,
              }}
            />
            {metrics.map(metric => (
              <Line
                key={metric}
                dataKey={metric}
                stroke={COLORS[SOCIAL_METRICS.indexOf(metric)]}
                strokeWidth={2.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap gap-5">
        {metrics.map(metric => {
          const values = posts.flatMap(post =>
            post.metrics[metric] === null ? [] : [post.metrics[metric]!]
          );
          return (
            <div key={metric}>
              <p className="text-2xl font-semibold">
                {values.length
                  ? values.reduce((a, b) => a + b, 0).toLocaleString()
                  : "—"}
              </p>
              <p className="text-sm capitalize text-foreground/70">{metric}</p>
            </div>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="mt-4 text-sm text-foreground/70">
        {result?.syncedAt
          ? `Last sync: ${new Date(result.syncedAt).toLocaleString()}. Missing metrics show —. Results can keep growing after publication.`
          : "Connect your accounts and sync to see real results. Missing data is not counted as zero."}
        {result?.partial ? " Showing up to 1,000 recent posts." : ""}
      </p>
      {!result?.connected && (
        <Link
          to="/dashboard/social"
          className="mt-3 inline-block text-sm font-medium text-primary"
        >
          Connect social accounts
        </Link>
      )}
      {posts.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="mb-3 text-left font-medium">
              Top posts by {metrics[0]}
            </caption>
            <thead>
              <tr>
                <th className="py-2">Post</th>
                {metrics.map(metric => (
                  <th className="px-3 capitalize" key={metric}>
                    {metric}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.slice(0, 5).map(post => (
                <tr className="border-t border-border" key={post.id}>
                  <td className="max-w-xs py-3">
                    {post.url ? (
                      <a
                        className="text-primary"
                        href={post.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {post.content.slice(0, 90) || post.platform}
                      </a>
                    ) : (
                      post.content.slice(0, 90) || post.platform
                    )}
                    <p className="text-xs text-foreground/65">
                      {post.publishedAt.slice(0, 10)} · {post.platform}
                    </p>
                  </td>
                  {metrics.map(metric => (
                    <td className="px-3" key={metric}>
                      {post.metrics[metric]?.toLocaleString() ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
