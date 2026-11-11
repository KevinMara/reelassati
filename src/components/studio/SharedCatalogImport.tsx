import { useEffect, useRef, useState } from "react";
import { getUiLocale, useUiText } from "@/lib/i18n/ui";
import { captureUploadRequestScope, platformApi } from "@/lib/platform-api";
import {
  CatalogImportError,
  prepareSharedCatalogImport,
  runSharedCatalogImport,
  type CatalogImportProgress,
  type PreparedCatalogImport,
} from "@/lib/shared-catalog-import";

/** Owner-only, explicitly started uploads. File handles and progress live only
 * in this mounted panel; resuming always checks the server's verified records. */
export function SharedCatalogImport() {
  const ui = useUiText();
  const locale = getUiLocale();
  const [prepared, setPrepared] = useState<PreparedCatalogImport>();
  const [progress, setProgress] = useState<CatalogImportProgress>();
  const [busy, setBusy] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [error, setError] = useState<{ key: string; detail: string }>();
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const selection = useRef(0);
  const input = useRef<HTMLInputElement>(null);
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
  const report = (value: unknown) => {
    const labels = {
      manifest: "The catalog manifest is invalid.",
      files: "A catalog file is missing or has the wrong size.",
      digest: "A catalog file failed verification.",
      server: "The import could not be completed.",
    };
    setError({
      key:
        value instanceof CatalogImportError
          ? labels[value.problem]
          : labels.server,
      detail: (value instanceof CatalogImportError
        ? value.detail
        : value instanceof Error
          ? value.message
          : ""
      ).slice(0, 300),
    });
  };
  const choose = async (files: File[]) => {
    if (controller.current || !files.length) return;
    const generation = ++selection.current;
    setSelecting(true);
    setError(undefined);
    setPrepared(undefined);
    setProgress(undefined);
    setStopped(false);
    try {
      const value = await prepareSharedCatalogImport(files);
      if (mounted.current && generation === selection.current)
        setPrepared(value);
    } catch (cause) {
      if (mounted.current && generation === selection.current) report(cause);
    } finally {
      if (mounted.current && generation === selection.current)
        setSelecting(false);
    }
  };
  const start = async () => {
    if (!prepared || controller.current) return;
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    setStopped(false);
    setError(undefined);
    try {
      const options = {
        signal: active.signal,
        scope: await captureUploadRequestScope(),
      };
      await runSharedCatalogImport(
        prepared,
        {
          status: ids => platformApi.catalogImportStatus(ids, options),
          manifest: manifest =>
            platformApi.catalogImportManifest(manifest, options),
          object: (id, role, file, metadata) =>
            platformApi.catalogImportObject(
              id,
              role,
              file,
              metadata.contentType,
              options
            ),
        },
        active.signal,
        next => {
          if (mounted.current && controller.current === active)
            setProgress(next);
        }
      );
    } catch (cause) {
      if (mounted.current) {
        if (active.signal.aborted) setStopped(true);
        else report(cause);
      }
    } finally {
      if (controller.current === active) controller.current = null;
      if (mounted.current) setBusy(false);
    }
  };
  const count = (value: number) => value.toLocaleString(locale);
  const size = (bytes: number) =>
    `${(bytes / 1024 ** 2).toLocaleString(locale, { maximumFractionDigits: 1 })} MiB`;
  const stage = error
    ? ui("The import could not be completed.")
    : stopped
      ? ui("Import stopped")
      : progress?.stage === "complete"
        ? ui("Import complete")
        : progress?.stage === "verifying"
          ? ui("Verifying file")
          : progress?.stage === "uploading"
            ? ui("Uploading file")
            : ui("Checking catalog");
  return (
    <section
      className="mb-6 rounded-2xl border border-border bg-surface p-6"
      aria-labelledby="catalog-import-title"
    >
      <h2 id="catalog-import-title" className="text-xl font-semibold">
        {ui("Shared catalog import")}
      </h2>
      <p className="mt-1 text-sm text-foreground/70">
        {ui(
          "Choose the prepared folder containing catalog.json and its media files."
        )}
      </p>
      <p className="mt-2 text-xs text-foreground/60">
        {ui(
          "Ready files are skipped. Stop keeps uploaded files for your next attempt."
        )}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <input
          ref={input}
          type="file"
          multiple
          {...{ webkitdirectory: "", directory: "" }}
          className="sr-only"
          tabIndex={-1}
          aria-label={ui("Choose catalog folder")}
          disabled={busy || selecting}
          onChange={event => {
            void choose(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50"
          disabled={busy || selecting}
          onClick={() => input.current?.click()}
        >
          {ui("Choose catalog folder")}
        </button>
        <button
          type="button"
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          disabled={!prepared || busy || selecting}
          onClick={() => {
            void start();
          }}
        >
          {ui("Start / resume import")}
        </button>
        {busy && (
          <button
            type="button"
            className="rounded-lg border border-border px-4 py-2 text-sm"
            onClick={() => controller.current?.abort()}
          >
            {ui("Stop")}
          </button>
        )}
      </div>
      {prepared && (
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-foreground/60">{ui("Files")}</dt>
            <dd>{count(prepared.objectCount)}</dd>
          </div>
          <div>
            <dt className="text-foreground/60">{ui("Size")}</dt>
            <dd>{size(prepared.totalBytes)}</dd>
          </div>
          <div>
            <dt className="text-foreground/60">{ui("Ready")}</dt>
            <dd>
              {count(progress?.completedItems ?? 0)} /{" "}
              {count(prepared.manifest.items.length)}
            </dd>
          </div>
          <div>
            <dt className="text-foreground/60">{ui("Uploaded")}</dt>
            <dd>{size(progress?.uploadedBytes ?? 0)}</dd>
          </div>
        </dl>
      )}
      {(selecting || progress) && (
        <div className="mt-4 space-y-2" aria-live="polite">
          <p className="text-sm">
            {selecting ? ui("Checking catalog") : stage}
            {progress?.currentName && (
              <span className="block break-words text-foreground/70">
                {progress.currentName}
              </span>
            )}
          </p>
          {progress && (
            <progress
              className="h-2 w-full accent-primary"
              aria-label={ui("Progress")}
              max={progress.totalItems}
              value={progress.completedItems}
            />
          )}
          {busy && progress?.stage === "verifying" && (
            <p className="text-xs text-foreground/60">
              {size(progress.verifiedBytes ?? 0)} /{" "}
              {size(progress.currentBytes ?? 0)}
            </p>
          )}
        </div>
      )}
      {error && (
        <div role="alert" className="mt-4 break-words text-sm text-destructive">
          <p>{ui(error.key)}</p>
          {error.detail && <p className="mt-1 text-xs">{error.detail}</p>}
        </div>
      )}
    </section>
  );
}
