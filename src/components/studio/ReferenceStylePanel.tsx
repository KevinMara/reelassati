import { useUiText } from "@/lib/i18n/ui";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { WandSparkles } from "lucide-react";
import { SaveEditStyleTemplate } from "./EditStyleTemplates";
import {
  normalizeReferenceEditStyle,
  type EditStyleProfile,
} from "@contracts/edit-style-template";
import type { Asset } from "@contracts/workspace";
import { CompactSelect } from "@/components/ui/compact-select";
import { AI_CREDIT_COSTS, timedCreditCost } from "@contracts/billing";
import { validateDirectVideoUrl } from "@contracts/public-video";
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
  const ui = useUiText();
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
  const [styleProfile, setStyleProfile] = useState<EditStyleProfile>();
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
    setStyleProfile(undefined);
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
    setStyleProfile(undefined);
    try {
      const scope = await captureUploadRequestScope();
      current();
      if (
        scope.ownerId !== expected.ownerId ||
        scope.ownerEmail !== expected.ownerEmail ||
        scope.brandId !== expected.brandId
      )
        throw new Error(
          ui(
            "Your account or brand changed. Start again in the intended workspace."
          )
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
          ui("The destination workspace changed. Start the import again.")
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
      text: ui,
      purpose: "media",
      multiple: false,
      maxFiles: 1,
    });
    if (checked.error || !file.type.startsWith("video/")) {
      setError(checked.error || ui("Choose a video file."));
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
        throw new Error(ui("The reference was removed."));
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
        throw new Error(ui("The reference was removed."));
      const response = await (
        await import("@/lib/analyze-media")
      ).analyzeMedia(
        source,
        "instagram",
        `Create an evidence-focused reference brief for ONLY these aspects: ${chosen.join(", ")}. Describe observed shot/action changes and relevant style or sound with source timestamps. Distinguish observations from unknowns. Exact font, color values, camera settings, sound identity and audio levels remain unknown unless measured. Editorial suggestions are not observations. Do not copy dialogue, melody or copyrighted assets. If the video cannot be inspected, say so; never invent a style.`,
        progress,
        signal,
        scope,
        undefined,
        purpose === "edit"
      );
      await verifyUploadRequestScope(scope);
      current();
      if (!getWorkspaceSnapshot().assets.some(a => a.id === source.id))
        throw new Error(ui("The reference was removed."));
      const evidence = buildReferenceEvidence(
        { assetId: source.id, duration: source.duration! },
        response,
        chosen,
        purpose
      );
      setResult(evidence.summary);
      if (purpose === "edit") {
        const profile = normalizeReferenceEditStyle(response.editingStyle);
        if (profile) {
          if (!chosen.includes("Cut pacing")) {
            profile.traits.pacing = "unknown";
            profile.shotSeconds = null;
          }
          if (!chosen.includes("Framing and color")) {
            profile.traits.framing = "unknown";
            profile.traits.color = "unknown";
            profile.traits.motion = "unknown";
          }
          if (!chosen.includes("Caption treatment"))
            profile.traits.captions = "unknown";
          if (!chosen.includes("Transitions and graphics")) {
            profile.traits.transitions = "unknown";
            profile.traits.graphics = "unknown";
            profile.graphicsPerMinute = null;
          }
          if (!chosen.includes("Music mood and sound placement"))
            profile.traits.sound = "unknown";
          setStyleProfile(profile);
        }
      }
      onChange(referenceEvidenceBrief(evidence));
      setDetail(
        `${evidence.observations.length} valid source intervals. Exact technical parameters remain unknown.`
      );
    });
  }

  return (
    <details className="reference-style-panel my-3 border-t border-border pt-3">
      <summary className="cursor-pointer text-xs font-medium">
        {purpose === "script"
          ? ui("Learn from a reference hook or script")
          : ui("Match a reference style or video")}
      </summary>
      <fieldset
        disabled={busy || disabled}
        className="mt-3 space-y-3 disabled:opacity-50"
      >
        <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] items-center">
          <label className="flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-xs hover:border-primary/50 focus-within:ring-2 focus-within:ring-primary">
            {ui("Upload reference")}
            <input
              type="file"
              accept="video/*"
              className="sr-only"
              aria-label={ui("Upload reference")}
              onChange={e => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) upload(file);
              }}
            />
          </label>
          <CompactSelect
            aria-label={ui("Reference video")}
            value={assetId}
            onValueChange={value => {
              invalidate();
              setAssetId(value);
              setUrl("");
            }}
            options={[
              { value: "", label: ui("Media library") },
              ...workspace.assets
                .filter(a => a.kind === "video" && a.status === "ready")
                .map(a => ({ value: a.id, label: a.name })),
            ]}
          />
        </div>
        {!assetId && (
          <>
            <input
              type="url"
              aria-label={ui("Reference direct video link")}
              value={url}
              onChange={e => {
                invalidate();
                setUrl(e.target.value);
                setRights(false);
              }}
              placeholder="https://cdn.example.com/reference.mp4"
              className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-xs"
            />
            <p className="text-xs text-foreground/70">
              {ui(
                "Direct video file · MP4, MOV or WebM · up to 256 MB / 2 min"
              )}
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
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs disabled:opacity-40"
            >
              {ui("Import reference")}
            </button>
          </>
        )}
        <button
          type="button"
          className="block text-xs text-primary"
          onClick={() => {
            invalidate();
            setSelected(selected.length === aspects.length ? [] : [...aspects]);
          }}
        >
          {selected.length === aspects.length
            ? ui("Deselect all")
            : ui("Select all")}
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
              {aspect === "Cut pacing"
                ? ui("Pacing")
                : aspect === "Framing and color"
                  ? `${ui("Framing")} · ${ui("Color")}`
                  : aspect === "Caption treatment"
                    ? ui("Captions")
                    : aspect === "Transitions and graphics"
                      ? `${ui("Transitions")} · ${ui("Graphics")}`
                      : aspect === "Music mood and sound placement"
                        ? ui("Sound")
                        : aspect}
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
          {ui(
            "I may download this reference and submit it to the AI analysis provider."
          )}
        </label>
        {asset && !measured && (
          <button
            type="button"
            onClick={measureSelected}
            className="rounded-lg border border-border px-3 py-2 text-xs"
          >
            {ui("Measure duration · no AI credits")}
          </button>
        )}
        {measured && (
          <p className="text-xs text-foreground/70">
            {ui("Measured reference:")} {asset!.duration!.toFixed(2)}{" "}
            {ui("seconds · analysis costs")} {cost} {ui("credits.")}
          </p>
        )}
        <button
          type="button"
          disabled={
            !rights ||
            !selected.length ||
            !measured ||
            !capabilities.analysis ||
            capabilities.analysisTransportVersion !== "foreground-v1" ||
            (purpose === "edit" && !capabilities.editStyleTemplates)
          }
          onClick={analyze}
          className="ai-magic inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm disabled:opacity-40"
        >
          {cost === null
            ? ui("Measure a reference before analysis")
            : ui("Analyze reference · {{credits}} credits", { credits: cost })}
          <WandSparkles aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </fieldset>
      {busy && (
        <button
          type="button"
          onClick={invalidate}
          className="mt-2 text-xs text-primary"
        >
          {ui("Cancel")}
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
      {styleProfile && purpose === "edit" && (
        <div className="mt-3">
          <SaveEditStyleTemplate
            profile={styleProfile}
            source="reference"
            disabled={disabled || busy}
          />
        </div>
      )}
    </details>
  );
}
