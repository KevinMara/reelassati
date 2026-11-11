import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { normalizeClipColorLut } from "@contracts/color-lut";
import type { SharedMediaCatalogPage } from "@contracts/shared-media-catalog";
import type { TimelineClip } from "@contracts/workspace";
import { loadColorLut } from "@/lib/color-lut";
import { platformApi } from "@/lib/platform-api";
import { useUiText } from "@/lib/i18n/ui";

export function ColorLutPicker({
  clip,
  disabled,
  onChange,
  onPreview,
}: {
  clip: TimelineClip;
  disabled: boolean;
  onChange(patch: Partial<TimelineClip>): Promise<void>;
  onPreview?(patch: Partial<TimelineClip>): void;
}) {
  const ui = useUiText();
  const current = normalizeClipColorLut(clip.colorLut);
  const [open, setOpen] = useState(false),
    [input, setInput] = useState(""),
    [query, setQuery] = useState("");
  const [page, setPage] = useState(1),
    [result, setResult] = useState<SharedMediaCatalogPage>();
  const [loading, setLoading] = useState(false),
    [applying, setApplying] = useState(false),
    [error, setError] = useState("");
  const [amount, setAmount] = useState<number>();
  const application = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => application.current?.abort(), []);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setLoading(true);
    });
    void platformApi
      .searchSharedCatalog(
        new URLSearchParams({
          kind: "lut",
          q: query,
          page: String(page),
          pageSize: "24",
        }),
        controller.signal
      )
      .then(value => {
        setResult(value);
        setError("");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(ui("Could not load color looks"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, query, page, ui]);
  async function apply(item: SharedMediaCatalogPage["items"][number]) {
    application.current?.abort();
    const controller = new AbortController();
    application.current = controller;
    setApplying(true);
    setError("");
    const reference = {
      id: item.id,
      name: item.name,
      sha256: item.media.sha256,
      amount: 1,
    };
    try {
      await loadColorLut(reference, controller.signal);
      controller.signal.throwIfAborted();
      await onChange({ colorLut: reference });
      controller.signal.throwIfAborted();
      setAmount(undefined);
      setOpen(false);
    } catch {
      if (!controller.signal.aborted)
        setError(ui("Could not apply color look"));
    } finally {
      if (!controller.signal.aborted) setApplying(false);
    }
  }
  async function strength(value: number) {
    if (!current) return;
    try {
      await onChange({ colorLut: { ...current, amount: value } });
      setAmount(undefined);
      setError("");
    } catch {
      setError(ui("Save failed"));
    }
  }
  const blocked = disabled || applying;
  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          disabled={blocked}
          onClick={() => setOpen(value => !value)}
          className="min-w-0 flex-1 text-left text-xs font-medium"
        >
          {ui("Color looks")}
          {current && (
            <span className="mt-1 block truncate font-normal text-muted-foreground">
              {current.name}
            </span>
          )}
        </button>
        {clip.colorLut && (
          <button
            type="button"
            disabled={blocked}
            aria-label={ui("Remove color look")}
            title={ui("Remove color look")}
            onClick={() => {
              onPreview?.({ colorLut: null });
              void onChange({ colorLut: null }).catch(() =>
                setError(ui("Save failed"))
              );
            }}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {current && (
        <label className="block space-y-2 text-xs">
          <span className="flex justify-between">
            <span>{ui("Look strength")}</span>
            <span className="font-mono text-muted-foreground">
              {Math.round((amount ?? current.amount) * 100)}%
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={amount ?? current.amount}
            disabled={blocked}
            aria-label={ui("Look strength")}
            onChange={event => {
              const value = Number(event.target.value);
              setAmount(value);
              onPreview?.({ colorLut: { ...current, amount: value } });
            }}
            onPointerUp={event =>
              void strength(Number(event.currentTarget.value))
            }
            onKeyUp={event => {
              if (
                event.key.startsWith("Arrow") ||
                ["Home", "End"].includes(event.key)
              )
                void strength(Number(event.currentTarget.value));
            }}
            className="w-full accent-primary"
          />
        </label>
      )}
      {open && (
        <div className="space-y-3">
          <form
            className="flex gap-1"
            onSubmit={event => {
              event.preventDefault();
              setPage(1);
              setQuery(input.trim());
            }}
          >
            <input
              aria-label={ui("Search color looks")}
              placeholder={ui("Search color looks")}
              value={input}
              onChange={event => setInput(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
            />
            <button
              type="submit"
              disabled={loading}
              aria-label={ui("Search")}
              className="rounded-lg border border-border p-2"
            >
              <Search size={13} />
            </button>
          </form>
          {loading ? (
            <p role="status" className="text-xs text-muted-foreground">
              {ui("Loading color look")}
            </p>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {(result?.items ?? [])
                .filter(item => item.kind === "lut")
                .map(item => (
                  <button
                    type="button"
                    key={item.id}
                    disabled={blocked}
                    aria-pressed={item.id === current?.id}
                    onClick={() => void apply(item)}
                    className="block w-full rounded-lg border border-transparent px-2 py-2 text-left text-xs hover:border-primary/40 disabled:opacity-40"
                  >
                    <span className="block truncate">{item.name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {item.group}
                    </span>
                  </button>
                ))}
              {result?.total === 0 && (
                <p className="text-xs text-muted-foreground">
                  {ui("No color looks available")}
                </p>
              )}
            </div>
          )}
          {result && result.total > result.pageSize && (
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => setPage(value => value - 1)}
              >
                {ui("Previous")}
              </button>
              <span>
                {page} / {Math.ceil(result.total / result.pageSize)}
              </span>
              <button
                type="button"
                disabled={loading || page * result.pageSize >= result.total}
                onClick={() => setPage(value => value + 1)}
              >
                {ui("Next")}
              </button>
            </div>
          )}
        </div>
      )}
      {applying && (
        <p role="status" className="text-xs text-muted-foreground">
          {ui("Loading color look")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
