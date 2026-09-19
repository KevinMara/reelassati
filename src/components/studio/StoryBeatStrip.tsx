import { useId, useState } from "react";
import { LoaderCircle, Pencil, Trash2, WandSparkles, X } from "lucide-react";
import {
  STORY_BEAT_KINDS,
  updateStoryBeat,
  type StoryBeat,
  type StoryBeatKind,
} from "@contracts/story-beats";
import { CompactSelect } from "@/components/ui/compact-select";
import { cn } from "@/lib/utils";

const labels: Record<StoryBeatKind, string> = {
  hook: "Hook",
  body: "Body",
  proof: "Proof",
  payoff: "Payoff",
  cta: "Call to action",
  custom: "Section",
};
const colours: Record<StoryBeatKind, string> = {
  hook: "border-amber-400/50 bg-amber-400/15 text-amber-800 dark:text-amber-100",
  body: "border-sky-400/50 bg-sky-400/15 text-sky-800 dark:text-sky-100",
  proof:
    "border-emerald-400/50 bg-emerald-400/15 text-emerald-800 dark:text-emerald-100",
  payoff:
    "border-fuchsia-400/50 bg-fuchsia-400/15 text-fuchsia-800 dark:text-fuchsia-100",
  cta: "border-rose-400/50 bg-rose-400/15 text-rose-800 dark:text-rose-100",
  custom:
    "border-slate-400/50 bg-slate-400/15 text-slate-800 dark:text-slate-100",
};
const timeLabel = (time: number) => `${time.toFixed(1)}s`;
type Draft = {
  id: string;
  label: string;
  kind: StoryBeatKind;
  start: string;
  end: string;
};

export interface StoryBeatStripProps {
  beats: StoryBeat[];
  duration: number;
  time: number;
  disabled?: boolean;
  busy?: boolean;
  hasEvidence?: boolean;
  stale?: boolean;
  generateLabel?: string;
  onSeek(time: number): void;
  onChange?(beats: StoryBeat[]): void | Promise<void>;
  /** Delegate to the real chat action/quote flow; this component performs no AI calls. */
  onGenerate?(): void;
}

