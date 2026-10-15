import { useUiText } from "@/lib/i18n/ui";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  FileSearch,
  FileUp,
  Loader2,
  ScanSearch,
  ShieldQuestion,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { PublicComplianceShell } from "@/components/compliance/PublicComplianceShell";
import { useFileDropZone } from "@/hooks/useFileDropZone";
import { platformApi, PlatformApiError } from "@/lib/platform-api";
import { validateFileSelection } from "@/lib/file-validation";
import type { ProvenanceDetectionResult } from "@contracts/compliance";

type InputMode = "text" | "file";

interface DisplayResult {
  status: "verified" | "partial" | "not-found" | "unsupported";
  label: string;
  summary: string;
  recordId?: string;
  signals: Array<{
    label: string;
    value: string;
    status: "verified" | "informational" | "missing" | "unsupported";
  }>;
  limitations: string[];
}

function createCopy(ui: ReturnType<typeof useUiText>) {
  return {
    back: ui("Back to home"),
    eyebrow: ui("Provenance detector"),
    title: ui("Check the evidence. Never guess the origin."),
    intro: ui(
      "Inspect pasted text or a media file for a REELassati provenance record and supported machine-readable signals. Inspection input is not retained. A missing signal means “not verified,” not “human-made.”"
    ),
    updated: ui("Evidence-based inspection"),
    textTab: ui("Pasted text"),
    fileTab: ui("File"),
    textLabel: ui("Text to inspect"),
    textPlaceholder: ui(
      "Paste the complete text or exported provenance block…"
    ),
    fileLabel: ui("File to inspect"),
    fileIdle: ui("Drop a file here, or click to choose"),
    fileDragging: ui("Drop it here"),
    fileTypes: ui(
      "Image, video, audio, JSON, or text · up to 64 MB · not retained"
    ),
    chooseFile: ui("Choose file"),
    inspect: ui("Inspect provenance"),
    inspecting: ui("Inspecting evidence"),
    reset: ui("Clear"),
    result: ui("Inspection result"),
    noResultTitle: ui("No result yet"),
    noResultBody: ui(
      "The detector will show verified, partial, missing, and unsupported signals separately."
    ),
    truthfulTitle: ui("What this result means"),
    truthfulBody: ui(
      "Provenance can help identify origin and processing history. It does not prove that the content is accurate, lawful, authorized, or safe to publish."
    ),
    unavailable: ui(
      "The verification service is not connected yet. Your input was not classified locally and no result was invented."
    ),
    genericError: ui("The provenance evidence could not be inspected."),
  };
}

function resultTone(status: DisplayResult["status"]) {
  if (status === "verified") {
    return {
      icon: CheckCircle2,
      card: "border-emerald-500/25 bg-emerald-500/[0.045]",
      text: "text-emerald-600 dark:text-emerald-400",
    };
  }
  if (status === "partial") {
    return {
      icon: ShieldQuestion,
      card: "border-amber-500/25 bg-amber-500/[0.045]",
      text: "text-amber-600 dark:text-amber-400",
    };
  }
  return {
    icon: AlertCircle,
    card: "border-border bg-surface",
    text: "text-foreground/55",
  };
}

