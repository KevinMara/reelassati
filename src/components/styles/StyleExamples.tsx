import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import {
  EDIT_STYLE_EXAMPLE_LIMIT,
  canCaptureEditStyle,
  type EditStyleTemplate,
} from "@contracts/edit-style-template";
import { useWorkspace } from "@/providers/workspace";
import { useUiText } from "@/lib/i18n/ui";
import {
  platformApi,
  captureUploadRequestScope,
  verifyUploadRequestScope,
} from "@/lib/platform-api";
import { selectedBrand } from "@/lib/workspace-scope";
import { validateFileSelection } from "@/lib/file-validation";
import { resolveVideoMetadata } from "@/lib/media-metadata";
import { SavedStylePreview } from "@/components/studio/SavedStylePreview";
import { StyleSelect } from "./StyleFields";
import {
  addStyleExample,
  assetStyleExample,
  projectStyleExample,
} from "./style-workspace";

/** Adding examples saves source links/snapshots only. Paid review belongs to Reel's explicit estimate/edit action. */
export function StyleExamples({
  value,
  onChange,
  disabled,
  onBusyChange,
}: {
  value: EditStyleTemplate;
  onChange(value: EditStyleTemplate): void;
  disabled: boolean;
  onBusyChange(busy: boolean): void;
}) {
  const ui = useUiText();
  const { workspace, getWorkspaceSnapshot, updateWorkspace, capabilities } =
    useWorkspace();
  const [selection, setSelection] = useState("");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const examples = value.examples ?? [];
  const full = examples.length >= EDIT_STYLE_EXAMPLE_LIMIT;
  const sources = [
    ...workspace.assets
      .filter(
        asset =>
          asset.kind === "video" &&
          asset.status === "ready" &&
          !examples.some(example => example.assetId === asset.id)
      )
      .map(asset => ({
        value: `asset:${asset.id}`,
        label: asset.name,
        translate: false,
      })),
    ...workspace.projects.filter(canCaptureEditStyle).map(project => ({
      value: `project:${project.id}`,
      label: `${ui("Projects")} · ${project.title}`,
      translate: false,
    })),
  ];
  async function add() {
    if (disabled || controller.current || full) return;
    const abort = new AbortController();
    controller.current = abort;
    const owner = workspace.profile.email.toLowerCase(),
      brand = selectedBrand(owner);
    const current = () => {
      abort.signal.throwIfAborted();
      if (
        getWorkspaceSnapshot().profile.email.toLowerCase() !== owner ||
        selectedBrand(owner) !== brand
      )
        throw new Error(
          ui("The destination workspace changed. Start the import again.")
        );
    };
    onBusyChange(true);
    setError("");
    try {
      const asset = workspace.assets.find(
        item => `asset:${item.id}` === selection
      );
      const project = workspace.projects.find(
        item => `project:${item.id}` === selection
      );
      if (!asset && !project) return;
      if (asset && (!Number.isFinite(asset.duration) || asset.duration! <= 0)) {
        const scope = await captureUploadRequestScope();
        current();
        if (scope.ownerEmail !== owner || scope.brandId !== brand)
          throw new Error(
            ui("The destination workspace changed. Start the import again.")
          );
        const measured = await resolveVideoMetadata(asset, abort.signal);
        await verifyUploadRequestScope(scope);
        current();
        await updateWorkspace(workspace => {
          current();
          if (!workspace.assets.some(item => item.id === asset.id))
            throw new Error(ui("The reference was removed."));
          return {
            ...workspace,
            assets: workspace.assets.map(item =>
              item.id === asset.id
                ? {
                    ...item,
                    duration: measured.duration,
                    width: measured.width,
                    height: measured.height,
                  }
                : item
            ),
          };
        });
        current();
      }
      const example = asset
        ? assetStyleExample(asset, crypto.randomUUID())
        : projectStyleExample(project!, crypto.randomUUID());
      onChange(addStyleExample(value, example));
      setSelection("");
      setPreview(example.id);
    } catch (cause) {
      if (!abort.signal.aborted)
        setError(ui(cause instanceof Error ? cause.message : "Save failed"));
    } finally {
      if (!abort.signal.aborted) onBusyChange(false);
      controller.current = null;
    }
  }
  async function upload(file: File) {
    if (disabled || controller.current || full) return;
    const checked = validateFileSelection([file], {
      text: ui,
      purpose: "video",
      multiple: false,
      maxFiles: 1,
    });
    if (checked.error) {
      setError(checked.error);
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    const owner = workspace.profile.email.toLowerCase(),
      brand = selectedBrand(owner);
    const snapshot = structuredClone(value);
    const current = () => {
      abort.signal.throwIfAborted();
      if (
        getWorkspaceSnapshot().profile.email.toLowerCase() !== owner ||
        selectedBrand(owner) !== brand
      )
        throw new Error(
          ui("The destination workspace changed. Start the import again.")
        );
    };
    setError("");
    setProgress(0);
    onBusyChange(true);
    try {
      const scope = await captureUploadRequestScope();
      current();
      if (scope.ownerEmail !== owner || scope.brandId !== brand)
        throw new Error(
          ui("The destination workspace changed. Start the import again.")
        );
      const objectUrl = URL.createObjectURL(file);
      let measured: Awaited<ReturnType<typeof resolveVideoMetadata>>;
      try {
        measured = await resolveVideoMetadata(
          {
            id: "style-upload",
            name: file.name,
            kind: "video",
            contentType: file.type,
            size: file.size,
            url: objectUrl,
            status: "ready",
            createdAt: new Date().toISOString(),
          },
          abort.signal
        );
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
      current();
      const asset = {
        ...(await platformApi.uploadAsset(
          file,
          "video",
          setProgress,
          undefined,
          { scope, signal: abort.signal }
        )),
        duration: measured.duration,
        width: measured.width,
        height: measured.height,
      };
      await verifyUploadRequestScope(scope);
      current();
      await updateWorkspace(workspace => {
        current();
        return {
          ...workspace,
          assets: [
            ...workspace.assets.filter(item => item.id !== asset.id),
            asset,
          ],
        };
      });
      current();
      const example = assetStyleExample(asset, crypto.randomUUID());
      onChange(addStyleExample(snapshot, example));
      setPreview(example.id);
    } catch (cause) {
      if (!abort.signal.aborted)
        setError(ui(cause instanceof Error ? cause.message : "Save failed"));
    } finally {
      if (!abort.signal.aborted) {
        setProgress(null);
        onBusyChange(false);
      }
      controller.current = null;
    }
  }
  const selected = examples.find(example => example.id === preview);
  const asset = selected?.assetId
    ? workspace.assets.find(item => item.id === selected.assetId)
    : undefined;
  return (
    <section className="space-y-3 rounded-xl border border-border bg-background/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{ui("Style examples")}</h3>
        <span className="text-xs text-muted-foreground">
          {examples.length}/{EDIT_STYLE_EXAMPLE_LIMIT}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {ui(
          "Add videos or project edits. Reel learns their shared style and adapts it to your new footage."
        )}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <StyleSelect
            label={ui("Library / Projects")}
            value={selection}
            options={[{ value: "", label: "Choose an example" }, ...sources]}
            onChange={setSelection}
          />
        </div>
        <button
          type="button"
          onClick={() => void add()}
          disabled={disabled || full || !selection}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-xs disabled:opacity-40"
        >
          <Plus size={14} />
          {ui("Add")}
        </button>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={disabled || full || !capabilities.uploads}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-xs disabled:opacity-40"
        >
          <Upload size={14} />
          {progress === null ? ui("Upload video") : `${progress}%`}
        </button>
        <input
          ref={input}
          type="file"
          accept="video/*"
          className="hidden"
          aria-label={ui("Upload video")}
          onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {examples.length > 0 && (
        <div className="space-y-1.5">
          {examples.map(example => (
            <div
              key={example.id}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
            >
              <button
                type="button"
                disabled={disabled}
                aria-pressed={preview === example.id}
                onClick={() =>
                  setPreview(preview === example.id ? "" : example.id)
                }
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-xs font-medium">
                  {example.name}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {ui(
                    example.source === "edit"
                      ? "Saved project edit"
                      : example.profile
                        ? "Style reviewed"
                        : "Reviewed when you run Reel"
                  )}
                </span>
              </button>
              <button
                type="button"
                disabled={disabled}
                aria-label={ui("Remove example {{name}}", {
                  name: example.name,
                })}
                onClick={() =>
                  onChange({
                    ...value,
                    examples: examples.filter(item => item.id !== example.id),
                  })
                }
                className="rounded p-1.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      {selected?.blueprint && (
        <SavedStylePreview
          key={selected.id}
          blueprint={selected.blueprint}
          assets={workspace.assets}
        />
      )}
      {asset?.url && (
        <video
          key={asset.id}
          src={asset.url}
          controls
          preload="metadata"
          className="mx-auto max-h-[65vh] max-w-full rounded-lg"
        >
          <track kind="captions" />
        </video>
      )}
      {selected?.assetId && !asset && (
        <p role="status" className="text-xs text-muted-foreground">
          {ui("This example's video is no longer in the Library.")}
        </p>
      )}
      {examples.some(
        example => example.source === "reference" && !example.profile
      ) && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {ui(
            "Video review credits are included in Reel's estimate. Adding examples does not start an analysis."
          )}
        </p>
      )}
    </section>
  );
}
