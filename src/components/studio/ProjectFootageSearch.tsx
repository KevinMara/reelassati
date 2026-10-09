import { useEffect, useId, useMemo, useState } from "react";
import { Search, ArrowUpRight, Loader2 } from "lucide-react";
import type { Asset, EditProject } from "@contracts/workspace";
import {
  searchProjectFootage,
  PROJECT_FOOTAGE_SEARCH_LIMITS,
  type FootageSearchEvidence,
} from "@/lib/project-footage-search";
import {
  buildSemanticFootageCorpus,
  rankSemanticFootage,
  SemanticFootageSearchClient,
} from "@/lib/semantic-footage-search";
import type { ProjectFootageMatch } from "@/lib/project-footage-search";
import { useAuth } from "@/hooks/useAuth";
import { selectedBrand } from "@/lib/workspace-scope";

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
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"literal" | "meaning">("literal");
  const [client] = useState(() => new SemanticFootageSearchClient());
  const [meaning, setMeaning] = useState<{
    key: string;
    busy: boolean;
    message: string;
    matches: ProjectFootageMatch[];
  }>();
  const literalMatches = useMemo(
    () => searchProjectFootage(project, assets, query),
    [project, assets, query]
  );
  const corpus = useMemo(
    () => buildSemanticFootageCorpus(project, assets),
    [project, assets]
  );
  const scope = JSON.stringify([
    user?.id,
    selectedBrand(user?.email),
    project.id,
  ]);
  const searchKey = JSON.stringify([scope, corpus.fingerprint, query, mode]);
  // Logout, brand/project switching, edited evidence, and changed query destroy
  // the old worker. Stamped results are also hidden synchronously during render.
  useEffect(() => () => client.cancel(), [client, searchKey]);
  const currentMeaning = meaning?.key === searchKey ? meaning : undefined;
  const matches =
    mode === "literal" ? literalMatches : (currentMeaning?.matches ?? []);
  const active = /[\p{L}\p{N}]/u.test(query);
  const searchMeaning = async () => {
    if (!user || !active || !corpus.excerpts.length) return;
    const key = searchKey;
    setMeaning({
      key,
      busy: true,
      message: "Preparing local meaning search…",
      matches: [],
    });
    try {
      const similarities = await client.search(corpus, query, message =>
        setMeaning(previous =>
          previous?.key === key ? { ...previous, message } : previous
        )
      );
      const results = rankSemanticFootage(corpus, similarities);
      setMeaning({
        key,
        busy: false,
        message: results.length
          ? `${results.length} meaning ${results.length === 1 ? "match" : "matches"}`
          : "No sufficiently similar source evidence. Try a shorter English description or literal search.",
        matches: results,
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setMeaning({
        key,
        busy: false,
        message:
          cause instanceof Error
            ? cause.message
            : "Meaning search could not finish.",
        matches: [],
      });
    }
  };
  return (
    <section className="space-y-3" aria-label="Search project footage">
      <div>
        <h3 className="text-sm font-semibold">Find in this project</h3>
        <p className="mt-1 text-xs leading-relaxed text-foreground/65">
          Search transcript words, recorded scene observations, and clip names.
          Visual descriptions are searchable after source analysis exists.
          Search uses no AI credits. Meaning search compares English
          descriptions on your device against this existing text evidence.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={mode === "literal"}
          onClick={() => setMode("literal")}
          className={`rounded-lg border px-3 py-1.5 text-xs ${mode === "literal" ? "border-primary/50 bg-primary/10" : "border-border"}`}
        >
          Exact words
        </button>
        <button
          type="button"
          aria-pressed={mode === "meaning"}
          onClick={() => setMode("meaning")}
          className={`rounded-lg border px-3 py-1.5 text-xs ${mode === "meaning" ? "border-primary/50 bg-primary/10" : "border-border"}`}
        >
          Meaning · English
        </button>
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
      {mode === "meaning" && (
        <>
          <p className="text-xs leading-relaxed text-foreground/60">
            The first search loads about 46 MB of local model resources. Text
            stays on this device. Results show related evidence, not verified
            visual observations.
          </p>
          <button
            type="button"
            disabled={
              !user ||
              !active ||
              !corpus.excerpts.length ||
              currentMeaning?.busy
            }
            onClick={() => void searchMeaning()}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {currentMeaning?.busy && (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            )}
            Find related moments
          </button>
          {corpus.omittedExcerpts && (
            <p className="text-xs text-foreground/60">
              This search uses the first 256 distinct evidence excerpts. Exact
              words searches additional evidence.
            </p>
          )}
          {currentMeaning && (
            <p
              role="status"
              aria-live="polite"
              className="text-xs text-foreground/60"
            >
              {currentMeaning.message}
            </p>
          )}
          {!corpus.excerpts.length && (
            <p className="text-xs text-foreground/60">
              No attributable text evidence is available yet.
            </p>
          )}
        </>
      )}
      {active && mode === "literal" && (
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
              {mode === "meaning" && (
                <span className="text-foreground/55">Meaning match</span>
              )}
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
