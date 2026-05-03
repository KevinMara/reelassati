import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { POSTS, PLATFORMS, PostRow } from "./mockData";
import { cn } from "@/lib/utils";

type SortKey = "views" | "engagement" | "watchPct" | "predictionDelta";

export function PostsTable() {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "views", dir: "desc" });

  const rows = [...POSTS].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return (a[sort.key] - b[sort.key]) * dir;
  });

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="text-sm font-semibold">Recent posts</div>
        <div className="text-xs text-foreground/50">{POSTS.length} posts</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-foreground/45 border-b border-border">
              <th className="text-left font-medium px-5 py-3">Post</th>
              <th className="text-left font-medium px-3 py-3">Platform</th>
              <SortHeader label="Views" k="views" sort={sort} toggle={toggle} />
              <SortHeader label="Engagement" k="engagement" sort={sort} toggle={toggle} />
              <SortHeader label="Watch-through" k="watchPct" sort={sort} toggle={toggle} />
              <SortHeader label="vs prediction" k="predictionDelta" sort={sort} toggle={toggle} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.id} row={r} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  k,
  sort,
  toggle,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  toggle: (k: SortKey) => void;
}) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className="text-right font-medium px-3 py-3">
      <button
        onClick={() => toggle(k)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors",
          active ? "text-foreground" : "hover:text-foreground/75",
        )}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

function Row({ row }: { row: PostRow }) {
  const meta = PLATFORMS.find((p) => p.id === row.platform)!;
  const win = row.predictionDelta >= 0;
  return (
    <tr className="border-b border-border/40 last:border-0 hover:bg-surface/40 transition-colors">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-surface flex items-center justify-center text-lg shrink-0">
            {row.thumb}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{row.title}</div>
            <div className="text-xs text-foreground/45">{row.publishedAt}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="inline-flex items-center gap-1.5 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${meta.color})` }} />
          <span className="text-foreground/75">{meta.name}</span>
        </div>
      </td>
      <td className="px-3 py-3 text-right tabular-nums">{row.views.toLocaleString()}</td>
      <td className="px-3 py-3 text-right tabular-nums">{row.engagement.toFixed(1)}%</td>
      <td className="px-3 py-3 text-right">
        <div className="inline-flex items-center gap-2">
          <div className="h-1 w-16 rounded-full bg-foreground/10 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${row.watchPct * 100}%`, background: `hsl(${meta.color})` }}
            />
          </div>
          <span className="tabular-nums text-xs text-foreground/65 w-9 text-right">
            {Math.round(row.watchPct * 100)}%
          </span>
        </div>
      </td>
      <td className="px-3 py-3 text-right">
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs tabular-nums font-medium px-2 py-0.5 rounded-md",
            win
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
          )}
        >
          {win ? "+" : ""}
          {row.predictionDelta}%
        </span>
      </td>
    </tr>
  );
}
