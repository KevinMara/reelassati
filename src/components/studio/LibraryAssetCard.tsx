import { useState } from "react";
import { GripVertical, Music2, Pencil, Check, X } from "lucide-react";
import type { Asset } from "@contracts/workspace";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { LIBRARY_ASSET_MIME } from "@/lib/editor-generations";
import { AssetThumbnail } from "./AssetThumbnail";

export function LibraryAssetCard({
  asset,
  view = "grid",
  onRename,
}: {
  asset: Asset;
  view?: "grid" | "list";
  onRename?: (name: string) => Promise<void>;
}) {
  const [preview, setPreview] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(asset.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function saveName() {
    if (!onRename || !name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await onRename(name.trim());
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename file.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div
        className={
          view === "list" ? "flex min-w-0 items-center gap-2" : "min-w-0"
        }
      >
        <button
          type="button"
          draggable={asset.status === "ready"}
          disabled={asset.status !== "ready"}
          onDragStart={e => {
            e.dataTransfer.setData(LIBRARY_ASSET_MIME, asset.id);
            e.dataTransfer.effectAllowed = "copy";
          }}
          onClick={() => setPreview(true)}
          aria-label={`Preview ${asset.name}`}
          title="Preview file · drag onto the timeline to place it"
          className={`group relative flex cursor-grab items-center justify-center overflow-hidden rounded-lg border border-border bg-background/70 active:cursor-grabbing ${view === "grid" ? "aspect-video w-full" : "h-12 w-16 shrink-0"}`}
        >
          {asset.kind === "audio" ? (
            <Music2 className="h-6 w-6 text-emerald-400" />
          ) : (
            <AssetThumbnail asset={asset} />
          )}
          <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/65 p-0.5 text-white/80">
            <GripVertical size={13} />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              onSubmit={e => {
                e.preventDefault();
                void saveName();
              }}
              className="mt-1 flex min-w-0 items-center gap-1"
            >
              <input
                aria-label="File name"
                ref={node => {
                  node?.focus();
                }}
                value={name}
                maxLength={240}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === "Escape") setEditing(false);
                }}
                className="min-w-0 flex-1 rounded border border-primary/40 bg-background px-2 py-1 text-xs"
              />
              <button
                type="submit"
                disabled={busy || !name.trim()}
                aria-label="Save file name"
                className="p-1 text-primary"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="Cancel rename"
                className="p-1"
              >
                <X size={13} />
              </button>
            </form>
          ) : (
            <div className="mt-1 flex items-center gap-1">
              <p
                title={asset.name}
                className="min-w-0 flex-1 truncate text-xs font-medium"
              >
                {asset.name}
              </p>
              {onRename && (
                <button
                  type="button"
                  onClick={() => {
                    setName(asset.name);
                    setEditing(true);
                  }}
                  aria-label={`Rename ${asset.name}`}
                  className="shrink-0 rounded p-1 text-foreground/45 hover:bg-primary/10 hover:text-primary"
                >
                  <Pencil size={12} />
                </button>
              )}
            </div>
          )}
          <p className="text-[11px] text-foreground/55">
            {asset.kind}
            {asset.duration ? ` · ${asset.duration.toFixed(1)}s` : ""}
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-400">
          {error}
        </p>
      )}
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-surface sm:max-w-2xl">
          <DialogTitle className="pr-7">{asset.name}</DialogTitle>
          <DialogDescription>
            Preview your file. Drag its thumbnail onto the timeline at the time
            you want it to start.
          </DialogDescription>
          {asset.kind === "image" ? (
            <img
              src={asset.url}
              alt={asset.name}
              className="max-h-[65vh] w-full rounded-lg object-contain"
            />
          ) : asset.kind === "audio" ? (
            <audio
              src={asset.url}
              controls
              preload="metadata"
              className="w-full"
            />
          ) : (
            <video
              src={asset.url}
              controls
              playsInline
              preload="metadata"
              className="max-h-[65vh] w-full rounded-lg bg-black"
            />
          )}
          <p className="text-xs text-foreground/50">
            {asset.contentType} · {(asset.size / 1024 / 1024).toFixed(1)} MB
            {asset.duration ? ` · ${asset.duration.toFixed(1)}s` : ""}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
