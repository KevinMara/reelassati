import { useUiText } from "@/lib/i18n/ui";
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
import {
  captureUploadRequestScope,
  platformApi,
  verifyUploadRequestScope,
  type UploadRequestScope,
} from "@/lib/platform-api";
import { selectedBrand } from "@/lib/workspace-scope";
import {
  deliverBrowserExport,
  type ExportDestination,
} from "@/lib/export-delivery";
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
  const ui = useUiText();
  const { workspace, updateWorkspace, getWorkspaceSnapshot } = useWorkspace();
  const requiresMarking = Boolean(
    project.transcriptProvenance ||
    workspace.assets.some(
      a => a.provenance && project.clips.some(c => c.assetId === a.id)
    )
  );
  const [destination, setDestination] = useState<ExportDestination>("download");
  const actualDestination = requiresMarking ? "library" : destination;
  const [localDone, setLocalDone] = useState(false);
  const [exportScope, setExportScope] = useState<UploadRequestScope | null>(
    null
  );
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
  const brandId = selectedBrand(workspace.profile.email.toLowerCase());
  const workspaceChanged = Boolean(
    exportScope &&
    (exportScope.ownerEmail !== workspace.profile.email.toLowerCase() ||
      exportScope.brandId !== brandId)
  );
  useEffect(
    () => () => abort.current?.abort(),
    [project.id, workspace.profile.email, brandId]
  );
  useEffect(
    () => () => {
      if (download) URL.revokeObjectURL(download.url);
    },
    [download]
  );

  async function create() {
    if (busy || workspaceChanged) return;
    setBusy(true);
    setError(null);
    abort.current = new AbortController();
    try {
      const scope = exportScope ?? (await captureUploadRequestScope());
      setExportScope(scope);
      const assertTarget = () => {
        abort.current!.signal.throwIfAborted();
        const latest = getWorkspaceSnapshot();
        if (
          latest.profile.email.toLowerCase() !== scope.ownerEmail ||
          selectedBrand(scope.ownerEmail) !== scope.brandId ||
          !latest.projects.some(p => p.id === project.id)
        )
          throw new Error(
            ui(
              "The account, brand or project changed. Reopen export in the intended workspace."
            )
          );
      };
      assertTarget();
      await verifyUploadRequestScope(scope);
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
        assertTarget();
        if (!requiresMarking)
          setDownload({
            url: URL.createObjectURL(result.file),
            name: result.file.name,
          });
      }
      const result = pending.current;
      assertTarget();
      await verifyUploadRequestScope(scope);
      const delivery = await deliverBrowserExport(result, {
        destination: actualDestination,
        requiresMarking,
        upload: async () => {
          setStage("Saving to your Library");
          setProgress(99);
          assertTarget();
          uploaded.current ??= await platformApi.uploadAsset(
            result.file,
            "video",
            undefined,
            project.id,
            { scope, signal: abort.current!.signal }
          );
          await verifyUploadRequestScope(scope);
          assertTarget();
          return uploaded.current;
        },
        save: async asset => {
          await updateWorkspace(current => {
            assertTarget();
            return {
              ...current,
              assets: [asset, ...current.assets.filter(a => a.id !== asset.id)],
              projects: current.projects.map(p =>
                p.id === project.id ? { ...p, status: "review" as const } : p
              ),
            };
          });
        },
        download: async asset => {
          const bytes = await platformApi.downloadAsset(
            asset.id,
            abort.current!.signal
          );
          await verifyUploadRequestScope(scope);
          assertTarget();
          return bytes;
        },
      });
      assertTarget();
      if (delivery.file)
        setDownload({
          url: URL.createObjectURL(delivery.file),
          name: delivery.file.name,
        });
      setSaved(delivery.asset);
      setLocalDone(!delivery.asset);
      posthog?.capture("video_export_completed", {
        duration: result.duration,
        resolution,
        frameRate: result.frameRate,
        format: result.format,
        destination: actualDestination,
      });
      setProgress(100);
      setStage(delivery.asset ? "Saved to Library" : "Ready to download");
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
        <DialogTitle>{ui("Export your video")}</DialogTitle>
        <DialogDescription>
          {ui(
            "Your device renders your cuts, images, motion graphics, captions and audio. Download the result or save it to your Library."
          )}
        </DialogDescription>
        <p className="font-medium">{project.title}</p>
        <label className="text-sm" htmlFor={`${settingsId}-destination`}>
          {ui("Save to")}
          <CompactSelect
            id={`${settingsId}-destination`}
            aria-label={ui("Export destination")}
            disabled={busy || hasRender || requiresMarking}
            value={actualDestination}
            onValueChange={value => setDestination(value as ExportDestination)}
            options={[
              { value: "download", label: "Download only · no Library upload" },
              { value: "library", label: "Library · save and publish later" },
            ]}
          />
        </label>
        {requiresMarking && (
          <p className="text-xs text-foreground/70">
            {ui(
              "This project includes AI media. Library saving finalizes its AI source marking before download."
            )}
          </p>
        )}

        <label htmlFor={`${settingsId}-resolution`} className="text-sm">
          {ui("Resolution")}
          <CompactSelect
            id={`${settingsId}-resolution`}
            aria-label={ui("Resolution")}
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
            {ui("Frame rate")}
            <CompactSelect
              id={`${settingsId}-frame-rate`}
              aria-label={ui("Export frame rate")}
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
            {ui("Format")}
            <CompactSelect
              id={`${settingsId}-format`}
              aria-label={ui("Export format")}
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
          {project.aspectRatio} {ui("canvas ·")}{" "}
          {exportDimensions(project.aspectRatio, resolution).width} ×{" "}
          {exportDimensions(project.aspectRatio, resolution).height} ·{" "}
          {frameRate}{" "}
          {ui(
            "fps. Rendering uses this device’s processor and memory. Keep this page open while exporting. Templates and rendering use no AI credits; Library storage and AI generation have their own allowances."
          )}
        </p>
        {resolution === 2160 && (
          <p className="text-sm text-foreground/70">
            {ui(
              "4K needs more memory and time, especially for long timelines or several video layers."
            )}
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
        {workspaceChanged ? (
          <p role="alert" className="text-sm text-destructive">
            {ui(
              "The workspace changed. Close this dialog and reopen export in the intended workspace."
            )}
          </p>
        ) : localDone ? (
          <p
            role="status"
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm"
          >
            {ui(
              "Your video is ready to download. No copy was uploaded to Library."
            )}
          </p>
        ) : saved ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-5 w-5" />
              {ui("Your video is ready")}
            </p>
            <Link
              to={`/dashboard/publish?asset=${encodeURIComponent(saved.id)}`}
              className="mt-4 block rounded-lg bg-primary p-3 text-center font-medium text-primary-foreground"
            >
              {ui("Prepare publication")}
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
              ? ui("Exporting…")
              : hasRender
                ? ui("Retry saving to Library")
                : `Create ${format === "mp4" ? "MP4" : "WebM"}`}
          </button>
        )}
        {busy && !hasRender && (
          <button
            type="button"
            className="text-sm text-foreground/70"
            onClick={() => abort.current?.abort()}
          >
            {ui("Cancel export")}
          </button>
        )}
        {download && !workspaceChanged && (
          <a
            href={download.url}
            download={download.name}
            className="text-center text-sm font-medium text-primary"
          >
            {ui("Download")} {format === "webm" ? "WebM" : "MP4"}
          </a>
        )}
        <button
          type="button"
          disabled={busy}
          className="text-sm text-foreground/70 underline underline-offset-4"
          onClick={onBrief}
        >
          {ui("Download edit brief instead")}
        </button>
        <a
          href="/open-source.html"
          target="_blank"
          rel="noreferrer"
          className="text-center text-xs text-foreground/60"
        >
          {ui("Export engine licenses")}
        </a>
      </DialogContent>
    </Dialog>
  );
}