/** Lightweight navigation and editable chapter markers, separate from media tracks. */
export function StoryBeatStrip({
  beats,
  duration,
  time,
  disabled,
  busy,
  hasEvidence,
  stale,
  generateLabel = "Find sections",
  onSeek,
  onChange,
  onGenerate,
}: StoryBeatStripProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const instanceId = useId();
  const selected = beats.find(beat => beat.id === selectedId);
  const blocked = Boolean(disabled || busy || saving);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const validBeats = beats.filter(
    beat =>
      Number.isFinite(beat.start) &&
      Number.isFinite(beat.end) &&
      beat.start >= 0 &&
      beat.end <= safeDuration &&
      beat.start < beat.end
  );
  const editSelected = () => {
    if (!selected) return;
    setError("");
    setDraft({
      id: selected.id,
      label: selected.label,
      kind: selected.kind,
      start: String(selected.start),
      end: String(selected.end),
    });
  };
  const persist = async (next: StoryBeat[]) => {
    if (!onChange) return;
    setSaving(true);
    setError("");
    try {
      await onChange(next);
      setDraft(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save this section. Try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-label="Story sections"
      className="rounded-xl border border-border bg-surface/55 px-3 py-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-xs font-semibold text-foreground">
            Story sections
          </h3>
          {stale && (
            <span role="status" className="text-[11px] text-amber-500">
              Content changed · refresh sections
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onChange && selected && (
            <button
              type="button"
              onClick={editSelected}
              disabled={blocked}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
              aria-label={`Edit ${selected.label} section`}
              title={`Edit ${selected.label}`}
            >
              <Pencil size={13} />
            </button>
          )}
          {onGenerate && (
            <button
              type="button"
              onClick={onGenerate}
              disabled={blocked || !safeDuration}
              className="ai-magic inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium disabled:opacity-50"
            >
              {busy ? (
                <LoaderCircle
                  size={13}
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <WandSparkles size={13} />
              )}
              {busy
                ? "Finding sections…"
                : validBeats.length
                  ? "Refresh sections"
                  : generateLabel}
            </button>
          )}
        </div>
      </div>
      {validBeats.length ? (
        <>
          <div
            className="relative mt-2 h-9 rounded-lg bg-background/60"
            role="group"
            aria-label="Jump to a story section"
          >
            {validBeats.map(beat => {
              const active = time >= beat.start && time < beat.end;
              return (
                <button
                  key={beat.id}
                  type="button"
                  disabled={blocked}
                  onClick={() => {
                    setSelectedId(beat.id);
                    onSeek(beat.start);
                  }}
                  aria-label={`${beat.label}, ${timeLabel(beat.start)} to ${timeLabel(beat.end)}`}
                  aria-current={active ? "true" : undefined}
                  title={`${beat.label} · ${timeLabel(beat.start)}–${timeLabel(beat.end)}. Select to seek; use Edit to rename or adjust.`}
                  className={cn(
                    "absolute inset-y-0 overflow-hidden rounded-md border px-2 text-left text-[11px] font-medium transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50",
                    colours[beat.kind],
                    active && "ring-1 ring-inset ring-white/45",
                    selectedId === beat.id &&
                      "outline outline-1 outline-primary"
                  )}
                  style={{
                    left: `${(beat.start / safeDuration) * 100}%`,
                    width: `${((beat.end - beat.start) / safeDuration) * 100}%`,
                  }}
                >
                  <span className="block truncate">{beat.label}</span>
                </button>
              );
            })}
          </div>
          {selected && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              {selected.label} · {timeLabel(selected.start)}–
              {timeLabel(selected.end)}
              {selected.origin === "manual" ? " · Edited by you" : ""}
            </p>
          )}
        </>
      ) : (
        <p className="py-2 text-xs leading-relaxed text-muted-foreground">
          {hasEvidence
            ? "Find the hook, main idea and payoff in your footage."
            : "Add footage and ask AI to find its sections using speech or visual analysis."}
        </p>
      )}
      {draft && onChange && (
        <form
          className="mt-2 flex flex-wrap items-end gap-2 border-t border-border pt-2"
          onSubmit={event => {
            event.preventDefault();
            const start = draft.start.trim() ? Number(draft.start) : Number.NaN;
            const end = draft.end.trim() ? Number(draft.end) : Number.NaN;
            const next = updateStoryBeat(
              beats,
              draft.id,
              { label: draft.label, kind: draft.kind, start, end },
              safeDuration
            );
            if (!next) {
              setError(
                "Use a name and a valid range within the video, without overlapping another section."
              );
              return;
            }
            void persist(next);
          }}
        >
          <label
            className="min-w-32 flex-1 space-y-1 text-[11px] text-muted-foreground"
            htmlFor={`${instanceId}-label`}
          >
            <span>Section name</span>
            <input
              id={`${instanceId}-label`}
              value={draft.label}
              maxLength={80}
              disabled={blocked}
              onChange={event =>
                setDraft({ ...draft, label: event.target.value })
              }
              className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground"
            />
          </label>
          <div className="w-32 space-y-1">
            <span className="text-[11px] text-muted-foreground">Role</span>
            <CompactSelect
              value={draft.kind}
              onValueChange={kind =>
                setDraft({ ...draft, kind: kind as StoryBeatKind })
              }
              aria-label="Story section role"
              disabled={blocked}
              options={STORY_BEAT_KINDS.map(kind => ({
                value: kind,
                label: labels[kind],
              }))}
            />
          </div>
          {(["start", "end"] as const).map(edge => (
            <label
              key={edge}
              className="w-24 space-y-1 text-[11px] text-muted-foreground"
              htmlFor={`${instanceId}-${edge}`}
            >
              <span>{edge === "start" ? "Start" : "End"} (seconds)</span>
              <input
                id={`${instanceId}-${edge}`}
                type="number"
                inputMode="decimal"
                min={0}
                max={safeDuration}
                step="any"
                value={draft[edge]}
                disabled={blocked}
                onChange={event =>
                  setDraft({ ...draft, [edge]: event.target.value })
                }
                className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground"
              />
            </label>
          ))}
          <button
            type="submit"
            disabled={blocked}
            className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={blocked}
            aria-label="Remove section marker"
            title="Remove section marker"
            onClick={() => {
              void persist(beats.filter(beat => beat.id !== draft.id));
            }}
            className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <Trash2 size={14} />
          </button>
          <button
            type="button"
            disabled={blocked}
            aria-label="Close section editing"
            onClick={() => {
              setDraft(null);
              setError("");
            }}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <X size={14} />
          </button>
          {error && (
            <p role="alert" className="w-full text-xs text-destructive">
              {error}
            </p>
          )}
          <p className="w-full text-[10px] text-muted-foreground">
            These markers organize your story. Editing them does not cut or
            remove footage.
          </p>
        </form>
      )}
    </section>
  );
}
