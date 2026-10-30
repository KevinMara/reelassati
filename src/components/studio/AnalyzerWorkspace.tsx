import { useMemo, useState } from "react";
import { ArrowRight, Download, Sparkles, Upload } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  buildAnalyzerOptimization,
  parseAudienceResponse,
  type AudienceResponse,
  type AnalyzerOptimization,
} from "@contracts/analyzer-report";
import type { Asset } from "@contracts/workspace";
import type { platformApi } from "@/lib/platform-api";
import { useUiText } from "@/lib/i18n/ui";
import { AnalysisReview } from "./AnalysisReview";

type Result = Awaited<ReturnType<typeof platformApi.analyzeVideo>>;
function downloadText(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AnalyzerWorkspace({
  asset,
  result,
  platform,
  onCreateProject,
  initialAudience,
  onAudienceChange,
}: {
  asset: Asset;
  result: Result;
  platform: string;
  onCreateProject: (
    optimization: AnalyzerOptimization
  ) => Promise<string | undefined>;
  initialAudience?: AudienceResponse;
  onAudienceChange?: (response: AudienceResponse | undefined) => Promise<void>;
}) {
  const ui = useUiText();
  const navigate = useNavigate();
  const [audience, setAudience] = useState<AudienceResponse | undefined>(
    initialAudience
  );
  const [source, setSource] = useState("");
  const [period, setPeriod] = useState("");
  const [views, setViews] = useState("");
  const [error, setError] = useState("");
  const [prepared, setPrepared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [projectId, setProjectId] = useState("");
  const optimization = useMemo(
    () =>
      buildAnalyzerOptimization({
        assetId: asset.id,
        sourceName: asset.name,
        duration: asset.duration!,
        platform,
        summary: result.summary,
        insights: result.insights || [],
        recommendations: result.recommendations || [],
        response: audience,
      }),
    [asset, result, platform, audience]
  );
  return (
    <div className="space-y-5">
      <AnalysisReview asset={asset} result={result} audience={audience} />
      <section className="analyzer-response rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mono-eyebrow text-primary">{ui("Evidence")}</p>
            <h2 className="mt-1 text-lg font-semibold">
              {ui("Audience response")}
            </h2>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
            {ui(
              audience
                ? "Imported audience retention"
                : "No audience measurements attached"
            )}
          </span>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground/65">
          {ui(
            "AI reviews content. Import retention for this exact edit to compare actual viewing behavior. This does not measure neural activity or dopamine."
          )}
        </p>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium">
            {ui("Add audience data · no AI credits")}
          </summary>
          <p className="mt-3 text-xs leading-relaxed text-foreground/65">
            {ui(
              "Use source seconds and retention percentages. Replays may exceed 100%. Import the same edit only. Data is user supplied."
            )}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-xs">
              {ui("Data source")}
              <input
                value={source}
                onChange={e => setSource(e.target.value)}
                maxLength={200}
                className="mt-1 w-full rounded-lg border border-border bg-background p-2.5"
                placeholder={ui("YouTube Analytics")}
              />
            </label>
            <label className="text-xs">
              {ui("Reporting period")}
              <input
                value={period}
                onChange={e => setPeriod(e.target.value)}
                maxLength={200}
                className="mt-1 w-full rounded-lg border border-border bg-background p-2.5"
                placeholder={ui("Date range and audience segment")}
              />
            </label>
            <label className="text-xs">
              {ui("Views in this dataset")}
              <input
                value={views}
                onChange={e => setViews(e.target.value)}
                type="number"
                min={1}
                step={1}
                className="mt-1 w-full rounded-lg border border-border bg-background p-2.5"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary/40 px-4 py-2.5 text-sm">
              <Upload className="h-4 w-4" />
              {ui("Import retention CSV")}
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={async event => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  try {
                    if (file.size > 250_000)
                      throw new Error("The retention file is too large.");
                    const response = parseAudienceResponse(await file.text(), {
                      assetId: asset.id,
                      duration: asset.duration!,
                      source,
                      period,
                      sampleSize: Number(views),
                    });
                    await onAudienceChange?.(response);
                    setAudience(response);
                    setPrepared(false);
                    setProjectId("");
                    setError("");
                  } catch (cause) {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "The data could not be imported."
                    );
                  }
                }}
              />
            </label>
            <code className="break-all text-xs text-foreground/60">
              {"time_seconds,retention_percent"}
            </code>
            {audience ? (
              <button
                type="button"
                className="text-sm text-foreground/65 underline"
                onClick={async () => {
                  try {
                    await onAudienceChange?.(undefined);
                  } catch (cause) {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "The data could not be saved."
                    );
                    return;
                  }
                  setAudience(undefined);
                  setPrepared(false);
                  setProjectId("");
                }}
              >
                {ui("Remove audience data")}
              </button>
            ) : null}
          </div>
        </details>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {ui(error)}
          </p>
        ) : null}
      </section>
      <section className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mono-eyebrow text-primary">
              {ui("From feedback to an edit")}
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              {ui("Optimize this video")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-foreground/65">
              {ui("Open a separate edit with these recommendations.")}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const id = projectId || (await onCreateProject(optimization));
                if (id) {
                  setProjectId(id);
                  navigate(
                    `/dashboard/edit?project=${encodeURIComponent(id)}&optimize=1`
                  );
                }
              } finally {
                setBusy(false);
              }
            }}
            className="ai-magic inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            <Sparkles className="h-4 w-4" />
            {ui(busy ? "Saving…" : "Optimize this video")}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setPrepared(!prepared)}
          aria-expanded={prepared}
          className="mt-3 text-xs text-muted-foreground hover:text-foreground"
        >
          {ui("Optimization brief")}
        </button>
        {prepared ? (
          <div className="mt-5 space-y-3">
            <label
              className="block text-sm font-medium"
              htmlFor={`optimization-${asset.id}`}
            >
              {ui("Optimization brief")}
            </label>
            <textarea
              id={`optimization-${asset.id}`}
              value={optimization.brief}
              readOnly
              rows={12}
              className="w-full rounded-xl border border-border bg-background p-4 font-mono text-xs leading-relaxed"
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  downloadText(
                    "reelassati-optimization.txt",
                    optimization.brief
                  )
                }
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm"
              >
                <Download className="h-4 w-4" />
                {ui("Download brief")}
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadText(
                    "reelassati-analysis.json",
                    JSON.stringify(
                      {
                        schemaVersion: result.schemaVersion,
                        source: {
                          id: asset.id,
                          name: asset.name,
                          duration: asset.duration,
                        },
                        platform,
                        summary: result.summary,
                        insights: result.insights,
                        structure: result.structure,
                        recommendations: result.recommendations,
                        overall: result.overall,
                        coverage: result.coverage,
                        review: result.review,
                        provenance: result.provenance,
                        scoringMethod:
                          "editorial-v1: duration-weighted 45% attention + 35% clarity + 20% processing ease; not a validated retention predictor",
                        audience,
                        optimization,
                      },
                      null,
                      2
                    ),
                    "application/json"
                  )
                }
                className="rounded-lg border border-border px-4 py-2.5 text-sm"
              >
                {ui("Download analysis")}
              </button>
              {projectId ? (
                <Link
                  to={`/dashboard/edit?project=${encodeURIComponent(projectId)}&optimize=1`}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
                >
                  {ui("Open in Edit")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const id = await onCreateProject(optimization);
                      if (id) setProjectId(id);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
                >
                  {ui(busy ? "Saving…" : "Create optimization project")}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
