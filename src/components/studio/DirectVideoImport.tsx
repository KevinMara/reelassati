import { useEffect, useRef, useState } from "react";
import type { Asset } from "@contracts/workspace";
import { DIRECT_VIDEO_HELP, validateDirectVideoUrl } from "@contracts/public-video";
import { importDirectVideo } from "@/lib/direct-video-import";
import { captureUploadRequestScope } from "@/lib/platform-api";

export function DirectVideoImport({ disabled = false, onImported }: { disabled?: boolean; onImported: (asset: Asset) => Promise<void> | void }) {
  const [url, setUrl] = useState("");
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState("");
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; controller.current?.abort(); }, []);
  function invalidate() {
    generation.current++; controller.current?.abort(); controller.current = null;
    setBusy(false); setDetail("");
  }
  async function run() {
    const id = ++generation.current;
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setDetail("");
    try {
      const scope = await captureUploadRequestScope();
      const asset = await importDirectVideo(url, { signal: abort.signal, scope, onProgress: value => { if (generation.current === id) setDetail(value); } });
      abort.signal.throwIfAborted();
      if (generation.current !== id) return;
      await onImported(asset);
      if (generation.current === id) { setUrl(""); setRights(false); setDetail("Video saved to your private Library. It is ready to use."); }
    } catch (error) { if (generation.current === id && !abort.signal.aborted) setDetail(error instanceof Error ? error.message : DIRECT_VIDEO_HELP); }
    finally { if (generation.current === id) { setBusy(false); controller.current = null; } }
  }
  const error = validateDirectVideoUrl(url);
  return <details className="mb-3 rounded-lg border border-border p-3">
    <summary className="cursor-pointer text-sm font-medium">Import a direct video link</summary>
    <p className="mt-2 text-xs text-foreground/70">{DIRECT_VIDEO_HELP} Maximum 256 MB and 2 minutes. Uploading the original is always available.</p>
    <input type="url" aria-label="Direct video URL" value={url} onChange={event => { invalidate(); setUrl(event.target.value); setRights(false); }} placeholder="https://cdn.example.com/video.mp4" className="mt-2 w-full rounded-md border border-border bg-background p-2 text-sm" disabled={disabled} />
    <label className="mt-2 flex gap-2 text-xs"><input type="checkbox" checked={rights} onChange={event => { invalidate(); setRights(event.target.checked); }} disabled={disabled} />I am authorized to download and use this video.</label>
    <div className="mt-2 flex gap-2"><button type="button" disabled={disabled || busy || !rights || !!error} onClick={() => void run()} className="rounded-md bg-primary px-3 py-2 text-xs text-white disabled:opacity-40">{busy ? "Importing…" : "Save private video · no AI credits"}</button>{busy ? <button type="button" onClick={invalidate} className="text-xs">Cancel</button> : null}</div>
    {detail || (url && error) ? <p role="status" className="mt-2 text-xs text-foreground/70">{detail || error}</p> : null}
  </details>;
}