function toDisplayResult(
  result: ProvenanceDetectionResult,
  ui: ReturnType<typeof useUiText>,
  locale: string
): DisplayResult {
  if (!result.provenance || result.verification === "unmatched") {
    return {
      status: "not-found",
      label: ui("No verified match"),
      summary: ui(
        "The service did not find a verifiable REELassati record for the supplied evidence. This does not prove that the content was human-made."
      ),
      signals: [
        {
          label: ui("Platform record"),
          value: ui("No verified match"),
          status: "missing",
        },
      ],
      limitations: [
        ui(
          "The content may come from another platform or may have had metadata removed."
        ),
      ],
    };
  }

  const provenance = result.provenance;
  const artifactVerified = result.verification === "artifact-verified";
  const artifactMismatch = result.verification === "artifact-mismatch";
  const origins = {
    human: ui("Human-created"),
    uploaded: ui("Uploaded source"),
    "ai-assisted": ui("AI-assisted"),
    "ai-generated": ui("AI-generated"),
    "ai-manipulated": ui("AI-manipulated"),
    "standard-edit": ui("Standard edit"),
  };
  const operations = {
    "script-generation": ui("Script generation"),
    "edit-planning": ui("Edit planning"),
    "video-analysis": ui("Video analysis"),
    transcription: ui("Transcription"),
    "speech-synthesis": ui("Speech synthesis"),
    "audio-generation": ui("Audio generation"),
    "image-generation": ui("Image generation"),
    "video-generation": ui("Video generation"),
    "trend-research": ui("Trend research"),
    "support-assistance": ui("Support assistance"),
    "publication-marking": ui("Publication marking"),
    "timeline-render": ui("Timeline rendering"),
  };
  const marking = {
    "not-required": ui("Not required"),
    pending: ui("Pending"),
    verified: ui("Verified"),
    failed: ui("Failed"),
  };
  const methods = {
    "text-token": ui("Text token"),
    "sha256-fingerprint": ui("SHA-256 fingerprint"),
    "embedded-media-marker": ui("Embedded media marker"),
  };
  const signalStatus = artifactVerified ? "verified" : "informational";
  return {
    status: artifactVerified ? "verified" : "partial",
    label: artifactVerified
      ? ui("Artifact and record verified")
      : artifactMismatch
        ? ui("Authentic record, different artifact")
        : ui("Authentic record token"),
    summary: artifactVerified
      ? ui(
          "The supplied text or file matches the REELassati record fingerprint. This verifies recorded provenance, not whether the content is true."
        )
      : artifactMismatch
        ? ui(
            "The token belongs to an authentic record, but the supplied text or file does not match its fingerprint. Do not use this token as evidence for the current artifact."
          )
        : ui(
            "The token identifies an authentic record, but no complete artifact was supplied for fingerprint comparison. This does not verify a specific text or file."
          ),
    signals: [
      {
        label: ui("Recorded origin"),
        value: origins[provenance.origin],
        status: signalStatus,
      },
      {
        label: ui("Operation"),
        value: operations[provenance.operation],
        status: signalStatus,
      },
      { label: ui("System"), value: "REELassati AI", status: signalStatus },
      {
        label: ui("Recorded at"),
        value: new Date(provenance.generatedAt).toLocaleString(locale),
        status: signalStatus,
      },
      {
        label: ui("Match method"),
        value: result.method ? methods[result.method] : ui("Not reported"),
        status: signalStatus,
      },
      {
        label: ui("Marking"),
        value: marking[provenance.markingStatus],
        status:
          provenance.markingStatus === "verified"
            ? "verified"
            : "informational",
      },
    ],
    limitations: [
      ...(artifactVerified
        ? []
        : [
            ui(
              "To verify the artifact, paste the complete text or upload the original file."
            ),
          ]),
      ui(
        "The record uses policy {{version}}; check for any material changes made afterward.",
        { version: provenance.policyVersion }
      ),
    ],
  };
}

function statusLabel(
  status: DisplayResult["status"] | DisplayResult["signals"][number]["status"],
  ui: ReturnType<typeof useUiText>
) {
  switch (status) {
    case "verified":
      return ui("Verified");
    case "partial":
      return ui("Partial");
    case "not-found":
      return ui("Not found");
    case "unsupported":
      return ui("Unsupported");
    case "informational":
      return ui("Informational");
    case "missing":
      return ui("Missing");
  }
}

