import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Asset } from "@contracts/workspace";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/providers/workspace";
import { selectedBrand } from "@/lib/workspace-scope";
import { captureUploadRequestScope, platformApi, verifyUploadRequestScope, type UploadRequestScope } from "@/lib/platform-api";
import { STILL_IMAGE_LIMITS } from "@/lib/still-image-bounds";
import { runStillImageInference } from "@/lib/still-image-inference";
import { personCutoutPixels, relativeDepthPixels, stillPixelsPng, type StillImageInference } from "@/lib/still-image-rendering";
import { assertStillImageContext, derivedStillAsset } from "@/lib/derived-still-asset";
import type { StillImageTool } from "@/lib/still-image.worker";

interface Result extends StillImageInference {
  original: Asset;
  scope: UploadRequestScope;
  contextKey: string;
}
interface Preview { result: Result; controls: string; blob: Blob; url: string }

export function StillImageToolPanel({ projectId, kind }: { projectId: string; kind: StillImageTool }) {
  const { user } = useAuth();
  const { workspace, capabilities, getWorkspaceSnapshot, updateWorkspace } = useWorkspace();
  const [sourceId, setSourceId] = useState("");
  const [threshold, setThreshold] = useState(0.5);
  const [softness, setSoftness] = useState(0.15);
  const [invert, setInvert] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState({ key: "", busy: false, message: "" });
  const operation = useRef<AbortController | null>(null);
  const contextKey = `${user?.id || ""}:${user?.email || ""}:${selectedBrand(user?.email)}:${projectId}:${sourceId}:${kind}`;
  const images = workspace.assets.filter(asset => asset.kind === "image" && asset.status === "ready");
  const original = images.find(asset => asset.id === sourceId);
  const sourceCurrent = result && original && result.original.id === original.id && result.original.url === original.url && result.original.size === original.size && result.original.createdAt === original.createdAt;
  const activeResult = result?.contextKey === contextKey && sourceCurrent ? result : null;
  const controls = `${threshold}:${softness}:${invert}`;
  const activePreview = preview?.result === activeResult && preview?.controls === controls ? preview : null;
  const busy = status.key === contextKey && status.busy;
  const message = status.key === contextKey ? status.message : "";
  const name = kind === "person" ? "Person cutout" : "Relative depth";

  useEffect(() => () => {
    operation.current?.abort();
    operation.current = null;
  }, [contextKey]);

  useEffect(() => {
    if (!activeResult) return;
    let active = true;
    let url: string | undefined;
    const pixels = kind === "person"
      ? personCutoutPixels(activeResult, threshold, softness)
      : relativeDepthPixels(activeResult, invert);
    void stillPixelsPng(activeResult, pixels).then(blob => {
      if (!active) return;
      url = URL.createObjectURL(blob);
      setPreview({ result: activeResult, controls, blob, url });
    }).catch(cause => {
      if (active) setStatus({ key: contextKey, busy: false, message: cause instanceof Error ? cause.message : "The preview could not be rendered." });
    });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [activeResult, contextKey, controls, invert, kind, softness, threshold]);

  async function analyze() {
    if (!original || busy || !user) return;
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setResult(null);
    setStatus({ key: contextKey, busy: true, message: "Opening the source image…" });
    try {
      if (original.size > STILL_IMAGE_LIMITS.bytes) throw new Error("Use a PNG, JPEG or WebP image up to 20 MB.");
      const scope = await captureUploadRequestScope();
      controller.signal.throwIfAborted();
      assertStillImageContext(getWorkspaceSnapshot(), projectId, original);
      const blob = await platformApi.downloadAssetBlob(original.id, controller.signal, { scope, maxBytes: STILL_IMAGE_LIMITS.bytes });
      const inference = await runStillImageInference(kind, blob, controller.signal, text => {
        if (!controller.signal.aborted) setStatus({ key: contextKey, busy: true, message: text });
      });
      await verifyUploadRequestScope(scope);
      controller.signal.throwIfAborted();
      assertStillImageContext(getWorkspaceSnapshot(), projectId, original);
      setResult({ ...inference, original, scope, contextKey });
      setStatus({ key: contextKey, busy: false, message: "Preview ready. Adjust the result, then save a separate PNG to your Library." });
    } catch (cause) {
      if (!controller.signal.aborted) setStatus({ key: contextKey, busy: false, message: cause instanceof Error ? cause.message : "The local still-image model could not run." });
    } finally { if (operation.current === controller) operation.current = null; }
  }

  async function save() {
    if (!activeResult || !activePreview || busy || !capabilities.uploads) return;
    const savingResult = activeResult;
    const savingPreview = activePreview;
    const controller = new AbortController();
    operation.current?.abort();
    operation.current = controller;
    setStatus({ key: contextKey, busy: true, message: "Saving the derived PNG to your Library…" });
    try {
      await verifyUploadRequestScope(savingResult.scope);
      controller.signal.throwIfAborted();
      assertStillImageContext(getWorkspaceSnapshot(), projectId, savingResult.original);
      const base = savingResult.original.name.replace(/\.[^.]+$/, "").slice(0, 120);
      const file = new File([savingPreview.blob], `${base}-${kind === "person" ? "person-cutout" : "relative-depth"}.png`, { type: "image/png" });
      // No render project ID: this is a Library derivative, never a finalized timeline render.
      const uploaded = await platformApi.uploadAsset(file, "image", undefined, undefined, { scope: savingResult.scope, signal: controller.signal });
      await verifyUploadRequestScope(savingResult.scope);
      controller.signal.throwIfAborted();
      assertStillImageContext(getWorkspaceSnapshot(), projectId, savingResult.original);
      const asset = derivedStillAsset(uploaded, savingResult.original, projectId, savingResult.width, savingResult.height);
      await updateWorkspace(current => {
        controller.signal.throwIfAborted();
        assertStillImageContext(current, projectId, savingResult.original);
        return {
          ...current,
          assets: [asset, ...current.assets.filter(item => item.id !== asset.id)],
          activity: [{ id: crypto.randomUUID(), type: "upload" as const, label: `${name} saved`, detail: asset.name, createdAt: new Date().toISOString() }, ...current.activity].slice(0, 100),
        };
      });
      if (!controller.signal.aborted) setStatus({ key: contextKey, busy: false, message: "Saved to your Library. Choose the new PNG there to add it to the timeline." });
    } catch (cause) {
      if (!controller.signal.aborted) setStatus({ key: contextKey, busy: false, message: cause instanceof Error ? cause.message : "The derived PNG could not be saved." });
    } finally { if (operation.current === controller) operation.current = null; }
  }

  return (
    <section aria-label={`${name} for still images`} className="space-y-3">
      <p className="text-sm font-medium">{name}</p>
      <p className="text-xs leading-relaxed text-foreground/65">
        {kind === "person" ? "Separate a person from a still image and keep the background transparent. Hair and fine edges may need a different threshold." : "Estimate a grayscale depth map from one still image. Brighter areas usually appear closer; this is relative depth, without real distances or a reconstructed 3D scene."}
        {" "}Runs locally in your browser without a provider credit charge.
      </p>
      <label className="block text-xs font-medium" htmlFor={`still-source-${kind}-${projectId}`}>Source image</label>
      <select id={`still-source-${kind}-${projectId}`} value={sourceId} onChange={event => { operation.current?.abort(); setSourceId(event.target.value); setResult(null); }} className="w-full rounded-lg border border-border bg-background p-2 text-sm">
        <option value="">Choose a Library image</option>
        {images.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
      </select>
      <p className="text-[11px] text-foreground/55">PNG, JPEG or still WebP · up to 20 MB / 4 MP / 4096 px per side.</p>
      <button type="button" onClick={() => void analyze()} disabled={!original || busy || !user} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {kind === "person" ? "Preview person cutout" : "Preview relative depth"}
      </button>
      {activeResult ? <>
        {kind === "person" ? <>
          <label className="block text-xs" htmlFor={`cutout-threshold-${projectId}`}>Person threshold · {Math.round(threshold * 100)}%</label>
          <input id={`cutout-threshold-${projectId}`} type="range" min={0.05} max={0.95} step={0.01} value={threshold} onChange={event => setThreshold(Number(event.target.value))} className="w-full" />
          <label className="block text-xs" htmlFor={`cutout-softness-${projectId}`}>Edge softness · {Math.round(softness * 100)}%</label>
          <input id={`cutout-softness-${projectId}`} type="range" min={0} max={0.5} step={0.01} value={softness} onChange={event => setSoftness(Number(event.target.value))} className="w-full" />
        </> : <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={invert} onChange={event => setInvert(event.target.checked)} />Invert light and dark depth</label>}
        {activePreview ? <div className="overflow-hidden rounded-lg border border-border" style={{ backgroundImage: "conic-gradient(#929292 25%, #c4c4c4 0 50%, #929292 0 75%, #c4c4c4 0)", backgroundSize: "20px 20px" }}><img src={activePreview.url} alt={`${name} preview`} className="max-h-72 w-full object-contain" /></div> : <p className="text-xs text-foreground/60">Preparing the updated PNG preview…</p>}
        <button type="button" onClick={() => void save()} disabled={!activePreview || busy || !capabilities.uploads} className="w-full rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40">Save PNG to Library</button>
      </> : null}
      {message ? <p role="status" className="text-xs leading-relaxed text-foreground/70">{message}</p> : null}
      <p className="text-[11px] text-foreground/50">{kind === "person" ? "Still-image person segmentation; full-video matting and rotoscoping are not supported." : "Still-image relative depth; metric depth and tracked 3D reconstruction are not supported."}</p>
    </section>
  );
}
