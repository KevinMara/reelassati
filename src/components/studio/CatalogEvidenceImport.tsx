import { useEffect, useRef, useState } from "react";
import type { CatalogEvidence } from "@contracts/catalog-evidence";
import { captureUploadRequestScope, platformApi } from "@/lib/platform-api";

/** Owner maintenance, visible foreground only. No automatic resume or retries. */
export function CatalogEvidenceImport() {
  const [files, setFiles] = useState<File[]>([]),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null),
    mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const stop = () => controller.current?.abort();
    window.addEventListener("pagehide", stop);
    return () => {
      mounted.current = false;
      stop();
      window.removeEventListener("pagehide", stop);
    };
  }, []);
  const run = async (review: boolean) => {
    if (controller.current || !files.length) return;
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    setError("");
    try {
      const options = {
        signal: active.signal,
        scope: await captureUploadRequestScope(),
      };
      let completed = 0;
      const soundIds: string[] = [];
      for (let offset = 0; offset < files.length; offset += 20) {
        active.signal.throwIfAborted();
        const packets = await Promise.all(
          files.slice(offset, offset + 20).map(async file => {
            if (file.size > 2 * 1024 * 1024)
              throw new Error("An evidence file exceeds the size limit.");
            const packet = JSON.parse(await file.text()) as CatalogEvidence;
            if (
              packet.schemaVersion !== 1 ||
              !/^stock-[a-f0-9]{24}$/.test(packet.catalogId) ||
              file.name !== `${packet.catalogId}.json`
            )
              throw new Error("Choose the prepared evidence folder.");
            return packet;
          })
        );
        const status = await platformApi.catalogEvidenceStatus(
          packets.map(p => p.catalogId),
          options
        );
        const byId = new Map(status.items.map(i => [i.id, i]));
        const missing = packets.filter(p => !byId.get(p.catalogId)?.ready);
        // Keep request body well below platform proxy limits.
        let batch: CatalogEvidence[] = [],
          size = 0;
        for (const p of missing) {
          const length = JSON.stringify(p).length;
          if (size + length > 4 * 1024 * 1024 && batch.length) {
            await platformApi.catalogEvidenceUpload(batch, options);
            batch = [];
            size = 0;
          }
          batch.push(p);
          size += length;
        }
        if (batch.length)
          await platformApi.catalogEvidenceUpload(batch, options);
        for (const p of packets)
          if (p.kind === "audio" && !byId.get(p.catalogId)?.soundReviewed)
            soundIds.push(p.catalogId);
        completed += packets.length;
        if (mounted.current)
          setProgress(
            `${completed.toLocaleString()} / ${files.length.toLocaleString()} evidence records ready`
          );
      }
      if (review)
        for (let offset = 0; offset < soundIds.length; offset += 8) {
          active.signal.throwIfAborted();
          if (mounted.current)
            setProgress(
              `Listening to sounds · ${offset.toLocaleString()} / ${soundIds.length.toLocaleString()} reviewed`
            );
          await platformApi.catalogReviewSounds(
            soundIds.slice(offset, offset + 8),
            options
          );
        }
      if (mounted.current)
        setProgress(
          review
            ? `Complete · ${files.length.toLocaleString()} evidence records, ${soundIds.length.toLocaleString()} new sound reviews`
            : `Complete · ${files.length.toLocaleString()} evidence records ready`
        );
    } catch (cause) {
      if (mounted.current)
        setError(
          active.signal.aborted
            ? "Stopped. Completed records are saved."
            : cause instanceof Error
              ? cause.message
              : "Evidence import failed."
        );
    } finally {
      if (controller.current === active) controller.current = null;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <details className="mb-5 rounded-xl border border-border bg-surface p-4">
      <summary className="cursor-pointer text-sm font-medium">
        Catalog content evidence
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        Upload measured visual, motion, audio and color evidence. Sound review
        listens through the connected model and uses provider credits. It runs
        only while this page remains open.
      </p>
      <input
        className="mt-3 block w-full text-xs"
        type="file"
        multiple
        {...{ webkitdirectory: "", directory: "" }}
        aria-label="Choose catalog evidence folder"
        disabled={busy}
        onChange={e => {
          setFiles(
            Array.from(e.target.files || []).filter(f =>
              /^stock-[a-f0-9]{24}\.json$/.test(f.name)
            )
          );
          setProgress("");
          setError("");
        }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="rounded-lg border border-border px-3 py-2 text-xs"
          disabled={busy || !files.length}
          onClick={() => void run(false)}
        >
          Upload evidence
        </button>
        <button
          className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground"
          disabled={busy || !files.length}
          onClick={() => void run(true)}
        >
          Upload and review sounds
        </button>
        {busy && (
          <button
            className="rounded-lg border px-3 py-2 text-xs"
            onClick={() => controller.current?.abort()}
          >
            Stop evidence work
          </button>
        )}
        <span className="text-xs text-muted-foreground">
          {files.length.toLocaleString()} records selected
        </span>
      </div>
      <p role="status" className="mt-2 text-xs">
        {progress}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </details>
  );
}
