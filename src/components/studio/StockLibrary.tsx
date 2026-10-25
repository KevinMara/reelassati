import { selectedBrand } from "@/lib/workspace-scope";
import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Loader2, Search } from "lucide-react";
import type { StockKind, StockMedia } from "@contracts/stock-media";
import { useWorkspace } from "@/providers/workspace";
import {
  platformApi,
  captureUploadRequestScope,
  verifyUploadRequestScope,
} from "@/lib/platform-api";
import { useUiText } from "@/lib/i18n/ui";
import { CompactSelect } from "@/components/ui/compact-select";
import { EditorSoundLibrary } from "./EditorSoundLibrary";

export function StockLibrary() {
  const ui = useUiText();
  const { updateWorkspace } = useWorkspace();
  const [kind, setKind] = useState<StockKind>("video");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<StockMedia[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function search() {
    if (busy || !query.trim()) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy("search");
    setMessage("");
    setItems([]);
    try {
      const result = await platformApi.searchStock(
        kind,
        query.trim(),
        abort.signal
      );
      setItems(result.items);
      if (!result.items.length)
        setMessage(ui("No eligible stock found. Try a more specific search."));
    } catch (e) {
      if (!abort.signal.aborted)
        setMessage(e instanceof Error ? e.message : ui("Stock search failed."));
    } finally {
      if (!abort.signal.aborted) setBusy("");
    }
  }
  async function save(item: StockMedia) {
    if (busy) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(item.id);
    setMessage("");
    try {
      const scope = await captureUploadRequestScope();
      const asset = await platformApi.importStock(item, abort.signal, scope);
      await verifyUploadRequestScope(scope);
      abort.signal.throwIfAborted();
      await updateWorkspace(w => {
        abort.signal.throwIfAborted();
        if (
          w.profile.email.toLowerCase() !== scope.ownerEmail ||
          selectedBrand(scope.ownerEmail) !== scope.brandId
        )
          throw new Error(
            ui("The destination workspace changed. Start the import again.")
          );
        return {
          ...w,
          assets: [asset, ...w.assets.filter(a => a.id !== asset.id)],
        };
      });
      setMessage(ui("Saved to Reel stock."));
    } catch (e) {
      if (!abort.signal.aborted)
        setMessage(e instanceof Error ? e.message : ui("Stock import failed."));
    } finally {
      if (!abort.signal.aborted) setBusy("");
    }
  }
  return (
    <section
      className="space-y-4 rounded-xl border border-border p-4"
      aria-label={ui("Reel stock")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-semibold">{ui("Reel stock")}</h2>
        <span className="text-xs text-muted-foreground">
          {ui("Free media · no AI credits")}
        </span>
      </div>
      <form
        onSubmit={e => {
          e.preventDefault();
          void search();
        }}
        className="flex flex-wrap gap-2"
      >
        <CompactSelect
          aria-label={ui("Stock type")}
          value={kind}
          onValueChange={value => {
            setKind(value as StockKind);
            setItems([]);
            setMessage("");
          }}
          options={[
            { value: "video", label: ui("Video") },
            { value: "image", label: ui("Images") },
            { value: "audio", label: ui("Sound effects") },
          ]}
        />
        <input
          type="search"
          aria-label={ui("Search stock")}
          placeholder={ui("Search stock…")}
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!!busy || !query.trim()}
          aria-label={ui("Search stock")}
          className="rounded-xl bg-primary px-3 text-primary-foreground disabled:opacity-40"
        >
          {busy === "search" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Search size={16} />
          )}
        </button>
      </form>
      <p className="text-xs text-muted-foreground">
        {ui(
          "Wikimedia Commons and Openverse · CC0, public domain or CC BY. Keep the listed attribution when publishing."
        )}
      </p>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(item => (
          <article
            key={`${item.provider}:${item.id}`}
            className="overflow-hidden rounded-xl border border-border bg-background"
          >
            {item.kind === "image" ? (
              <img
                src={item.thumbnail || item.url}
                alt=""
                loading="lazy"
                className="aspect-video w-full object-cover"
              />
            ) : item.kind === "video" ? (
              <video
                controls
                preload="none"
                poster={item.thumbnail}
                src={item.url}
                className="aspect-video w-full bg-black"
              />
            ) : (
              <audio
                controls
                preload="none"
                src={item.url}
                className="my-4 w-full"
              />
            )}
            <div className="space-y-2 p-3">
              <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {item.creator} ·{" "}
                <a
                  href={item.licenseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {item.license}
                </a>
              </p>
              <div className="flex items-center justify-between gap-2">
                <a
                  href={item.source}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                >
                  {ui("Source")}
                  <ExternalLink size={11} />
                </a>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void save(item)}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary/15 px-2 py-1.5 text-xs text-primary disabled:opacity-40"
                >
                  {busy === item.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Download size={12} />
                  )}{" "}
                  {ui("Save")}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {kind === "audio" && <EditorSoundLibrary />}
    </section>
  );
}