export default function ProvenanceDetector() {
  const ui = useUiText();
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || "en";
  const copy = createCopy(ui);
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checkedTokenRef = useRef<string | null>(null);
  const [mode, setMode] = useState<InputMode>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ProvenanceDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chooseFile = (nextFile: File | null) => {
    setFile(nextFile);
    setResult(null);
    setError(null);
  };

  const acceptDetectorFiles = (files: File[]) => {
    const selection = validateFileSelection(files, {
      text: ui,
      purpose: "provenance",
    });
    if (selection.error) {
      setResult(null);
      setError(selection.error);
      return;
    }
    chooseFile(selection.files[0]);
  };

  const { isDragging, dropZoneProps } = useFileDropZone({
    disabled: checking,
    onFiles: acceptDetectorFiles,
  });

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    acceptDetectorFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  useEffect(() => {
    const token = searchParams.get("token")?.trim();
    if (!token || checkedTokenRef.current === token) return;
    checkedTokenRef.current = token;
    setChecking(true);
    setError(null);
    setResult(null);
    platformApi
      .detectProvenance({ token })
      .then(setResult)
      .catch((cause: unknown) => {
        if (
          cause instanceof PlatformApiError &&
          [404, 501, 503].includes(cause.status)
        ) {
          setError(
            "The verification service is not connected yet. Your input was not classified locally and no result was invented."
          );
        } else {
          setError(
            cause instanceof Error
              ? cause.message
              : "The provenance evidence could not be inspected."
          );
        }
      })
      .finally(() => setChecking(false));
  }, [searchParams]);

  const inspect = async () => {
    if (checking || (mode === "text" ? !text.trim() : !file)) return;
    setChecking(true);
    setResult(null);
    setError(null);
    try {
      const next = await platformApi.detectProvenance(
        mode === "file" && file ? { file } : { text: text.trim() }
      );
      setResult(next);
    } catch (cause) {
      if (
        cause instanceof PlatformApiError &&
        [404, 501, 503].includes(cause.status)
      ) {
        setError(
          "The verification service is not connected yet. Your input was not classified locally and no result was invented."
        );
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : "The provenance evidence could not be inspected."
        );
      }
    } finally {
      setChecking(false);
    }
  };

  const clear = () => {
    setText("");
    setFile(null);
    setResult(null);
    setError(null);
  };

  const displayResult = result
    ? toDisplayResult(result, ui, i18n.resolvedLanguage || i18n.language)
    : null;
  const tone = displayResult ? resultTone(displayResult.status) : null;
  const ResultIcon = tone?.icon;

  return (
    <PublicComplianceShell
      backLabel={copy.back}
      eyebrow={copy.eyebrow}
      title={copy.title}
      intro={copy.intro}
      updatedLabel={copy.updated}
    >
      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-2xl border border-border bg-surface p-6 md:p-7">
          <div
            className="grid grid-cols-2 gap-1 rounded-xl bg-background p-1"
            role="tablist"
          >
            {[
              { id: "text" as const, label: copy.textTab, icon: FileSearch },
              { id: "file" as const, label: copy.fileTab, icon: FileUp },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={mode === tab.id}
                onClick={() => {
                  setMode(tab.id);
                  setResult(null);
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  mode === tab.id
                    ? "bg-surface text-primary shadow-sm"
                    : "text-foreground/50 hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4" aria-hidden /> {tab.label}
              </button>
            ))}
          </div>

          {mode === "text" ? (
            <div className="mt-6">
              <label
                htmlFor="provenance-text"
                className="mb-2 block text-sm font-medium"
              >
                {copy.textLabel}
              </label>
              <textarea
                id="provenance-text"
                value={text}
                onChange={event => {
                  setText(event.target.value);
                  setResult(null);
                  setError(null);
                }}
                rows={12}
                placeholder={copy.textPlaceholder}
                className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm leading-6 outline-none transition-shadow placeholder:text-foreground/30 focus:ring-2 focus:ring-primary/30"
              />
              <p className="mt-2 text-right font-mono text-[10px] text-foreground/35">
                {text.length.toLocaleString(locale)} {ui("characters")}
              </p>
            </div>
          ) : (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium">{copy.fileLabel}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,application/json,text/plain,.md"
                className="sr-only"
                onChange={handleFileInput}
                aria-label={copy.fileLabel}
              />
              <button
                type="button"
                {...dropZoneProps}
                onClick={() => fileInputRef.current?.click()}
                disabled={checking}
                className={`flex min-h-64 w-full flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-all disabled:opacity-50 ${
                  isDragging
                    ? "scale-[1.005] border-primary bg-primary/10 shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]"
                    : "border-border bg-background hover:border-primary/45"
                }`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {file ? (
                    <FileCheck2 className="h-5 w-5" aria-hidden />
                  ) : (
                    <FileUp className="h-5 w-5" aria-hidden />
                  )}
                </span>
                <span className="mt-4 max-w-full truncate text-sm font-medium">
                  {file?.name ??
                    (isDragging ? copy.fileDragging : copy.fileIdle)}
                </span>
                <span className="mt-1 text-xs leading-5 text-foreground/45">
                  {file
                    ? ui("{{size}} MB · {{type}}", {
                        size: new Intl.NumberFormat(locale, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(file.size / 1024 / 1024),
                        type: file.type || ui("Unknown type"),
                      })
                    : copy.fileTypes}
                </span>
                {!file ? (
                  <span className="mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium">
                    {copy.chooseFile}
                  </span>
                ) : null}
              </button>
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => void inspect()}
              disabled={checking || (mode === "text" ? !text.trim() : !file)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ScanSearch className="h-4 w-4" aria-hidden />
              )}
              {checking ? copy.inspecting : copy.inspect}
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={checking || (!text && !file && !result && !error)}
              className="rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground/60 hover:text-foreground disabled:opacity-35"
            >
              {copy.reset}
            </button>
          </div>

          {error ? (
            <div
              className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.045] p-4 text-sm leading-6 text-foreground/65"
              role="alert"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden
              />
              {ui(error)}
            </div>
          ) : null}
        </section>

        <section aria-live="polite">
          <p className="mono-eyebrow text-primary">{copy.result}</p>
          {displayResult && tone && ResultIcon ? (
            <div className={`mt-3 rounded-2xl border p-6 md:p-7 ${tone.card}`}>
              <div className="flex items-start gap-4">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background ${tone.text}`}
                >
                  <ResultIcon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold">
                      {displayResult.label}
                    </h2>
                    <span
                      className={`rounded-pill bg-background px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider ${tone.text}`}
                    >
                      {statusLabel(displayResult.status, ui)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-foreground/60">
                    {displayResult.summary}
                  </p>
                  {displayResult.recordId ? (
                    <p className="mt-3 font-mono text-[10px] text-foreground/40">
                      {ui("Record")}: {displayResult.recordId}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 space-y-2">
                {displayResult.signals.map(signal => (
                  <div
                    key={`${signal.label}-${signal.value}`}
                    className="rounded-xl border border-border bg-background/65 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{signal.label}</p>
                        <p className="mt-1 text-xs leading-5 text-foreground/50">
                          {signal.value}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-pill bg-surface px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-foreground/45">
                        {statusLabel(signal.status, ui)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {displayResult.limitations.length ? (
                <details className="mt-5 rounded-xl border border-border bg-background/65 p-4">
                  <summary className="cursor-pointer text-sm font-medium">
                    {ui("Inspection limitations")}
                  </summary>
                  <ul className="mt-3 space-y-2 text-xs leading-5 text-foreground/50">
                    {displayResult.limitations.map(limitation => (
                      <li key={limitation}>• {limitation}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
              <ShieldQuestion className="h-8 w-8 text-primary/50" aria-hidden />
              <h2 className="mt-4 text-lg font-semibold">
                {copy.noResultTitle}
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-foreground/50">
                {copy.noResultBody}
              </p>
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-border bg-surface p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldQuestion className="h-4 w-4 text-primary" aria-hidden />{" "}
              {copy.truthfulTitle}
            </h2>
            <p className="mt-2 text-xs leading-5 text-foreground/50">
              {copy.truthfulBody}
            </p>
          </div>
        </section>
      </div>
    </PublicComplianceShell>
  );
}
