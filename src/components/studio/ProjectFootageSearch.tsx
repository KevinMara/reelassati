import { useId, useMemo, useState } from "react";
import { Search, ArrowUpRight } from "lucide-react";
import type { Asset, EditProject } from "@contracts/workspace";
import {
  searchProjectFootage,
  PROJECT_FOOTAGE_SEARCH_LIMITS,
  type FootageSearchEvidence,
} from "@/lib/project-footage-search";

const labels: Record<FootageSearchEvidence, string> = {
  transcript: "Transcript",
  "observed-scene": "Observed scene",
  "clip-name": "Clip name",
};
function timeLabel(seconds: number) {
  const tenths = Math.round(seconds * 10),
    minutes = Math.floor(tenths / 600);
  return `${minutes}:${((tenths % 600) / 10).toFixed(1).padStart(4, "0")}`;
}

export function ProjectFootageSearch({
  project,
  assets,
  onSelect,
}: {
  project: EditProject;
  assets: readonly Asset[];
  onSelect: (clipId: string, time: number) => void;
}) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const matches = useMemo(
    () => searchProjectFootage(project, assets, query),
    [project, assets, query]
  );
  const active = /[\p{L}\p{N}]/u.test(query);
  return (
    <section className="space-y-3" aria-label="Search project footage">
      <div>
        <h3 className="text-sm font-semibold">Find in this project</h3>
        <p className="mt-1 text-xs leading-relaxed text-foreground/65">
          Search transcript words, recorded scene observations, and clip names.
          Visual descriptions are searchable after source analysis exists.
          Search uses no AI credits.
        </p>
      </div>
      <label htmlFor={inputId} className="sr-only">
        Search project words or descriptions
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-3 size-4 text-foreground/50"
        />
        <input
          id={inputId}
          type="search"
          autoComplete="off"
          value={query}
          maxLength={PROJECT_FOOTAGE_SEARCH_LIMITS.queryCharacters}
          onChange={event => setQuery(event.target.value)}
          placeholder="Try a spoken phrase or “coffee cup”"
          className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
        />
      </div>
      {active && (
        <p
          role="status"
          aria-live="polite"
          className="text-xs text-foreground/60"
        >
          {matches.length
            ? `${matches.length} matching ${matches.length === 1 ? "moment" : "moments"}${matches.length === PROJECT_FOOTAGE_SEARCH_LIMITS.results ? " (showing the first 50)" : ""}`
            : "No matching source evidence. Try words from a caption or a shorter description."}
        </p>
      )}
      {!active && (
        <p className="text-xs text-foreground/55">
          Results link to the exact source clip and timeline time. Clip-name
          matches describe file labels.
        </p>
      )}
      <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
        {matches.map(match => (
          <button
            key={match.id}
            type="button"
            onClick={() => onSelect(match.clipId, match.start)}
            className="group w-full rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary/45 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label={`Go to ${labels[match.evidence]} match in ${match.clipLabel} at ${timeLabel(match.start)}`}
          >
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
              <span className="rounded bg-foreground/5 px-1.5 py-0.5 font-medium text-foreground/75">
                {labels[match.evidence]}
              </span>
              <span className="tabular-nums text-foreground/60">
                {timeLabel(match.start)}–{timeLabel(match.end)}
              </span>
              {match.hidden && (
                <span className="text-foreground/55">Picture hidden</span>
              )}
              {match.muted && (
                <span className="text-foreground/55">Sound muted</span>
              )}
              <ArrowUpRight
                aria-hidden="true"
                className="ml-auto size-3.5 text-foreground/45 group-hover:text-primary"
              />
            </span>
            <span className="mt-2 block whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
              {match.snippet}
            </span>
            <span className="mt-1.5 block truncate text-xs text-foreground/55">
              {match.clipLabel || match.assetName}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
