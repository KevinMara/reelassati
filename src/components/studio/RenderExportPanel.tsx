import posthog from "@/lib/posthog";
import { useEffect, useId, useRef, useState } from "react";
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
import { CompactSelect } from "@/components/ui/compact-select";
import {
  exportDimensions,
  exportFrameRates,
  type ExportResolution,
  type ExportFrameRate,
  type ExportFormat,
} from "@contracts/export-settings";

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
  const settingsId = useId();
  const [resolution, setResolution] = useState<ExportResolution>(720);
  const [frameRateOverride, setFrameRate] = useState<ExportFrameRate>();
  const frameRate = frameRateOverride ?? project.frameRate ?? 30;
  const [format, setFormat] = useState<ExportFormat>("mp4");
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
            frameRate,
            format,
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
      setStage("Saving to your Library");
      setProgress(96);
      if (!uploaded.current)
        uploaded.current = await platformApi.uploadAsset(
          result.file,
          "video",
          undefined,
          project.id
        );
      if (uploaded.current.contentType !== result.file.type)
        throw new Error(
          "The saved video has a different format than the export. Please retry saving to Library."
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
        frameRate: result.frameRate,
        format: result.format,
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
            new Blob([new Uint8Array(bytes).buffer], {
              type: asset.contentType,
            })
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
          A finished video with your cuts, images, captions, and audio. Saved to
          your Library and ready to publish.
        </DialogDescription>
        <p className="font-medium">{project.title}</p>
        <label htmlFor={`${settingsId}-resolution`} className="text-sm">
          Resolution
          <CompactSelect
            id={`${settingsId}-resolution`}
            aria-label="Resolution"
            disabled={busy || hasRender}
            value={String(resolution)}
            onValueChange={value =>
              setResolution(Number(value) as ExportResolution)
            }
            className="mt-2"
            options={[
              { value: "720", label: "720p · faster export" },
              { value: "1080", label: "1080p · more detail" },
              { value: "2160", label: "4K · maximum detail" },
            ]}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label htmlFor={`${settingsId}-frame-rate`} className="text-sm">
            Frame rate
            <CompactSelect
              id={`${settingsId}-frame-rate`}
              aria-label="Export frame rate"
              className="mt-2"
              disabled={busy || hasRender}
              value={String(frameRate)}
              onValueChange={value =>
                setFrameRate(Number(value) as ExportFrameRate)
              }
              options={exportFrameRates.map(value => ({
                value: String(value),
                label: `${value} fps${value === (project.frameRate ?? 30) ? " · project" : ""}`,
              }))}
            />
          </label>
          <label htmlFor={`${settingsId}-format`} className="text-sm">
            Format
            <CompactSelect
              id={`${settingsId}-format`}
              aria-label="Export format"
              className="mt-2"
              disabled={busy || hasRender}
              value={format}
              onValueChange={value => setFormat(value as ExportFormat)}
              options={[
                { value: "mp4", label: "MP4" },
                { value: "webm", label: "WebM" },
              ]}
            />
          </label>
        </div>
        <p className="text-sm text-foreground/70">
          {project.aspectRatio} canvas ·{" "}
          {exportDimensions(project.aspectRatio, resolution).width} ×{" "}
          {exportDimensions(project.aspectRatio, resolution).height} ·{" "}
          {frameRate} fps. Keep this page open while exporting. Export uses no
          AI credits.
        </p>
        {resolution === 2160 && (
          <p className="text-sm text-foreground/70">
            4K needs more memory and time, especially for long timelines or
            several video layers.
          </p>
        )}
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
                : `Create ${format === "mp4" ? "MP4" : "WebM"}`}
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
            Download {format === "webm" ? "WebM" : "MP4"}
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
