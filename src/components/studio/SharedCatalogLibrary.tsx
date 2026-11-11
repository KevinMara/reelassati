import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Play,
  Plus,
  Search,
} from "lucide-react";
import {
  sharedCatalogMediaPath,
  type SharedMediaCatalogPage,
  type SharedMediaCatalogItem,
} from "@contracts/shared-media-catalog";
import type { Asset } from "@contracts/workspace";
import { useWorkspace } from "@/providers/workspace";
import { useUiText } from "@/lib/i18n/ui";
import {
  platformApi,
  captureUploadRequestScope,
  verifyUploadRequestScope,
} from "@/lib/platform-api";
import { platformApiUrl } from "@/lib/runtime";
import { resolveSharedCatalogAsset } from "@/lib/shared-media-catalog";
import { selectedBrand } from "@/lib/workspace-scope";

export function SharedCatalogLibrary({
  kind,
  onInsert,
}: {
  kind?: "audio" | "video" | "image" | "visual";
  onInsert?: (asset: Asset) => Promise<void>;
}) {
  const ui = useUiText();
  const { workspace, getWorkspaceSnapshot, updateWorkspace, capabilities } =
    useWorkspace();
  const [query, setQuery] = useState(""),
    [submitted, setSubmitted] = useState(""),
    [group, setGroup] = useState(""),
    [page, setPage] = useState(1);
  const [data, setData] = useState<SharedMediaCatalogPage>(),
    [loadedKey, setLoadedKey] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const [preview, setPreview] = useState("");
  const [chosenVariants, setChosenVariants] = useState<Record<string, string>>(
    {}
  );
  const requestKey = JSON.stringify([submitted, group, page, kind]);
  const loading = loadedKey !== requestKey;
  const importing = useRef<AbortController | null>(null);
  useEffect(() => () => importing.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    void platformApi
      .searchSharedCatalog(
        new URLSearchParams({
          q: submitted,
          group,
          page: String(page),
          pageSize: "12",
          kind: kind || "media",
        }),
        controller.signal
      )
      .then(result => {
        if (!controller.signal.aborted) {
          setData(result);
          setError("");
        }
      })
      .catch(cause => {
        if (!controller.signal.aborted) {
          setData(undefined);
          setError(
            cause instanceof Error ? cause.message : ui("Stock import failed.")
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(requestKey);
      });
    return () => controller.abort();
  }, [submitted, group, page, kind, ui, requestKey]);
  async function save(item: SharedMediaCatalogItem, insert: boolean) {
    if (busy) return;
    const controller = new AbortController();
    importing.current = controller;
    setBusy(item.id);
    setError("");
    try {
      const scope = await captureUploadRequestScope();
      const asset = await resolveSharedCatalogAsset(
        item.id,
        getWorkspaceSnapshot().assets,
        controller.signal
      );
      await verifyUploadRequestScope(scope);
      controller.signal.throwIfAborted();
      await updateWorkspace(current => {
        controller.signal.throwIfAborted();
        if (
          current.profile.email.toLowerCase() !== scope.ownerEmail ||
          selectedBrand(scope.ownerEmail) !== scope.brandId
        )
          throw new Error(
            "The destination workspace changed. Start the import again."
          );
        return {
          ...current,
          assets: [asset, ...current.assets.filter(row => row.id !== asset.id)],
        };
      });
      if (insert && onInsert) await onInsert(asset);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : ui("Stock import failed.")
        );
    } finally {
      if (!controller.signal.aborted) setBusy("");
    }
  }
  return (
    <section className="space-y-3" aria-label={ui("Stock media")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{ui("Stock media")}</h3>
        <span className="text-[11px] text-muted-foreground">
          {ui("Free media · no AI credits")}
        </span>
      </div>
      <form
        className="flex gap-2"
        onSubmit={event => {
          event.preventDefault();
          setSubmitted(query.trim());
          setPage(1);
        }}
      >
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          aria-label={ui("Search")}
          placeholder={ui("Search")}
          className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs"
        />
        <button
          className="rounded border border-border p-2"
          type="submit"
          aria-label={ui("Search")}
        >
          <Search size={14} />
        </button>
      </form>
      {!!data?.groups.length && (
        <select
          aria-label={ui("Category")}
          value={group}
          onChange={event => {
            setGroup(event.target.value);
            setPage(1);
          }}
          className="w-full rounded border border-border bg-background p-2 text-xs"
        >
          <option value="">{ui("All")}</option>
          {data.groups.map(item => (
            <option key={item.name} value={item.name}>
              {item.name} ({item.count})
            </option>
          ))}
        </select>
      )}
      {loading && (
        <Loader2
          size={18}
          className="animate-spin"
          aria-label={ui("Loading…")}
        />
      )}
      {!loading && data && (
        <div className="grid grid-cols-2 gap-2">
          {data.items.map(representative => {
            const variants = data.variants?.[representative.designId] || [
              representative,
            ];
            const item =
              variants.find(
                row => row.id === chosenVariants[representative.designId]
              ) || representative;
            const saved = workspace.assets.some(
              asset => asset.catalog?.id === item.id && asset.status === "ready"
            );
            const source = platformApiUrl(sharedCatalogMediaPath(item.id)),
              poster = item.poster
                ? platformApiUrl(sharedCatalogMediaPath(item.id, "poster"))
                : undefined;
            return (
              <article
                key={item.id}
                className="min-w-0 rounded-lg border border-border p-2"
              >
                <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded bg-gradient-to-br from-slate-700 to-slate-500">
                  {preview === item.id && item.kind === "audio" ? (
                    <audio src={source} autoPlay controls className="w-full" />
                  ) : preview === item.id && item.kind === "video" ? (
                    <video
                      src={source}
                      poster={poster}
                      autoPlay
                      loop
                      controls
                      muted
                      playsInline
                      className="h-full w-full object-contain"
                      style={{ mixBlendMode: item.blendMode }}
                    >
                      <track kind="captions" />
                    </video>
                  ) : (
                    <button
                      className="h-full w-full"
                      onClick={() =>
                        setPreview(preview === item.id ? "" : item.id)
                      }
                      type="button"
                      aria-label={ui("Preview {{name}}", { name: item.name })}
                    >
                      {poster && (
                        <img
                          src={poster}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-contain"
                          style={{ mixBlendMode: item.blendMode }}
                        />
                      )}
                      {item.kind !== "image" && (
                        <Play
                          size={20}
                          className="absolute bottom-2 right-2 text-white"
                        />
                      )}
                    </button>
                  )}
                </div>
                <p
                  className="mt-2 truncate text-xs font-medium"
                  title={item.name}
                >
                  {item.name}
                </p>
                {variants.length > 1 && (
                  <select
                    aria-label={ui("Variant")}
                    value={item.id}
                    onChange={event => {
                      setChosenVariants(current => ({
                        ...current,
                        [item.designId]: event.target.value,
                      }));
                      setPreview("");
                    }}
                    className="mt-1 w-full rounded border border-border bg-background p-1 text-xs"
                  >
                    {variants.map(variant => (
                      <option key={variant.id} value={variant.id}>
                        {variant.variant}
                      </option>
                    ))}
                  </select>
                )}
                <p className="truncate text-[11px] text-muted-foreground">
                  {item.variant}
                  {item.kind !== "image"
                    ? ` · ${item.duration.toFixed(2)}s`
                    : ""}
                </p>
                <div className="mt-2 flex gap-1">
                  <button
                    type="button"
                    disabled={!!busy || saved || !capabilities.uploads}
                    onClick={() => void save(item, false)}
                    className="flex flex-1 items-center justify-center gap-1 rounded border border-border p-2 text-xs disabled:opacity-40"
                    aria-label={ui("Save {{name}} to Library", {
                      name: item.name,
                    })}
                  >
                    {busy === item.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Download size={13} />
                    )}
                    {ui(saved ? "Saved to Library" : "Save to Library")}
                  </button>
                  {onInsert && (
                    <button
                      type="button"
                      onClick={() => void save(item, true)}
                      disabled={!!busy || !capabilities.uploads}
                      aria-label={ui("Add to timeline")}
                      className="rounded border border-primary/30 p-2 text-primary disabled:opacity-40"
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {!loading && data?.total === 0 && (
        <p className="text-xs text-muted-foreground">{ui("No results")}</p>
      )}
      {!!data?.total && (
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage(value => value - 1)}
            aria-label={ui("Previous")}
            className="p-2 disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {page} / {Math.ceil(data.total / data.pageSize)}
          </span>
          <button
            type="button"
            disabled={page * data.pageSize >= data.total || loading}
            onClick={() => setPage(value => value + 1)}
            aria-label={ui("Next")}
            className="p-2 disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
      {!loading && error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
