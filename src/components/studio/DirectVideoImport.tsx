import { useUiText } from "@/lib/i18n/ui";
import {
  socialVideoSource,
  SOCIAL_VIDEO_UNAVAILABLE,
} from "@contracts/social-video";
import { Link2, Upload, Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { Asset } from "@contracts/workspace";
import { validateDirectVideoUrl } from "@contracts/public-video";
import { importDirectVideo } from "@/lib/direct-video-import";
import {
  captureUploadRequestScope,
  verifyUploadRequestScope,
  type UploadRequestScope,
} from "@/lib/platform-api";

export function DirectVideoImport({
  disabled = false,
  onImported,
  onUpload,
}: {
  disabled?: boolean;
  onImported: (asset: Asset, scope: UploadRequestScope) => Promise<void> | void;
  onUpload?: () => void;
}) {
  const ui = useUiText();
  const inputId = useId();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState("");
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    []
  );
  function invalidate() {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setDetail("");
  }
  async function run() {
    const id = ++generation.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setDetail("");
    try {
      const scope = await captureUploadRequestScope();
      const asset = await importDirectVideo(url, {
        signal: abort.signal,
        scope,
        onProgress: value => {
          if (generation.current === id) setDetail(value);
        },
      });
      abort.signal.throwIfAborted();
      if (generation.current !== id) return;
      await verifyUploadRequestScope(scope);
      abort.signal.throwIfAborted();
      if (generation.current !== id) return;
      await onImported(asset, scope);
      if (generation.current === id) {
        setUrl("");
        setDetail(ui("Video saved to Library."));
      }
    } catch {
      if (generation.current === id && !abort.signal.aborted)
        setDetail(ui(SOCIAL_VIDEO_UNAVAILABLE));
    } finally {
      if (generation.current === id) {
        setBusy(false);
        controller.current = null;
      }
    }
  }
  const error = socialVideoSource(url) ? null : validateDirectVideoUrl(url);
  return (
    <section
      aria-label={ui("Add media")}
      className="mb-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5"
    >
      {onUpload && (
        <div className="mb-2.5 border-b border-primary/15 pb-2.5">
          <button
            type="button"
            disabled={disabled || busy}
            onClick={onUpload}
            className="flex h-8 w-full items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 text-xs font-medium hover:bg-primary/20 disabled:opacity-40"
          >
            <Upload size={14} />
            {ui("Upload files")}
          </button>
        </div>
      )}
      <label
        htmlFor={inputId}
        className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"
      >
        <Link2 size={13} />
        {ui("Import video link")}
      </label>
      <div className="flex gap-1.5">
        <input
          id={inputId}
          type="url"
          aria-label={ui("Video link")}
          value={url}
          onChange={event => {
            invalidate();
            setUrl(event.target.value);
          }}
          placeholder={ui("Paste a video or social link")}
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs"
          disabled={disabled}
        />
        <button
          type="button"
          aria-label={busy ? ui("Importing…") : ui("Import")}
          disabled={disabled || busy || !!error}
          onClick={() => void run()}
          className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : ui("Import")}
        </button>
        {busy ? (
          <button type="button" onClick={invalidate} className="text-xs">
            {ui("Cancel")}
          </button>
        ) : null}
      </div>
      {detail ? (
        <p role="status" className="mt-2 text-xs text-foreground/70">
          {detail}
        </p>
      ) : null}
    </section>
  );
}
