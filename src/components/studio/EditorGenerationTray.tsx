import { useState } from "react";
import {
  Check,
  Film,
  Image,
  Loader2,
  Mic2,
  Music2,
  Pencil,
  RotateCcw,
} from "lucide-react";
import {
  generationKindLabel,
  type EditorGeneration,
} from "@contracts/editor-generations";
import type { Asset, GenerationJob } from "@contracts/workspace";
import { LibraryAssetCard } from "./LibraryAssetCard";

export function EditorGenerationTray({
  records,
  assets,
  jobs,
  checking,
  onCheck,
  onRename,
  onRecoverVideo,
}: {
  records: EditorGeneration[];
  assets: Asset[];
  jobs: GenerationJob[];
  checking: string[];
  onCheck: (record: EditorGeneration) => Promise<void>;
  onRename: (record: EditorGeneration, name: string) => Promise<void>;
  onRecoverVideo: (record: EditorGeneration) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!records.length) return null;
  const ordered = [...records].sort(
    (a, b) =>
      Number(["submitting", "in_progress"].includes(b.status)) -
        Number(["submitting", "in_progress"].includes(a.status)) ||
      b.createdAt.localeCompare(a.createdAt)
  );
  return (
    <section
      aria-label="Generated files"
      className="mt-5 border-t border-border pt-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">Generated files</h3>
        <span className="text-xs text-foreground/45">{records.length}</span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-foreground/55">
        Ready files are saved to Library. Drag them onto the timeline whenever
        you need them.
      </p>
      <div className="space-y-2">
        {(expanded ? ordered : ordered.slice(0, 8)).map(record => (
          <GenerationCard
            key={record.id}
            record={record}
            asset={assets.find(a => a.id === record.assetId)}
            checking={checking.includes(record.id)}
            onCheck={onCheck}
            onRename={onRename}
            canRecover={
              record.kind === "video" &&
              record.status === "failed" &&
              jobs.some(
                job => job.id === record.jobId && job.canRecover === true
              )
            }
            onRecoverVideo={onRecoverVideo}
          />
        ))}
      </div>
      {records.length > 8 && (
        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          className="mt-3 text-xs text-primary"
        >
          {expanded ? "Show recent files" : `Show all ${records.length} files`}
        </button>
      )}
    </section>
  );
}

function GenerationCard({
  record,
  asset,
  checking,
  onCheck,
  onRename,
  canRecover,
  onRecoverVideo,
}: {
  record: EditorGeneration;
  asset?: Asset;
  checking: boolean;
  onCheck: (r: EditorGeneration) => Promise<void>;
  onRename: (r: EditorGeneration, name: string) => Promise<void>;
  canRecover: boolean;
  onRecoverVideo: (r: EditorGeneration) => Promise<void>;
}) {
  const [rename, setRename] = useState(false);
  const [name, setName] = useState(record.name);
  const [error, setError] = useState("");
  const Icon =
    record.kind === "video"
      ? Film
      : record.kind === "image"
        ? Image
        : record.kind === "voice"
          ? Mic2
          : Music2;
  const pending =
    record.status === "submitting" || record.status === "in_progress";
  return (
    <article className="rounded-xl border border-border bg-background/50 p-2.5">
      {asset ? (
        <LibraryAssetCard
          asset={asset}
          view="list"
          onRename={name => onRename(record, name)}
        />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Icon size={15} className="shrink-0 text-primary" />
            {rename ? (
              <form
                className="flex min-w-0 flex-1"
                onSubmit={e => {
                  e.preventDefault();
                  void onRename(record, name)
                    .then(() => setRename(false))
                    .catch(e => setError(e.message));
                }}
              >
                <input
                  ref={node => {
                    node?.focus();
                  }}
                  aria-label={`Name for ${record.name}`}
                  value={name}
                  maxLength={240}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === "Escape") setRename(false);
                  }}
                  className="min-w-0 flex-1 rounded border border-primary/30 bg-background px-2 text-xs"
                />
                <button
                  type="submit"
                  aria-label="Save generation name"
                  disabled={!name.trim()}
                  className="p-1 text-primary"
                >
                  <Check size={14} />
                </button>
              </form>
            ) : (
              <>
                <p className="min-w-0 flex-1 truncate text-xs font-medium">
                  {record.name}
                </p>
                <button
                  type="button"
                  aria-label={`Rename ${record.name}`}
                  onClick={() => {
                    setName(record.name);
                    setRename(true);
                  }}
                  className="p-1 text-foreground/50"
                >
                  <Pencil size={12} />
                </button>
              </>
            )}
          </div>
          <p
            className={`mt-2 flex items-center gap-1.5 text-xs ${record.status === "failed" ? "text-red-400" : "text-foreground/55"}`}
          >
            {pending && <Loader2 size={12} className="animate-spin" />}
            {record.status === "failed"
              ? record.error || "Generation failed."
              : record.status === "completed"
                ? "This file is no longer in Library."
                : "Waiting for provider output. You can keep creating or check saved results."}
          </p>
          {canRecover ? (
            <div className="mt-2 space-y-1.5">
              <button
                type="button"
                disabled={checking}
                onClick={() => void onRecoverVideo(record)}
                className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary disabled:opacity-40"
              >
                {checking ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RotateCcw size={12} />
                )}
                {checking ? "Recovering video…" : "Recover video"}
              </button>
              <p className="text-[11px] leading-relaxed text-foreground/50">
                Retrieves the existing output · no new generation or credit
                charge.
              </p>
            </div>
          ) : (
            <button
              type="button"
              disabled={checking}
              onClick={() => void onCheck(record)}
              className="mt-2 flex items-center gap-1.5 rounded-lg border border-primary/25 px-2.5 py-1.5 text-xs text-primary disabled:opacity-40"
            >
              {checking && <Loader2 size={12} className="animate-spin" />}Check{" "}
              {generationKindLabel[record.kind].toLowerCase()}
            </button>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </article>
  );
}
