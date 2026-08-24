import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Film,
  Radio,
  Send,
} from "lucide-react";
import type { Platform } from "@contracts/workspace";
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

export default function AnalyticsPage() {
  const { workspace, capabilities, loading } = useWorkspace();

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
            className="rounded-xl border border-border bg-surface p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="mono-eyebrow text-[10px] text-foreground/45">
                {kpi.label}
              </p>
              <kpi.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-3xl font-semibold tabular-nums">{kpi.value}</p>
            <p className="mt-1 text-xs text-foreground/45">{kpi.detail}</p>
          </article>
        ))}
      </div>

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
