import { useEffect, useRef, useState } from "react";
import { Check, Download, Loader2, Play, Plus } from "lucide-react";
import {
  editorEffectCatalog,
  editorEffectPoster,
  editorEffectUrl,
} from "@contracts/editor-effect-catalog";
import type { Asset } from "@contracts/workspace";
import { useWorkspace } from "@/providers/workspace";
import { useUiText } from "@/lib/i18n/ui";
import { resolveChatCatalogEffect } from "@/lib/editor-chat-catalog-effect";
import {
  platformApi,
  captureUploadRequestScope,
  verifyUploadRequestScope,
} from "@/lib/platform-api";
import { selectedBrand } from "@/lib/workspace-scope";

/** Real file previews are loaded only on request, never as sixteen autoplaying decoders. */
export function EditorEffectLibrary({
  onInsert,
}: {
  onInsert?: (asset: Asset) => Promise<void>;
}) {
  const ui = useUiText();
  const { workspace, updateWorkspace, capabilities, getWorkspaceSnapshot } =
    useWorkspace();
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function save(id: string, insert: boolean) {
    if (busy) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(id);
    setMessage("");
    try {
      const scope = await captureUploadRequestScope();
      const asset = await resolveChatCatalogEffect(
        id,
        getWorkspaceSnapshot().assets,
        file =>
          platformApi.uploadAsset(file, "video", undefined, undefined, {
            scope,
            signal: abort.signal,
          }),
        abort.signal
      );
      abort.signal.throwIfAborted();
      await verifyUploadRequestScope(scope);
      await updateWorkspace(current => {
        abort.signal.throwIfAborted();
        if (
          current.profile.email.toLowerCase() !== scope.ownerEmail ||
          selectedBrand(scope.ownerEmail) !== scope.brandId
        )
          throw new Error(
            "The destination workspace changed. Start the import again."
          );
        return {
          ...current,
          assets: [
            asset,
            ...current.assets.filter(item => item.id !== asset.id),
          ],
        };
      });
      if (insert && onInsert) await onInsert(asset);
      setMessage(ui("Saved to Library"));
    } catch (cause) {
      if (!abort.signal.aborted)
        setMessage(
          cause instanceof Error ? cause.message : ui("Stock import failed.")
        );
    } finally {
      if (!abort.signal.aborted) setBusy("");
    }
  }

  return (
    <section className="space-y-3" aria-label={ui("Effects")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{ui("Effects")}</h3>
        <span className="text-[11px] text-muted-foreground">
          {ui("Free media · no AI credits")}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {editorEffectCatalog.map(entry => {
          const saved = workspace.assets.some(
            asset =>
              asset.variantGroupId === `builtin-effect:${entry.id}` &&
              asset.status === "ready"
          );
          return (
            <article
              key={entry.id}
              className="min-w-0 rounded-lg border border-border p-2"
            >
              <div className="relative aspect-video overflow-hidden rounded-md bg-gradient-to-br from-slate-700 to-slate-500">
                {preview === entry.id ? (
                  <video
                    key={entry.id}
                    src={editorEffectUrl(entry)}
                    poster={editorEffectPoster(entry)}
                    aria-label={ui("Preview {{name}}", { name: entry.name })}
                    autoPlay
                    muted
                    loop
                    playsInline
                    controls
                    className="h-full w-full object-contain"
                    style={{ mixBlendMode: "screen" }}
                  >
                    <track kind="captions" />
                  </video>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPreview(entry.id)}
                    aria-label={ui("Preview {{name}}", { name: entry.name })}
                    className="h-full w-full"
                  >
                    <img
                      src={editorEffectPoster(entry)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-contain"
                      style={{ mixBlendMode: "screen" }}
                    />
                    <Play
                      size={18}
                      className="absolute bottom-2 right-2 text-white"
                    />
                  </button>
                )}
              </div>
              <p className="mt-2 truncate text-xs font-medium">{entry.name}</p>
              <p className="text-[11px] text-muted-foreground">
                9:16 · {entry.duration.toFixed(2)}s
              </p>
              <div className="mt-2 flex gap-1">
                <button
                  type="button"
                  disabled={!!busy || saved || !capabilities.uploads}
                  onClick={() => void save(entry.id, false)}
                  aria-label={ui(
                    saved
                      ? "{{name}} saved to Library"
                      : "Save {{name}} to Library",
                    { name: entry.name }
                  )}
                  className="flex flex-1 items-center justify-center gap-1 rounded border border-border p-2 text-xs disabled:opacity-40"
                >
                  {busy === entry.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : saved ? (
                    <Check size={13} />
                  ) : (
                    <Download size={13} />
                  )}
                  {ui(saved ? "Saved to Library" : "Save to Library")}
                </button>
                {onInsert && (
                  <button
                    type="button"
                    disabled={!!busy || !capabilities.uploads}
                    onClick={() => void save(entry.id, true)}
                    aria-label={ui("Add to timeline")}
                    title={ui("Add to timeline")}
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
      {message && (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      )}
    </section>
  );
}
