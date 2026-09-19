import { useRef, useState } from "react";
import { WandSparkles } from "lucide-react";
export function TimelinePrompt({
  duration,
  busy,
  credits,
  onSend,
}: {
  duration: number;
  busy: boolean;
  credits: number;
  onSend: (
    prompt: string,
    range: { start: number; end: number }
  ) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(false);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(Math.min(3, duration));
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const anchor = useRef<number | null>(null);
  const low = Math.max(0, Math.min(duration, start, end)),
    high = Math.max(low, Math.min(duration, Math.max(start, end)));
  return (
    <div className="border-b border-border bg-primary/5 p-3">
      <button
        type="button"
        aria-pressed={enabled}
        onClick={() => setEnabled(!enabled)}
        className="ai-magic inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
      >
        {enabled ? "Close range prompt" : "Edit a time range with AI"}
        <WandSparkles aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      {enabled && (
        <>
          <p className="my-2 text-xs text-foreground/70">
            Drag across this time ruler, adjust the range, then describe the
            change. Changes remain reviewable.
          </p>
          <div
            role="group"
            aria-label="Drag to select editing range"
            className="relative h-9 touch-none cursor-crosshair overflow-hidden rounded-lg border border-primary/30 bg-background"
            onPointerDown={e => {
              if (busy) return;
              const r = e.currentTarget.getBoundingClientRect();
              const t = Math.max(
                0,
                Math.min(duration, ((e.clientX - r.left) / r.width) * duration)
              );
              const edge = (e.target as HTMLElement)
                .closest("[data-range-edge]")
                ?.getAttribute("data-range-edge");
              anchor.current =
                edge === "start" ? high : edge === "end" ? low : t;
              setStart(anchor.current);
              setEnd(edge ? t : Math.min(duration, t + 0.1));
              setOpen(false);
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={e => {
              if (anchor.current === null) return;
              const r = e.currentTarget.getBoundingClientRect();
              setEnd(
                Math.max(
                  0,
                  Math.min(
                    duration,
                    ((e.clientX - r.left) / r.width) * duration
                  )
                )
              );
            }}
            onPointerUp={() => {
              anchor.current = null;
              setOpen(true);
            }}
            onPointerCancel={() => {
              anchor.current = null;
            }}
          >
            <span
              className="absolute inset-y-0 bg-primary/30"
              style={{
                left: `${(low / Math.max(0.1, duration)) * 100}%`,
                width: `${Math.max(0.2, ((high - low) / Math.max(0.1, duration)) * 100)}%`,
              }}
            />
            {(["start", "end"] as const).map(edge => (
              <button
                key={edge}
                type="button"
                role="slider"
                data-range-edge={edge}
                aria-label={`Selected range ${edge}`}
                aria-valuemin={0}
                aria-valuemax={duration}
                aria-valuenow={edge === "start" ? low : high}
                disabled={busy}
                className="absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-ew-resize rounded border-2 border-primary bg-surface"
                style={{
                  left: `${((edge === "start" ? low : high) / Math.max(0.1, duration)) * 100}%`,
                }}
                onKeyDown={e => {
                  if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
                  e.preventDefault();
                  const delta = e.key === "ArrowLeft" ? -0.1 : 0.1;
                  setStart(
                    edge === "start"
                      ? Math.max(0, Math.min(high, low + delta))
                      : low
                  );
                  setEnd(
                    edge === "end"
                      ? Math.min(duration, Math.max(low, high + delta))
                      : high
                  );
                  setOpen(true);
                }}
              />
            ))}
            <span className="absolute left-2 top-2 text-xs">0.0s</span>
            <span className="absolute right-2 top-2 text-xs">
              {duration.toFixed(1)}s
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-2 text-xs text-primary"
          >
            Set range with controls
          </button>
          {open && (
            <form
              onSubmit={e => {
                e.preventDefault();
                void onSend(prompt, { start: low, end: high });
              }}
              className="mt-2 max-w-md space-y-2 rounded-xl border border-primary/30 bg-surface p-3"
            >
              <p className="text-sm font-medium">
                {low.toFixed(1)}–{high.toFixed(1)}s
              </p>
              <label className="block text-xs">
                Range start
                <input
                  aria-label="Prompt range start"
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={Math.min(start, duration)}
                  onChange={e => setStart(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </label>
              <label className="block text-xs">
                Range end
                <input
                  aria-label="Prompt range end"
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={Math.min(end, duration)}
                  onChange={e => setEnd(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </label>
              <textarea
                aria-label="Edit this range"
                placeholder="What should change here?"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                className="w-full rounded-lg border border-border bg-background p-2 text-sm"
                rows={2}
              />
              <p className="text-xs text-foreground/60">
                Local mode supports color, framing, fades, audio level, captions
                editable graphics and existing overlays. Timing changes that
                affect the rest of the edit need the main AI editor.
              </p>
              <button
                type="submit"
                disabled={busy || !prompt.trim() || high - low < 0.1}
                className="ai-magic inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs disabled:opacity-40"
              >
                Suggest range edit · {credits} credits
                <WandSparkles aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
