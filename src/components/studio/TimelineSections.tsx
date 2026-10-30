import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Pencil, Send, Check, X, RotateCcw } from "lucide-react";
import type { StoryBeat, StoryBeatKind } from "@contracts/story-beats";
import {
  updateStoryBeat,
  mergeStoryRanges,
  storySectionShortName,
} from "@contracts/story-beats";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useUiText } from "@/lib/i18n/ui";

export const sectionColors: Record<StoryBeatKind, string> = {
  hook: "#fbbf24",
  body: "#38bdf8",
  proof: "#34d399",
  payoff: "#c084fc",
  cta: "#fb7185",
  custom: "#94a3b8",
};
export function TimelineSections({
  beats,
  duration,
  selectedIds,
  onToggle,
  onChange,
  onSend,
  disabled,
}: {
  beats: StoryBeat[];
  duration: number;
  selectedIds: string[];
  onToggle(id: string): void;
  onChange(beats: StoryBeat[]): Promise<void>;
  onSend(beats: StoryBeat[]): void;
  disabled?: boolean;
}) {
  const ui = useUiText();
  const [draft, setDraft] = useState<StoryBeat | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const originalDraft = useRef<StoryBeat | null>(null);
  const stopDragging = useRef<(() => void) | undefined>(undefined);
  const blocked = disabled || saving;
  useEffect(() => () => stopDragging.current?.(), []);
  useEffect(() => {
    if (blocked) stopDragging.current?.();
  }, [blocked]);
  if (!beats.length || !duration) return null;
  async function save() {
    if (!draft || blocked) return;
    if (
      JSON.stringify(beats.find(beat => beat.id === draft.id)) !==
      JSON.stringify(originalDraft.current)
    ) {
      setError(
        ui(
          "This section changed while you were editing it. Reopen it to use the latest version."
        )
      );
      return;
    }
    const next = updateStoryBeat(beats, draft.id, draft, duration);
    if (!next) {
      setError(
        ui(
          "Use a name and a valid range within the video, without overlapping another section."
        )
      );
      return;
    }
    setSaving(true);
    try {
      await onChange(next);
      setDraft(null);
    } catch {
      setError(ui("Save failed"));
    } finally {
      setSaving(false);
    }
  }
  function handleEdgePointerDown(event: PointerEvent<HTMLButtonElement>) {
    const side = event.currentTarget.dataset.edge === "start" ? "start" : "end";
    if (!draft || blocked || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    const rect = target
      .closest("[data-section-clock]")!
      .getBoundingClientRect();
    stopDragging.current?.();
    target.setPointerCapture(event.pointerId);
    const move = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      const time =
        Math.round(
          Math.max(
            0,
            Math.min(
              duration,
              ((e.clientX - rect.left) / rect.width) * duration
            )
          ) * 100
        ) / 100;
      setDraft(current =>
        current
          ? {
              ...current,
              [side]:
                side === "start"
                  ? Math.min(current.end - 0.05, time)
                  : Math.max(current.start + 0.05, time),
            }
          : null
      );
    };
    const stop = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", stop);
      target.removeEventListener("pointercancel", stop);
      target.removeEventListener("lostpointercapture", stop);
      if (target.hasPointerCapture(event.pointerId))
        target.releasePointerCapture(event.pointerId);
      stopDragging.current = undefined;
    };
    stopDragging.current = stop;
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", stop, { once: true });
    target.addEventListener("pointercancel", stop, { once: true });
    target.addEventListener("lostpointercapture", stop, { once: true });
  }
  return (
    <div className="py-1" aria-label={ui("Video sections")}>
      <div className="relative h-8" data-section-clock>
        {beats.map(original => {
          const beat = draft?.id === original.id ? draft : original;
          const color = sectionColors[beat.kind];
          const selection = selectedIds.includes(beat.id)
            ? beats.filter(b => selectedIds.includes(b.id))
            : [original];
          const title = selection.map(storySectionShortName).join(" + ");
          return (
            <HoverCard key={beat.id} openDelay={1000} closeDelay={250}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => {
                    if (draft?.id === beat.id) {
                      stopDragging.current?.();
                      setDraft(null);
                      setError("");
                    }
                    onToggle(beat.id);
                  }}
                  aria-pressed={selectedIds.includes(beat.id)}
                  className="absolute inset-y-0 truncate rounded-md border px-2 text-left text-[10px] font-medium transition-shadow hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  style={{
                    left: `${(beat.start / duration) * 100}%`,
                    width: `${((beat.end - beat.start) / duration) * 100}%`,
                    color,
                    borderColor: `${color}70`,
                    background: `${color}18`,
                    boxShadow: selectedIds.includes(beat.id)
                      ? `inset 0 0 0 1px ${color},0 0 12px ${color}30`
                      : undefined,
                  }}
                >
                  {beat.label}
                </button>
              </HoverCardTrigger>
              <HoverCardContent
                side="top"
                align="start"
                className="w-72 rounded-xl border-border bg-surface p-3"
              >
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {mergeStoryRanges(selection)
                    .map(r => `${r.start.toFixed(2)}–${r.end.toFixed(2)}s`)
                    .join(" · ")}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={blocked}
                    aria-label={ui("Edit section")}
                    onClick={() => {
                      stopDragging.current?.();
                      originalDraft.current = { ...original };
                      setDraft({
                        ...original,
                        reelOriginal:
                          original.reelOriginal ??
                          (original.origin === "ai"
                            ? {
                                label: original.label,
                                kind: original.kind,
                                start: original.start,
                                end: original.end,
                              }
                            : undefined),
                      });
                      if (!selectedIds.includes(original.id))
                        onToggle(original.id);
                      setError("");
                    }}
                    className="rounded-lg border border-border p-2 text-primary"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={blocked || draft?.id === beat.id}
                    onClick={() => onSend(selection)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary/15 px-3 py-2 text-xs text-primary"
                  >
                    <Send size={13} />
                    {ui("Send to Reel")}
                  </button>
                </div>
              </HoverCardContent>
            </HoverCard>
          );
        })}
        {draft &&
          (["start", "end"] as const).map(side => (
            <button
              key={side}
              type="button"
              disabled={blocked}
              aria-label={ui(
                side === "start" ? "Section start" : "Section end"
              )}
              data-edge={side}
              onPointerDown={handleEdgePointerDown}
              className="absolute -top-1 z-20 h-10 w-2 -translate-x-1/2 touch-none cursor-ew-resize rounded-full bg-white shadow-lg"
              style={{ left: `${(draft[side] / duration) * 100}%` }}
            />
          ))}
      </div>
      {draft && (
        <form
          className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-surface p-2"
          onSubmit={event => {
            event.preventDefault();
            void save();
          }}
        >
          <input
            aria-label={ui("Section name")}
            disabled={blocked}
            value={draft.label}
            maxLength={80}
            onChange={e => setDraft({ ...draft, label: e.target.value })}
            className="min-w-32 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs"
          />
          {(["start", "end"] as const).map(side => (
            <input
              type="number"
              disabled={blocked}
              key={side}
              aria-label={ui(
                side === "start" ? "Section start" : "Section end"
              )}
              value={draft[side]}
              min={0}
              max={duration}
              step={0.01}
              onChange={e =>
                setDraft({ ...draft, [side]: Number(e.target.value) })
              }
              className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-xs"
            />
          ))}
          {draft.reelOriginal && (
            <button
              type="button"
              disabled={blocked}
              title={ui("Restore Reel timing and title")}
              aria-label={ui("Restore Reel timing and title")}
              onClick={() => setDraft({ ...draft, ...draft.reelOriginal! })}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-primary"
            >
              <RotateCcw size={14} />
              {ui("Restore Reel version")}
            </button>
          )}
          <button
            type="submit"
            disabled={blocked}
            aria-label={ui("Save section")}
            className="rounded-lg p-1.5 text-primary"
          >
            <Check size={16} />
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              stopDragging.current?.();
              setDraft(null);
            }}
            aria-label={ui("Cancel")}
            className="p-1.5"
          >
            <X size={16} />
          </button>
          {error && (
            <p role="alert" className="w-full text-xs text-destructive">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
