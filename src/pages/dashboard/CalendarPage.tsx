import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Send,
} from "lucide-react";
import type { Platform, ScheduledPost } from "@contracts/workspace";
import { useWorkspace } from "@/providers/workspace";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const PLATFORM_META: Record<Platform, { label: string; dot: string }> = {
  tiktok: { label: "TikTok", dot: "bg-slate-950" },
  instagram: { label: "Instagram", dot: "bg-pink-500" },
  youtube: { label: "YouTube", dot: "bg-red-600" },
  twitter: { label: "X / Twitter", dot: "bg-slate-600" },
  facebook: { label: "Facebook", dot: "bg-blue-600" },
  linkedin: { label: "LinkedIn", dot: "bg-blue-700" },
  pinterest: { label: "Pinterest", dot: "bg-red-700" },
  threads: { label: "Threads", dot: "bg-zinc-700" },
};

function dateKey(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const valueFor = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value || "";
  return `${valueFor("year")}-${valueFor("month")}-${valueFor("day")}`;
}

function timeLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function postDate(post: ScheduledPost) {
  return post.scheduledAt || post.publishedAt;
}

function postTitle(post: ScheduledPost) {
  const trimmed = post.caption.trim();
  if (!trimmed) return "Untitled publication";
  return trimmed.length > 58 ? `${trimmed.slice(0, 58)}…` : trimmed;
}

