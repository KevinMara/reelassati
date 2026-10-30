import { useEffect, useRef, useState } from "react";
import { BookmarkPlus, Trash2 } from "lucide-react";
import { useUiText } from "@/lib/i18n/ui";
import { useWorkspace } from "@/providers/workspace";
import {
  platformApi,
  captureUploadRequestScope,
  verifyUploadRequestScope,
} from "@/lib/platform-api";
import { selectedBrand } from "@/lib/workspace-scope";
import { StudioSelect } from "@/components/ui/studio-select";
import {
  EDIT_STYLE_TEMPLATE_LIMIT,
  captureEditStyle,
  canCaptureEditStyle,
  normalizeEditStyleTemplates,
  normalizeEditStyleTemplate,
  type EditStyleProfile,
  type EditStyleTemplate,
} from "@contracts/edit-style-template";
import { captureEditBlueprint } from "@contracts/edit-template-blueprint";
import type { Asset, EditProject } from "@contracts/workspace";
import { editingTraitLabel } from "@/lib/i18n/locales/ui-edit-template-traits";
import { CaptionStylePreview } from "./CaptionStylePreview";

function EditStyleProfilePreview({ profile }: { profile: EditStyleProfile }) {
  const ui = useUiText();
  return (
    <div className="mt-2 space-y-3 text-xs">
      <dl className="grid grid-cols-2 gap-2">
        {Object.entries(profile.traits).map(([key, value]) => (
          <div key={key}>
            <dt className="text-muted-foreground">
              {ui(editingTraitLabel(key))}
            </dt>
            <dd>{ui(editingTraitLabel(value))}</dd>
          </div>
        ))}
      </dl>
      {profile.shotSeconds && (
        <p>
          {ui("Pacing")}: {profile.shotSeconds.short.toFixed(1)}–
          {profile.shotSeconds.long.toFixed(1)}s
        </p>
      )}
      {profile.captionTreatment && (
        <CaptionStylePreview
          presetId={profile.captionTreatment.preset}
          appearance={profile.captionTreatment.appearance}
        />
      )}
      {profile.graphicTreatment && (
        <div className="flex flex-wrap gap-1">
          {profile.graphicTreatment.palette.map(color => (
            <span
              key={color}
              title={color}
              className="h-5 w-5 rounded border border-border"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Saving/choosing a template only changes the workspace; inference requires the edit's explicit quote. */
export function SaveEditStyleTemplate({
  profile,
  source,
  disabled = false,
  project,
}: {
  project?: EditProject;
  profile: EditStyleProfile;
  source: EditStyleTemplate["source"];
  disabled?: boolean;
}) {
  const ui = useUiText();
  const { workspace, getWorkspaceSnapshot, updateWorkspace, capabilities } =
    useWorkspace();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const owner = workspace.profile.email.toLowerCase();
  const brand = selectedBrand(owner);
  useEffect(() => () => abort.current?.abort(), [owner, brand, project?.id]);
  if (!capabilities.editStyleTemplates) return null;
  async function save() {
    if (busy || disabled || !name.trim()) return;
    setBusy(true);
    setMessage("");
    setFailed(false);
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setProgress(0);
    const projectSnapshot = project ? structuredClone(project) : undefined;
    const snapshot = structuredClone(profile),
      templateName = name.trim();
    try {
      const scope = await captureUploadRequestScope();
      const assertScope = () => {
        controller.signal.throwIfAborted();
        const current = getWorkspaceSnapshot();
        if (
          scope.ownerEmail !== owner ||
          scope.brandId !== brand ||
          current.profile.email.toLowerCase() !== owner ||
          selectedBrand(owner) !== brand ||
          (projectSnapshot &&
            !current.projects.some(p => p.id === projectSnapshot.id))
        )
          throw new Error(
            ui("The destination workspace changed. Start the import again.")
          );
      };
      assertScope();
      await verifyUploadRequestScope(scope);
      if (
        normalizeEditStyleTemplates(getWorkspaceSnapshot().editStyleTemplates)
          .length >= EDIT_STYLE_TEMPLATE_LIMIT
      )
        throw new Error(ui("Delete a saved style to make room for another."));
      const blueprint = projectSnapshot
        ? captureEditBlueprint(projectSnapshot)
        : undefined;
      let reference: Asset | undefined;
      if (projectSnapshot) {
        const { renderVideo } = await import("@/lib/render-video");
        const rendered = await renderVideo(
          projectSnapshot,
          structuredClone(getWorkspaceSnapshot().assets),
          {
            resolution: 1080,
            frameRate: projectSnapshot.frameRate ?? 30,
            format: "mp4",
            signal: controller.signal,
            onProgress: value => {
              if (!controller.signal.aborted) setProgress(value);
            },
            loadAsset: async (id, signal) =>
              new Uint8Array(
                await (
                  await platformApi.downloadAssetBlob(id, signal, { scope })
                ).arrayBuffer()
              ),
          }
        );
        assertScope();
        await verifyUploadRequestScope(scope);
        const current = getWorkspaceSnapshot().projects.find(
          p => p.id === projectSnapshot.id
        );
        if (
          !current ||
          JSON.stringify(captureEditBlueprint(current)) !==
            JSON.stringify(blueprint)
        )
          throw new Error(ui("The edit changed. Save the template again."));
        reference = await platformApi.uploadAsset(
          new File([rendered.file], `${templateName}.mp4`, {
            type: rendered.file.type,
          }),
          "video",
          undefined,
          projectSnapshot.id,
          { scope, signal: controller.signal }
        );
        await verifyUploadRequestScope(scope);
        assertScope();
      }
      const candidate = normalizeEditStyleTemplate({
        id: crypto.randomUUID(),
        name: templateName,
        source,
        profile: snapshot,
        blueprint,
        referenceAssetId: reference?.id,
      });
      if (!candidate) throw new Error(ui("Save failed"));
      const saved = await updateWorkspace(w => {
        assertScope();
        if (
          w.profile.email.toLowerCase() !== scope.ownerEmail ||
          selectedBrand(scope.ownerEmail) !== scope.brandId ||
          getWorkspaceSnapshot().profile.email.toLowerCase() !==
            scope.ownerEmail
        )
          throw new Error(
            ui("The destination workspace changed. Start the import again.")
          );
        const templates = normalizeEditStyleTemplates(w.editStyleTemplates);
        if (templates.length >= EDIT_STYLE_TEMPLATE_LIMIT)
          throw new Error(ui("Delete a saved style to make room for another."));
        return {
          ...w,
          editStyleTemplates: [...templates, candidate],
          assets: reference
            ? [reference, ...w.assets.filter(a => a.id !== reference!.id)]
            : w.assets,
        };
      });
      if (!saved.editStyleTemplates?.some(t => t.id === candidate.id))
        throw new Error(ui("Save failed"));
      setName("");
      setMessage(ui("Template saved"));
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : ui("Save failed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2 rounded-xl border border-primary/25 bg-primary/5 p-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        {ui(
          project
            ? "Save the reference video and every edit setting."
            : "Save the editing language. Each new edit adapts it to its own footage, words and story."
        )}
      </p>
      <details>
        <summary className="cursor-pointer text-xs">
          {ui("Style profile")}
        </summary>
        <EditStyleProfilePreview profile={profile} />
      </details>
      <label className="block text-xs">
        {ui("Template name")}
        <input
          maxLength={60}
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={disabled || busy}
          className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2"
        />
      </label>
      <button
        type="button"
        onClick={() => void save()}
        disabled={
          disabled ||
          busy ||
          !name.trim() ||
          Boolean(project && !capabilities.uploads)
        }
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 px-3 py-2 text-xs text-primary disabled:opacity-40"
      >
        <BookmarkPlus size={14} />
        {busy
          ? `${ui("Saving…")} ${project ? `${progress}%` : ""}`
          : ui("Save editing template · no AI credits")}
      </button>
      {message && (
        <p role={failed ? "alert" : "status"} className="text-xs">
          {message}
        </p>
      )}
    </div>
  );
}

export function EditStyleTemplates({
  project,
  disabled = false,
  compact = false,
  onSelect,
}: {
  project: EditProject;
  disabled?: boolean;
  compact?: boolean;
  onSelect?: (template?: EditStyleTemplate) => void;
}) {
  const ui = useUiText();
  const { workspace, updateWorkspace, capabilities } = useWorkspace();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!capabilities.editStyleTemplates) return null;
  const templates = normalizeEditStyleTemplates(workspace.editStyleTemplates);
  const active = normalizeEditStyleTemplate(project.editStyleTemplate);
  const profile = canCaptureEditStyle(project)
    ? captureEditStyle(project)
    : undefined;
  async function change(template?: EditStyleTemplate, deleteId?: string) {
    if (busy || disabled) return;
    setBusy(true);
    setError("");
    try {
      const scope = await captureUploadRequestScope();
      await verifyUploadRequestScope(scope);
      await updateWorkspace(w => {
        if (
          w.profile.email.toLowerCase() !== scope.ownerEmail ||
          selectedBrand(scope.ownerEmail) !== scope.brandId ||
          !w.projects.some(p => p.id === project.id)
        )
          throw new Error(ui("The reference project changed before saving."));
        return deleteId
          ? {
              ...w,
              editStyleTemplates: normalizeEditStyleTemplates(
                w.editStyleTemplates
              ).filter(t => t.id !== deleteId),
            }
          : {
              ...w,
              projects: w.projects.map(p =>
                p.id === project.id
                  ? {
                      ...p,
                      editStyleTemplate: template
                        ? structuredClone(template)
                        : undefined,
                    }
                  : p
              ),
            };
      });
      if (!deleteId) onSelect?.(template);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ui("Save failed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label={ui("Editing templates")}
      className={
        compact ? "space-y-2" : "space-y-3 rounded-xl border border-border p-3"
      }
    >
      {!compact && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{ui("Editing templates")}</h3>
          <span className="text-xs text-muted-foreground">
            {templates.length}/{EDIT_STYLE_TEMPLATE_LIMIT}
          </span>
        </div>
      )}
      <label className="block text-xs">
        {ui("Style for the next edit")}
        <StudioSelect
          aria-label={ui("Style for the next edit")}
          value={active?.id ?? ""}
          disabled={disabled || busy}
          onChange={e =>
            void change(templates.find(t => t.id === e.target.value))
          }
          className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-2"
        >
          <option value="">{ui("No template")}</option>
          {active && !templates.some(t => t.id === active.id) && (
            <option value={active.id}>{active.name}</option>
          )}
          {templates.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </StudioSelect>
      </label>
      {!compact && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {ui("Selecting a template does not start an edit or spend credits.")}
        </p>
      )}
      {active && (
        <details className="text-xs">
          <summary className="cursor-pointer">
            {ui("Style profile")}: {active.name}
          </summary>
          {active.referenceAssetId &&
            workspace.assets.find(a => a.id === active.referenceAssetId)
              ?.url && (
              <video
                className="mt-2 max-h-48 w-full rounded-lg bg-black"
                src={
                  workspace.assets.find(a => a.id === active.referenceAssetId)!
                    .url
                }
                controls
                playsInline
                preload="metadata"
              >
                <track kind="captions" />
              </video>
            )}
          <EditStyleProfilePreview profile={active.profile} />
        </details>
      )}
      {!compact && profile && (
        <details>
          <summary className="cursor-pointer text-xs font-medium">
            {ui("Save this edit as a template")}
          </summary>
          <div className="mt-2">
            <SaveEditStyleTemplate
              profile={profile}
              project={project}
              source="edit"
              disabled={disabled || busy}
            />
          </div>
        </details>
      )}
      {!compact && templates.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground">
            {ui("Manage templates")}
          </summary>
          <div className="mt-2 space-y-1">
            {templates.map(t => (
              <div
                className="flex items-center justify-between gap-2 text-xs"
                key={t.id}
              >
                <span className="truncate">{t.name}</span>
                <button
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => void change(undefined, t.id)}
                  aria-label={ui("Delete saved style {{name}}", {
                    name: t.name,
                  })}
                  className="rounded p-2 text-muted-foreground hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
