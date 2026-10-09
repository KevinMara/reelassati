import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { WandSparkles } from "lucide-react";
import type { Asset } from "@contracts/workspace";
import { CompactSelect } from "@/components/ui/compact-select";
import { AI_CREDIT_COSTS, timedCreditCost } from "@contracts/billing";
import {
  DIRECT_VIDEO_HELP,
  validateDirectVideoUrl,
} from "@contracts/public-video";
import { useWorkspace } from "@/providers/workspace";
import { useAuth } from "@/hooks/useAuth";
import {
  platformApi,
  captureUploadRequestScope,
  verifyUploadRequestScope,
  type UploadRequestScope,
} from "@/lib/platform-api";
import { selectedBrand } from "@/lib/workspace-scope";
import { importDirectVideo } from "@/lib/direct-video-import";
import { resolveMediaDuration } from "@/lib/media-metadata";
import { validateFileSelection } from "@/lib/file-validation";
import {
  EDIT_REFERENCE_ASPECTS,
  SCRIPT_REFERENCE_ASPECTS,
  buildReferenceEvidence,
  referenceEvidenceBrief,
} from "@/lib/reference-evidence";

interface ReferenceStylePanelProps {
  onChange: (brief: string) => void;
  disabled: boolean;
  purpose?: "edit" | "script";
  projectId?: string;
}
export function ReferenceStylePanel(props: ReferenceStylePanelProps) {
  const { user } = useAuth();
  const scope = JSON.stringify([
    user?.id,
    user?.email,
    selectedBrand(user?.email),
    props.projectId,
    props.purpose,
  ]);
  return <ReferenceStyleSession key={scope} {...props} />;
}
function ReferenceStyleSession({
  onChange,
  disabled,
  purpose = "edit",
  projectId,
}: ReferenceStylePanelProps) {
  const { workspace, updateWorkspace, getWorkspaceSnapshot, capabilities } =
    useWorkspace();
  const { user } = useAuth();
  const aspects =
    purpose === "script" ? SCRIPT_REFERENCE_ASPECTS : EDIT_REFERENCE_ASPECTS;
  const [assetId, setAssetId] = useState("");
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<string[]>([...aspects]);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const asset = workspace.assets.find(a => a.id === assetId);
  const measured =
    !!asset && Number.isFinite(asset.duration) && asset.duration! > 0;
  const cost = measured
    ? timedCreditCost(asset.duration, AI_CREDIT_COSTS.videoAnalysisPerMinute)
    : null;
  const context = {
    ownerId: user?.id ?? "",
    ownerEmail: user?.email.toLowerCase() ?? "",
    brandId: selectedBrand(user?.email),
    projectId,
    sourceKey: JSON.stringify([assetId, url, purpose]),
  };
  const contextRef = useRef(context);
  useLayoutEffect(() => {
    contextRef.current = {
      ownerId: context.ownerId,
      ownerEmail: context.ownerEmail,
      brandId: context.brandId,
      projectId,
      sourceKey: context.sourceKey,
    };
  }, [
    context.ownerId,
    context.ownerEmail,
    context.brandId,
    projectId,
    context.sourceKey,
  ]);
  const mounted = useRef(true);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  function invalidate() {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setResult("");
    setDetail("");
    onChange("");
  }

  async function run(
    task: (
      scope: UploadRequestScope,
      signal: AbortSignal,
      current: () => void,
      progress: (stage: string) => void
    ) => Promise<void>
  ) {
    const expected = { ...contextRef.current };
    const id = ++generation.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const current = () => {
      abort.signal.throwIfAborted();
      const active = contextRef.current;
      if (
        !mounted.current ||
        generation.current !== id ||
        active.ownerId !== expected.ownerId ||
        active.ownerEmail !== expected.ownerEmail ||
        active.brandId !== expected.brandId ||
        active.projectId !== expected.projectId ||
        active.sourceKey !== expected.sourceKey ||
        (expected.projectId &&
          !getWorkspaceSnapshot().projects.some(
            p => p.id === expected.projectId
          ))
      ) {
        abort.abort();
        throw new DOMException(
          "Reference task cancelled because its workspace or source changed.",
          "AbortError"
        );
      }
    };
    const progress = (stage: string) => {
      current();
      setDetail(stage);
    };
    setBusy(true);
    setError("");
    setDetail("");
    setResult("");
    onChange("");
    try {
      const scope = await captureUploadRequestScope();
      current();
      if (
        scope.ownerId !== expected.ownerId ||
        scope.ownerEmail !== expected.ownerEmail ||
        scope.brandId !== expected.brandId
      )
        throw new Error(
          "Your account or brand changed. Start again in the intended workspace."
        );
      await task(scope, abort.signal, current, progress);
    } catch (cause) {
      if (mounted.current && generation.current === id && !abort.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "The reference could not be inspected. Upload the original instead."
        );
    } finally {
      if (mounted.current && generation.current === id) {
        setBusy(false);
        controller.current = null;
      }
    }
  }

  async function saveImported(
    imported: Asset,
    scope: UploadRequestScope,
    current: () => void
  ) {
    await verifyUploadRequestScope(scope);
    current();
    await updateWorkspace(w => {
      current();
      if (w.profile.email.toLowerCase() !== scope.ownerEmail)
        throw new Error(
          "The destination workspace changed. Start the import again."
        );
      return {
        ...w,
        assets: [...w.assets.filter(a => a.id !== imported.id), imported],
      };
    });
    current();
    setAssetId(imported.id);
    setUrl("");
    setDetail(
      `Reference saved · ${imported.duration?.toFixed(2)} seconds. Review the analysis quote below.`
    );
  }

  function upload(file: File) {
    const checked = validateFileSelection([file], {
      purpose: "media",
      multiple: false,
      maxFiles: 1,
    });
    if (checked.error || !file.type.startsWith("video/")) {
      setError(checked.error || "Choose a video file.");
      return;
    }
    void run(async (scope, signal, current, progress) => {
      progress("Measuring the reference video…");
      const objectUrl = URL.createObjectURL(file);
      let duration: number;
      try {
        duration = await resolveMediaDuration({
          id: "local-reference",
          name: file.name,
          kind: "video",
          contentType: file.type,
          size: file.size,
          url: objectUrl,
          status: "ready",
          createdAt: new Date().toISOString(),
        });
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
      current();
      const imported = await platformApi.uploadAsset(
        file,
        "video",
        percent => progress(`Saving private reference · ${percent}%`),
        undefined,
        { scope, signal }
      );
      current();
      await saveImported({ ...imported, duration }, scope, current);
    });
  }

  function importLink() {
    if (!rights) return;
    void run(async (scope, signal, current, progress) => {
      const imported = await importDirectVideo(url, {
        scope,
        signal,
        onProgress: progress,
      });
      current();
      await saveImported(imported, scope, current);
    });
  }

  function measureSelected() {
    if (!asset) return;
    const source = asset;
    void run(async (scope, _signal, current, progress) => {
      progress("Measuring reference duration…");
      const duration = await resolveMediaDuration(source);
      await verifyUploadRequestScope(scope);
      current();
      if (!getWorkspaceSnapshot().assets.some(a => a.id === source.id))
        throw new Error("The reference was removed.");
      await updateWorkspace(w => {
        current();
        return {
          ...w,
          assets: w.assets.map(a =>
            a.id === source.id ? { ...a, duration } : a
          ),
        };
      });
      current();
      setDetail("Duration measured. Review the analysis quote below.");
    });
  }

  function analyze() {
    if (!rights || !measured || !asset || !selected.length) return;
    const source = asset;
    const chosen = [...selected];
    void run(async (scope, signal, current, progress) => {
      current();
      if (!getWorkspaceSnapshot().assets.some(a => a.id === source.id))
        throw new Error("The reference was removed.");
      const response = await (
        await import("@/lib/analyze-media")
      ).analyzeMedia(
        source,
        "instagram",
        `Create an evidence-focused reference brief for ONLY these aspects: ${chosen.join(", ")}. Describe observed shot/action changes and relevant style or sound with source timestamps. Distinguish observations from unknowns. Exact font, color values, camera settings, sound identity and audio levels remain unknown unless measured. Editorial suggestions are not observations. Do not copy dialogue, melody or copyrighted assets. If the video cannot be inspected, say so; never invent a style.`,
        progress,
        signal,
        scope
      );
      await verifyUploadRequestScope(scope);
      current();
      if (!getWorkspaceSnapshot().assets.some(a => a.id === source.id))
        throw new Error("The reference was removed.");
      const evidence = buildReferenceEvidence(
        { assetId: source.id, duration: source.duration! },
        response,
        chosen,
        purpose
      );
      setResult(evidence.summary);
      onChange(referenceEvidenceBrief(evidence));
      setDetail(
        `${evidence.observations.length} valid source intervals. Exact technical parameters remain unknown.`
      );
    });
  }

  return (
    <details className="my-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <summary className="cursor-pointer text-sm font-medium">
        {purpose === "script"
          ? "Learn from a reference hook or script"
          : "Match a reference style or video"}
      </summary>
      <fieldset
        disabled={busy || disabled}
        className="mt-3 space-y-3 disabled:opacity-50"
      >
        <p className="text-xs text-foreground/70">
          Choose an owned video, upload an original, or import a final video
          file. Import and measurement use no AI credits. Analysis is a separate
          action at the measured quote. Reference source timestamps are mapped
          to your own footage when planning edits.
        </p>
        <CompactSelect
          aria-label="Reference video"
          value={assetId}
          onValueChange={value => {
            invalidate();
            setAssetId(value);
            setUrl("");
          }}
          options={[
            { value: "", label: "Import or upload a reference" },
            ...workspace.assets
              .filter(a => a.kind === "video" && a.status === "ready")
              .map(a => ({ value: a.id, label: a.name })),
          ]}
        />
        {!assetId && (
          <>
            <input
              type="url"
              aria-label="Reference direct video link"
              value={url}
              onChange={e => {
                invalidate();
                setUrl(e.target.value);
                setRights(false);
              }}
              placeholder="https://cdn.example.com/reference.mp4"
              className="w-full rounded-lg border border-border bg-background p-2 text-sm"
            />
            <p className="text-xs text-foreground/70">
              {DIRECT_VIDEO_HELP} Direct imports: up to 256 MB and 2 minutes.
            </p>
            <button
              type="button"
              disabled={
                !rights ||
                !url.trim() ||
                !!validateDirectVideoUrl(url) ||
                !capabilities.uploads
              }
              onClick={importLink}
              className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40"
            >
              Import private reference · no AI credits
            </button>
          </>
        )}
        <label className="block text-xs">
          Upload reference
          <input
            type="file"
            accept="video/*"
            className="mt-1 block w-full text-xs"
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) upload(file);
            }}
          />
        </label>
        <button
          type="button"
          className="text-xs text-primary"
          onClick={() => {
            invalidate();
            setSelected(selected.length === aspects.length ? [] : [...aspects]);
          }}
        >
          {selected.length === aspects.length ? "Deselect all" : "Select all"}
        </button>
        <div className="grid gap-2 sm:grid-cols-2">
          {aspects.map(aspect => (
            <label key={aspect} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={selected.includes(aspect)}
                onChange={e => {
                  invalidate();
                  setSelected(s =>
                    e.target.checked
                      ? [...new Set([...s, aspect])]
                      : s.filter(x => x !== aspect)
                  );
                }}
              />
              {aspect}
            </label>
          ))}
        </div>
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={rights}
            onChange={e => {
              invalidate();
              setRights(e.target.checked);
            }}
          />
          I may download this reference and submit it to the AI analysis
          provider.
        </label>
        {asset && !measured && (
          <button
            type="button"
            onClick={measureSelected}
            className="rounded-lg border border-border px-3 py-2 text-xs"
          >
            Measure duration · no AI credits
          </button>
        )}
        {measured && (
          <p className="text-xs text-foreground/70">
            Measured reference: {asset!.duration!.toFixed(2)} seconds · analysis
            costs {cost} credits.
          </p>
        )}
        <button
          type="button"
          disabled={
            !rights || !selected.length || !measured || !capabilities.analysis
          }
          onClick={analyze}
          className="ai-magic inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm disabled:opacity-40"
        >
          {cost === null
            ? "Measure a reference before analysis"
            : `Analyze reference · ${cost} credits`}
          <WandSparkles aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </fieldset>
      {busy && (
        <button
          type="button"
          onClick={invalidate}
          className="mt-2 text-xs text-primary"
        >
          Cancel
        </button>
      )}
      {(busy || detail) && (
        <p role="status" className="ai-status-text mt-2 text-xs">
          {detail || "Preparing reference…"}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {result && <p className="mt-3 whitespace-pre-wrap text-sm">{result}</p>}
    </details>
  );
}