export default function CalendarPage() {
  const { workspace, loading } = useWorkspace();
  const [openedAt] = useState(() => Date.now());
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | ScheduledPost["status"]
  >("all");
  const [platformFilter, setPlatformFilter] = useState<"all" | Platform>("all");

  const timeZone = workspace.profile.timezone || "UTC";
  const todayKey = dateKey(new Date().toISOString(), timeZone);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const datedPosts = useMemo(
    () =>
      workspace.posts.filter(post => {
        if (!postDate(post)) return false;
        if (statusFilter !== "all" && post.status !== statusFilter)
          return false;
        return (
          platformFilter === "all" || post.platforms.includes(platformFilter)
        );
      }),
    [platformFilter, statusFilter, workspace.posts]
  );

  const postsByDate = useMemo(() => {
    const map = new Map<string, ScheduledPost[]>();
    for (const post of datedPosts) {
      const value = postDate(post);
      if (!value) continue;
      const key = dateKey(value, timeZone);
      map.set(key, [...(map.get(key) || []), post]);
    }
    for (const posts of map.values()) {
      posts.sort((left, right) =>
        (postDate(left) || "").localeCompare(postDate(right) || "")
      );
    }
    return map;
  }, [datedPosts, timeZone]);

  const availablePlatforms = useMemo(
    () =>
      Array.from(
        new Set(workspace.posts.flatMap(post => post.platforms))
      ).sort(),
    [workspace.posts]
  );

  const selectedPosts = selectedDate ? postsByDate.get(selectedDate) || [] : [];
  const upcoming = useMemo(
    () =>
      datedPosts
        .filter(post => {
          const value = postDate(post);
          return value ? new Date(value).getTime() >= openedAt : false;
        })
        .sort((left, right) =>
          (postDate(left) || "").localeCompare(postDate(right) || "")
        )
        .slice(0, 5),
    [datedPosts, openedAt]
  );

  const getDateKey = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const moveMonth = (direction: -1 | 1) => {
    setCurrentDate(new Date(year, month + direction, 1));
    setSelectedDate(null);
  };

  if (loading) {
    return <div className="min-h-[45vh] animate-pulse rounded-xl bg-surface" />;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mono-eyebrow mb-2 text-primary">Distribution queue</p>
          <h1 className="text-3xl font-semibold">Content Calendar</h1>
          <p className="mt-2 text-sm text-foreground/55">
            Real publication drafts and scheduled posts in {timeZone}.
          </p>
        </div>
        <Link
          to="/dashboard/publish"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <Send className="h-4 w-4" /> Compose or schedule
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={event =>
            setStatusFilter(
              event.target.value as "all" | ScheduledPost["status"]
            )
          }
          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium"
          aria-label="Filter by publication status"
        >
          <option value="all">All dated posts</option>
          <option value="draft">Dated drafts</option>
          <option value="scheduled">Scheduled</option>
          <option value="publishing">Publishing</option>
          <option value="published">Published</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={platformFilter}
          onChange={event =>
            setPlatformFilter(event.target.value as "all" | Platform)
          }
          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium"
          aria-label="Filter by platform"
        >
          <option value="all">All platforms</option>
          {availablePlatforms.map(platform => (
            <option key={platform} value={platform}>
              {PLATFORM_META[platform].label}
            </option>
          ))}
        </select>
        <span className="self-center text-xs text-foreground/40">
          Undated drafts stay in Publisher until scheduled.
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-6 lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {MONTHS[month]} {year}
            </h2>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="rounded-lg p-2 hover:bg-background"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setCurrentDate(
                    new Date(now.getFullYear(), now.getMonth(), 1)
                  );
                  setSelectedDate(todayKey);
                }}
                className="rounded-lg px-3 py-2 text-xs font-medium hover:bg-background"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="rounded-lg p-2 hover:bg-background"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DAYS.map(day => (
              <div
                key={day}
                className="py-2 text-center text-[10px] uppercase tracking-wider text-foreground/40 sm:text-xs"
              >
                {day}
              </div>
            ))}
            {Array.from({ length: firstDay }, (_, index) => (
              <div key={`empty-${index}`} className="min-h-16 sm:min-h-24" />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const key = getDateKey(day);
              const posts = postsByDate.get(key) || [];
              const isSelected = selectedDate === key;
              const isToday = todayKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(isSelected ? null : key)}
                  aria-label={`${MONTHS[month]} ${day}, ${year}: ${posts.length} posts`}
                  className={`min-h-16 rounded-lg border p-1.5 text-left transition-colors sm:min-h-24 sm:p-2 ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : isToday
                        ? "border-primary/30 bg-primary/5"
                        : "border-transparent hover:border-border hover:bg-background"
                  }`}
                >
                  <span
                    className={`text-xs font-medium sm:text-sm ${
                      isToday ? "text-primary" : ""
                    }`}
                  >
                    {day}
                  </span>
                  {posts.length ? (
                    <div className="mt-2 space-y-1">
                      {posts.slice(0, 2).map(post => (
                        <div
                          key={post.id}
                          className="flex items-center gap-1 rounded bg-background/80 px-1.5 py-1"
                        >
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              PLATFORM_META[post.platforms[0] || "instagram"]
                                .dot
                            }`}
                          />
                          <span className="hidden truncate text-[9px] text-foreground/60 sm:block">
                            {postTitle(post)}
                          </span>
                        </div>
                      ))}
                      {posts.length > 2 ? (
                        <p className="text-[9px] text-foreground/40">
                          +{posts.length - 2} more
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-medium">
                {selectedDate
                  ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                      undefined,
                      { weekday: "long", month: "long", day: "numeric" }
                    )
                  : "Upcoming queue"}
              </h2>
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            {(selectedDate ? selectedPosts : upcoming).length ? (
              <div className="space-y-3">
                {(selectedDate ? selectedPosts : upcoming).map(post => {
                  const value = postDate(post);
                  return (
                    <article
                      key={post.id}
                      className="rounded-lg border border-border bg-background p-3"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        {post.platforms.map(platform => (
                          <span
                            key={platform}
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-foreground/55"
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${PLATFORM_META[platform].dot}`}
                            />
                            {PLATFORM_META[platform].label}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-sm font-medium">
                        {postTitle(post)}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide">
                        <span
                          className={
                            post.status === "failed"
                              ? "text-red-500"
                              : post.status === "published"
                                ? "text-emerald-500"
                                : "text-primary"
                          }
                        >
                          {post.status}
                        </span>
                        {value ? (
                          <span className="flex items-center gap-1 text-foreground/40">
                            <Clock className="h-3 w-3" />
                            {!selectedDate
                              ? `${dateKey(value, timeZone)} · `
                              : ""}
                            {timeLabel(value, timeZone)}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <p className="text-sm font-medium">
                  {selectedDate ? "No posts on this date" : "No upcoming posts"}
                </p>
                <p className="mt-1 text-xs text-foreground/45">
                  The calendar only shows saved publication data.
                </p>
              </div>
            )}
          </div>
          <Link
            to="/dashboard/publish"
            className="block rounded-xl border border-border bg-surface p-4 text-sm font-medium text-primary hover:border-primary/35"
          >
            Open the publication queue
          </Link>
        </aside>
      </div>
    </div>
  );
}
