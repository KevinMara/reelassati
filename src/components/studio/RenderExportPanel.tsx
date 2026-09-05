import posthog from "@/lib/posthog";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Loader2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Asset, EditProject } from "@contracts/workspace";
import { platformApi } from "@/lib/platform-api";
import { useWorkspace } from "@/providers/workspace";
import { MAX_AI_MEDIA_BYTES } from "@contracts/uploads";

export function RenderExportPanel({
  project,
  onClose,
  onBrief,
}: {
  project: EditProject;
  onClose: () => void;
  onBrief: () => void;
}) {
  const { workspace, updateWorkspace } = useWorkspace();
  const [resolution, setResolution] = useState<720 | 1080>(720);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasRender, setHasRender] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Asset | null>(null);
  const [download, setDownload] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const pending = useRef<Awaited<
    ReturnType<typeof import("@/lib/render-video").renderVideo>
  > | null>(null);
  const uploaded = useRef<Asset | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(
    () => () => {
      if (download) URL.revokeObjectURL(download.url);
    },
    [download]
  );

  async function create() {
    setBusy(true);
    setError(null);
    abort.current = new AbortController();
    try {
      if (!pending.current) {
        const { renderVideo } = await import("@/lib/render-video");
        const result = await renderVideo(
          structuredClone(project),
          workspace.assets,
          {
            resolution,
            signal: abort.current.signal,
            onProgress: (n, label) => {
              setProgress(n);
              setStage(label);
            },
          }
        );
        pending.current = result;
        setHasRender(true);
        const hasAiSource =
          project.transcriptProvenance ||
          workspace.assets.some(
            a => a.provenance && project.clips.some(c => c.assetId === a.id)
          );
        if (!hasAiSource)
          setDownload({
            url: URL.createObjectURL(result.file),
            name: result.file.name,
          });
      }
      const result = pending.current;
      if (result.file.size > MAX_AI_MEDIA_BYTES) {
        pending.current = null;
        setHasRender(false);
        throw new Error(
          "This export exceeds the 24 MB finished-video limit. Use a shorter timeline or 720p. Your project is saved."
        );
      }
      setStage("Saving to your Library");
      setProgress(96);
      if (!uploaded.current)
        uploaded.current = await platformApi.uploadAsset(
          result.file,
          "video",
          undefined,
          project.id
        );
      const asset = {
        ...uploaded.current,
        projectId: project.id,
        duration: result.duration,
        width: result.width,
        height: result.height,
      };
      await updateWorkspace(current => ({
        ...current,
        assets: [asset, ...current.assets.filter(a => a.id !== asset.id)],
        projects: current.projects.map(p =>
          p.id === project.id ? { ...p, status: "review" as const } : p
        ),
      }));
      posthog?.capture("video_export_completed", {
        duration: result.duration,
        resolution,
      });
      setSaved(asset);
      // Download the finalized bytes, including the source's AI marking.
      try {
        const bytes = await platformApi.downloadAsset(
          asset.id,
          abort.current.signal
        );
        setDownload({
          url: URL.createObjectURL(
            new Blob([new Uint8Array(bytes).buffer], { type: "video/mp4" })
          ),
          name: result.file.name,
        });
      } catch {
        /* The saved video remains downloadable from the Library. */
      }
      setProgress(100);
      setStage("Saved to Library");
    } catch (cause) {
      setError(
        abort.current.signal.aborted
          ? "Export canceled. Your project is saved."
          : cause instanceof Error
            ? cause.message
            : "Export could not finish. Your project is saved."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-lg"
        onEscapeKeyDown={e => {
          if (busy) e.preventDefault();
        }}
        onPointerDownOutside={e => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogTitle>Export your video</DialogTitle>
        <DialogDescription>
          A finished MP4 with your cuts, images, captions, and audio. Saved to
          your Library and ready to publish.
        </DialogDescription>
        <p className="font-medium">{project.title}</p>
        <label className="text-sm">
          Resolution
          <select
            disabled={busy || hasRender}
            value={resolution}
            onChange={e => setResolution(Number(e.target.value) as 720 | 1080)}
            className="mt-2 w-full rounded-lg border border-border bg-background p-3"
          >
            <option value={720}>720p · faster export</option>
            <option value={1080}>1080p · more detail</option>
          </select>
        </label>
        <p className="text-sm text-foreground/70">
          {project.aspectRatio} canvas · up to 3 minutes. Keep this page open
          while exporting. Export uses no AI credits.
        </p>
        {busy && (
          <div role="status" aria-live="polite">
            <p className="mb-2 text-sm">
              {stage} · {progress}%
            </p>
            <progress
              className="h-2 w-full accent-primary"
              max={100}
              value={progress}
            />
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {saved ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-5 w-5" />
              Your video is ready
            </p>
            <Link
              to={`/dashboard/publish?asset=${encodeURIComponent(saved.id)}`}
              className="mt-4 block rounded-lg bg-primary p-3 text-center font-medium text-primary-foreground"
            >
              Prepare publication
            </Link>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void create()}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary p-3 font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {busy
              ? "Exporting…"
              : hasRender
                ? "Retry saving to Library"
                : "Create MP4"}
          </button>
        )}
        {busy && progress < 96 && (
          <button
            type="button"
            className="text-sm text-foreground/70"
            onClick={() => abort.current?.abort()}
          >
            Cancel export
          </button>
        )}
        {download && (
          <a
            href={download.url}
            download={download.name}
            className="text-center text-sm font-medium text-primary"
          >
            Download MP4
          </a>
        )}
        <button
          type="button"
          disabled={busy}
          className="text-sm text-foreground/70 underline underline-offset-4"
          onClick={onBrief}
        >
          Download edit brief instead
        </button>
        <a
          href="/open-source.html"
          target="_blank"
          rel="noreferrer"
          className="text-center text-xs text-foreground/60"
        >
          Export engine licenses
        </a>
      </DialogContent>
    </Dialog>
  );
}
