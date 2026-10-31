import { getUiLocale, useUiText } from "@/lib/i18n/ui";
import { ColorPicker } from "@/components/ui/color-picker";
import { useEffect, useId, useRef, useState } from "react";
import {
  DEFAULT_GLB_POSE,
  createGlbPoseRenderer,
  type GlbPose,
  type GlbPoseRenderer,
} from "@/lib/glb-renderer";
import { GLB_LIMITS } from "@/lib/glb-validation";
import {
  editor3dModels,
  type Editor3dModel,
} from "@contracts/editor-3d-catalog";

export function GlbModelComposer({
  onSave,
  prepareSave,
  disabled = false,
}: {
  onSave(file: File): Promise<void>;
  /** Capture the upload owner/workspace at the click boundary, before PNG encoding. */
  prepareSave?(): Promise<(file: File) => Promise<void>>;
  disabled?: boolean;
}) {
  const ui = useUiText();
  const catalogNames: Record<string, string> = {
    "khronos-avocado": ui("Avocado"),
    "khronos-water-bottle": ui("Water bottle"),
  };
  const id = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GlbPoseRenderer | null>(null);
  const operationRef = useRef(0);
  const loadControllerRef = useRef<AbortController | null>(null);
  const [pose, setPose] = useState<GlbPose>(DEFAULT_GLB_POSE);
  const [model, setModel] = useState<{
    name: string;
    triangles: number;
    images: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      operationRef.current++;
      loadControllerRef.current?.abort();
      rendererRef.current?.dispose();
    },
    []
  );
  const load = async (source: File | Editor3dModel) => {
    const operation = ++operationRef.current;
    loadControllerRef.current?.abort();
    const controller = new AbortController();
    loadControllerRef.current = controller;
    rendererRef.current?.dispose();
    rendererRef.current = null;
    setModel(null);
    setError("");
    setSaved(false);
    setLoading(true);
    try {
      const catalog = "path" in source ? source : undefined;
      let bytes: ArrayBuffer;
      if (catalog) {
        const response = await fetch(catalog.path, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(20_000),
          ]),
          credentials: "omit",
        });
        if (
          !response.ok ||
          Number(response.headers.get("content-length")) > GLB_LIMITS.bytes
        ) {
          await response.body?.cancel();
          throw new Error(ui("Could not load this model. Try again."));
        }
        bytes = await response.arrayBuffer();
        controller.signal.throwIfAborted();
        if (bytes.byteLength !== catalog.bytes)
          throw new Error(ui("Could not load this model. Try again."));
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        const hash = Array.from(new Uint8Array(digest), byte =>
          byte.toString(16).padStart(2, "0")
        ).join("");
        if (hash !== catalog.sha256)
          throw new Error(ui("Could not load this model. Try again."));
      } else {
        const file = source as File;
        if (!/\.glb$/i.test(file.name) || file.size > GLB_LIMITS.bytes)
          throw new Error(
            ui("Choose a self-contained .glb file no larger than 25 MB.")
          );
        bytes = await file.arrayBuffer();
      }
      if (operation !== operationRef.current || !canvasRef.current) return;
      const renderer = await createGlbPoseRenderer(bytes, canvasRef.current);
      if (operation !== operationRef.current) {
        renderer.dispose();
        return;
      }
      rendererRef.current = renderer;
      setPose(DEFAULT_GLB_POSE);
      setModel({
        name: catalog
          ? (catalogNames[catalog.id] ?? catalog.name)
          : source.name.replace(/\.glb$/i, ""),
        triangles: renderer.triangles,
        images: renderer.images,
      });
    } catch (cause) {
      if (operation === operationRef.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not render this model."
        );
    } finally {
      if (operation === operationRef.current) setLoading(false);
    }
  };
  const change = (next: GlbPose) => {
    setPose(next);
    setSaved(false);
    setError("");
    try {
      rendererRef.current?.render(next);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not render the pose."
      );
    }
  };
  const controls = [
    { key: "yaw", label: "Turn", min: -180, max: 180, step: 1, suffix: "°" },
    { key: "pitch", label: "Tilt", min: -180, max: 180, step: 1, suffix: "°" },
    { key: "roll", label: "Roll", min: -180, max: 180, step: 1, suffix: "°" },
    { key: "zoom", label: "Zoom", min: 0.5, max: 2, step: 0.05, suffix: "×" },
    {
      key: "exposure",
      label: "Exposure",
      min: 0.25,
      max: 2,
      step: 0.05,
      suffix: "×",
    },
  ] as const;
  return (
    <section aria-label={ui("3D model pose")} className="space-y-3">
      <p className="text-sm text-foreground/70">
        {ui(
          "Import a static GLB, compose a pose, and save a transparent image for your timeline."
        )}
      </p>
      <div className="space-y-2">
        <p className="text-sm font-medium">{ui("Free 3D models")}</p>
        <p className="text-xs text-foreground/60">
          {ui("Choose a bundled model or import your own GLB.")}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {editor3dModels.map(item => (
            <div
              key={item.id}
              className="overflow-hidden rounded-lg border border-border"
            >
              <button
                type="button"
                disabled={disabled || loading || saving}
                onClick={() => void load(item)}
                aria-label={`${ui("Load model")} · ${catalogNames[item.id] ?? item.name}`}
                className="block w-full p-2 text-left text-sm hover:bg-muted/40 disabled:opacity-50"
              >
                <img
                  src={item.preview}
                  alt=""
                  loading="lazy"
                  width={128}
                  height={128}
                  className="mb-2 aspect-square w-full rounded bg-white object-contain"
                />
                <span className="font-medium">
                  {catalogNames[item.id] ?? item.name}
                </span>
              </button>
              <a
                href={item.source}
                target="_blank"
                rel="noreferrer"
                className="block px-2 pb-2 text-xs text-foreground/60 underline"
                aria-label={`${ui("Source and license")} · ${catalogNames[item.id] ?? item.name}`}
              >
                {ui("Microsoft · CC0")}
              </a>
            </div>
          ))}
        </div>
      </div>
      <label className="block text-sm" htmlFor={`${id}-file`}>
        {ui("Model · .glb, up to 25 MB")}
      </label>
      <input
        id={`${id}-file`}
        type="file"
        accept=".glb,model/gltf-binary"
        disabled={disabled || loading || saving}
        className="block w-full text-sm"
        onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void load(file);
        }}
      />
      <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-[repeating-conic-gradient(#222_0%_25%,#333_0%_50%)] bg-[length:24px_24px]">
        <canvas
          ref={canvasRef}
          className={`h-full w-full ${model ? "" : "invisible"}`}
          aria-label={ui("Rendered GLB pose preview")}
          role="img"
        />
        {!model && (
          <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white/70">
            {loading
              ? ui("Loading embedded geometry and textures…")
              : ui("Choose a model to preview its pose.")}
          </p>
        )}
      </div>
      {model && (
        <>
          <p className="break-words text-xs text-foreground/60">
            {model.name} · {model.triangles.toLocaleString(getUiLocale())}{" "}
            {ui("triangles ·")} {model.images} {ui("embedded textures")}
          </p>
          {controls.map(control => (
            <label
              key={control.key}
              htmlFor={`${id}-${control.key}`}
              className="block text-sm"
            >
              {ui(control.label)} · {Number(pose[control.key].toFixed(2))}
              {control.suffix}
              <input
                id={`${id}-${control.key}`}
                type="range"
                className="mt-1 block w-full"
                value={pose[control.key]}
                min={control.min}
                max={control.max}
                step={control.step}
                disabled={disabled || saving}
                onChange={event =>
                  change({ ...pose, [control.key]: Number(event.target.value) })
                }
              />
            </label>
          ))}
          <ColorPicker
            label={ui("Material tint")}
            value={pose.tint}
            disabled={disabled || saving}
            onChange={tint => change({ ...pose, tint })}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || saving}
              onClick={() => change(DEFAULT_GLB_POSE)}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              {ui("Reset pose")}
            </button>
            <button
              type="button"
              disabled={disabled || loading || saving || saved || !!error}
              className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
              onClick={() => {
                const renderer = rendererRef.current;
                if (!renderer) return;
                const operation = operationRef.current;
                setSaving(true);
                setError("");
                void (async () => {
                  const save = prepareSave ? await prepareSave() : onSave;
                  if (operation !== operationRef.current) return;
                  const blob = await renderer.png();
                  if (operation !== operationRef.current) return;
                  await save(
                    new File(
                      [blob],
                      `${model.name.replace(/[^a-z0-9._-]+/gi, "-").slice(0, 100) || "model"}-pose.png`,
                      { type: "image/png" }
                    )
                  );
                })()
                  .then(() => {
                    if (operation === operationRef.current) setSaved(true);
                  })
                  .catch(cause => {
                    if (operation === operationRef.current)
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Could not save this pose."
                      );
                  })
                  .finally(() => {
                    if (operation === operationRef.current) setSaving(false);
                  });
              }}
            >
              {saving
                ? ui("Saving pose…")
                : saved
                  ? ui("Pose saved")
                  : ui("Save pose to Library")}
            </button>
          </div>
        </>
      )}
      {saved && (
        <p role="status" className="text-sm text-emerald-500">
          {ui(
            "Pose saved. Drag the image from Library onto a visual timeline track."
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs text-foreground/60">
        {ui(
          "Static 1024 × 1024 image. Embedded PNG/JPEG textures and standard triangle meshes are supported. Export animated, skinned or compressed models as a static, uncompressed GLB first."
        )}
      </p>
    </section>
  );
}
