import { useEffect, useRef, useState } from "react";
import type { CatalogEvidence } from "@contracts/catalog-evidence";
import { captureUploadRequestScope, platformApi } from "@/lib/platform-api";
import {
  evidencePacket,
  inspectEvidenceBundle,
  readEvidenceBundle,
} from "@/lib/catalog-evidence-bundle";

/** Owner maintenance, visible foreground only. No automatic resume or retries. */
export function CatalogEvidenceImport() {
  const [files, setFiles] = useState<File[]>([]),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [bundle, setBundle] = useState<File | null>(null);
  const [bundleCount, setBundleCount] = useState(0);
  const count = bundle ? bundleCount : files.length;
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
  const run = async (review: false | "sound" | "visual") => {
    if (controller.current || !count) return;
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
      const visualIds: string[] = [];
      async function* batches() {
        if (bundle) {
          let batch: CatalogEvidence[] = [];
          for await (const packet of readEvidenceBundle(
            bundle,
            active.signal
          )) {
            batch.push(packet);
            if (batch.length === 20) {
              yield batch;
              batch = [];
            }
          }
          if (batch.length) yield batch;
          return;
        }
        for (let offset = 0; offset < files.length; offset += 20) {
          active.signal.throwIfAborted();
          yield await Promise.all(
            files.slice(offset, offset + 20).map(async file => {
              if (file.size > 2 * 1024 * 1024)
                throw new Error("An evidence file exceeds the size limit.");
              const packet = evidencePacket(JSON.parse(await file.text()));
              if (
                packet.schemaVersion !== 1 ||
                !/^stock-[a-f0-9]{24}$/.test(packet.catalogId) ||
                file.name !== `${packet.catalogId}.json`
              )
                throw new Error("Choose the prepared evidence folder.");
              return packet;
            })
          );
        }
      }
      for await (const packets of batches()) {
        active.signal.throwIfAborted();
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
          else if (
            (p.kind === "image" || p.kind === "video") &&
            !byId.get(p.catalogId)?.visualReviewed
          )
            visualIds.push(p.catalogId);
        completed += packets.length;
        if (mounted.current)
          setProgress(
            `${completed.toLocaleString()} / ${count.toLocaleString()} evidence records ready`
          );
      }
      if (review === "sound")
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
      if (review === "visual")
        // Each video carries a multi-frame contact sheet. Two independent
        // designs keep constrained multimodal output within reliable latency;
        // eight repeatedly failed mid-stream in production. Never retry a batch.
        for (let offset = 0; offset < visualIds.length; offset += 2) {
          active.signal.throwIfAborted();
          if (mounted.current)
            setProgress(
              `Inspecting visuals · ${offset.toLocaleString()} / ${visualIds.length.toLocaleString()} reviewed`
            );
          await platformApi.catalogReviewVisuals(
            visualIds.slice(offset, offset + 2),
            options
          );
        }
      if (mounted.current)
        setProgress(
          review
            ? `Complete · ${count.toLocaleString()} evidence records, ${(review === "sound" ? soundIds : visualIds).length.toLocaleString()} ${review} reviews`
            : `Complete · ${count.toLocaleString()} evidence records ready`
        );
    } catch (cause) {
      if (mounted.current)
        setError(
          active.signal.aborted
            ? "Stopped. Completed records are saved."
            : review
              ? `${review === "sound" ? "Sound" : "Visual"} review paused. Completed records are saved. Start again to continue with the remaining items.`
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
        Upload measured visual, motion, audio and color evidence. Content review
        inspects the actual samples through the connected model and uses
        provider credits. It runs only while this page remains open.
      </p>
      <input
        className="mt-3 block w-full text-xs"
        type="file"
        multiple
        {...{ webkitdirectory: "", directory: "" }}
        aria-label="Choose catalog evidence folder"
        disabled={busy}
        onChange={e => {
          setBundle(null);
          setBundleCount(0);
          setFiles(
            Array.from(e.target.files || []).filter(f =>
              /^stock-[a-f0-9]{24}\.json$/.test(f.name)
            )
          );
          setProgress("");
          setError("");
        }}
      />
      <label className="mt-3 block text-xs text-muted-foreground">
        Or use a single evidence bundle
        <input
          type="file"
          accept=".jsonl,.gz"
          aria-label="Choose catalog evidence bundle"
          className="mt-1 block w-full text-xs"
          disabled={busy}
          onChange={async e => {
            const selected = e.target.files?.[0];
            if (!selected) return;
            setError("");
            setProgress("");
            setFiles([]);
            setBundle(null);
            setBundleCount(0);
            try {
              if (selected.size > 512 * 1024 * 1024)
                throw new Error("The evidence bundle exceeds 512 MB.");
              const total = await inspectEvidenceBundle(selected);
              if (mounted.current) {
                setBundle(selected);
                setBundleCount(total);
              }
            } catch (cause) {
              if (mounted.current)
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Invalid evidence bundle."
                );
            }
          }}
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="rounded-lg border border-border px-3 py-2 text-xs"
          disabled={busy || !count}
          onClick={() => void run(false)}
        >
          Upload evidence
        </button>
        <button
          className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground"
          disabled={busy || !count}
          onClick={() => void run("sound")}
        >
          Upload and review sounds
        </button>
        <button
          type="button"
          disabled={busy || !count}
          onClick={() => void run("visual")}
          className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary disabled:opacity-50"
        >
          Upload and review visuals
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
          {count.toLocaleString()} records selected
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
