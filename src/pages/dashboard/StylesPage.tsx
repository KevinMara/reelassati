import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  Film,
  Palette,
  Plus,
  Save,
  Search,
  Shapes,
  SlidersHorizontal,
  Trash2,
  Type,
} from "lucide-react";
import { useWorkspace } from "@/providers/workspace";
import { useUiText } from "@/lib/i18n/ui";
import { selectedBrand } from "@/lib/workspace-scope";
import {
  captureUploadRequestScope,
  verifyUploadRequestScope,
} from "@/lib/platform-api";
import type { WorkspaceDocument } from "@contracts/workspace";
import { CaptionStyleFields } from "@/components/styles/CaptionStyleFields";
import { EditingLanguageFields } from "@/components/styles/EditingLanguageFields";
import { GraphicStyleFields } from "@/components/styles/GraphicStyleFields";
import { LookStyleFields } from "@/components/styles/LookStyleFields";
import { StyleSelect } from "@/components/styles/StyleFields";
import {
  newWorkspaceStyle,
  removeWorkspaceStyle,
  saveWorkspaceStyle,
  selectProjectEditingStyle,
  styleKind,
  workspaceStyles,
  type StyleKind,
  type WorkspaceStyle,
} from "@/components/styles/style-workspace";

const kindLabels = {
  editing: "Editing language",
  captions: "Captions",
  graphic: "Graphics",
  look: "Color / look",
};
const kindIcons = {
  editing: Film,
  captions: Type,
  graphic: Shapes,
  look: SlidersHorizontal,
};
const styleKey = (style: WorkspaceStyle) => `${style.kind}:${style.value.id}`;

export default function StylesPage() {
  const { workspace } = useWorkspace();
  const owner = workspace.profile.email.toLowerCase();
  const brand = selectedBrand(owner);
  return (
    <StylesWorkspace key={`${owner}:${brand}`} owner={owner} brand={brand} />
  );
}

function StylesWorkspace({ owner, brand }: { owner: string; brand: string }) {
  const ui = useUiText();
  const navigate = useNavigate();
  const {
    workspace,
    getWorkspaceSnapshot,
    updateWorkspace,
    saving,
    capabilities,
  } = useWorkspace();
  const [draft, setDraft] = useState<WorkspaceStyle | null>(null);
  const [baseline, setBaseline] = useState("");
  const [mode, setMode] = useState<"create" | "update">("create");
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const library = workspaceStyles(workspace);
  const filtered = library.filter(style =>
    `${style.value.name} ${ui(kindLabels[styleKind(style)])}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase())
  );
  const dirty = draft !== null && JSON.stringify(draft) !== baseline;
  const blocked = busy || saving;
  const canPersist =
    capabilities.persistence &&
    (draft?.kind !== "editing" || capabilities.editStyleTemplates);
  const chosenProject = workspace.projects.find(
    project => project.id === projectId
  );

  function open(style?: WorkspaceStyle) {
    if (blocked || (dirty && !window.confirm(ui("Discard unsaved changes?"))))
      return;
    const next = style
      ? structuredClone(style)
      : newWorkspaceStyle("editing", crypto.randomUUID());
    setDraft(next);
    setBaseline(JSON.stringify(next));
    setMode(style ? "update" : "create");
    setMessage("");
    setConfirmDelete(false);
  }

  async function persist(
    change: (current: WorkspaceDocument) => WorkspaceDocument
  ) {
    const scope = await captureUploadRequestScope();
    if (scope.ownerEmail !== owner || scope.brandId !== brand)
      throw new Error(
        ui("The destination workspace changed. Start the import again.")
      );
    await verifyUploadRequestScope(scope);
    return updateWorkspace(current => {
      if (
        current.profile.email.toLowerCase() !== owner ||
        selectedBrand(owner) !== brand ||
        getWorkspaceSnapshot().profile.email.toLowerCase() !== owner
      )
        throw new Error(
          ui("The destination workspace changed. Start the import again.")
        );
      return change(current);
    });
  }

  async function run(task: () => Promise<void>) {
    if (busyRef.current || saving) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      await task();
    } catch (cause) {
      setFailed(true);
      setMessage(ui(cause instanceof Error ? cause.message : "Save failed"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function save() {
    if (!draft || !canPersist) return;
    const captured = structuredClone(draft);
    await run(async () => {
      let expected: WorkspaceStyle | undefined;
      const result = await persist(current => {
        const next = saveWorkspaceStyle(current, captured, mode);
        expected = workspaceStyles(next).find(
          style => styleKey(style) === styleKey(captured)
        );
        return next;
      });
      const saved = workspaceStyles(result).find(
        style => styleKey(style) === styleKey(captured)
      );
      if (!saved || JSON.stringify(saved) !== JSON.stringify(expected))
        throw new Error(ui("Save failed"));
      setDraft(saved);
      setBaseline(JSON.stringify(saved));
      setMode("update");
      setMessage(ui("Style saved"));
    });
  }

  async function remove() {
    if (!draft) return;
    const captured = structuredClone(draft);
    await run(async () => {
      const result = await persist(current =>
        removeWorkspaceStyle(current, captured)
      );
      if (
        workspaceStyles(result).some(
          style => styleKey(style) === styleKey(captured)
        )
      )
        throw new Error(ui("Save failed"));
      setDraft(null);
      setBaseline("");
      setConfirmDelete(false);
      setMessage(ui("Style deleted"));
    });
  }

  async function openInEditor() {
    if (!draft || dirty || mode !== "update" || !chosenProject) return;
    const captured = draft;
    const target = chosenProject.id;
    if (captured.kind === "editing") {
      await run(async () => {
        const result = await persist(current =>
          selectProjectEditingStyle(current, captured.value.id, target)
        );
        if (
          result.projects.find(project => project.id === target)
            ?.editStyleTemplate?.id !== captured.value.id
        )
          throw new Error(ui("Save failed"));
        navigate(
          `/dashboard/edit?project=${encodeURIComponent(target)}&panel=styles`
        );
      });
    } else
      navigate(
        `/dashboard/edit?project=${encodeURIComponent(target)}&panel=styles&savedStyle=${encodeURIComponent(captured.value.id)}`
      );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {ui("Styles")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {ui("Create your visual language. Reuse it in every edit.")}
          </p>
        </div>
        <button
          type="button"
          data-tour="styles-create"
          disabled={blocked}
          onClick={() => open()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Plus size={16} />
          {ui("New style")}
        </button>
      </header>
      {message && (
        <p
          role={failed ? "alert" : "status"}
          className={`flex items-center gap-2 text-sm ${failed ? "text-destructive" : "text-primary"}`}
        >
          {!failed && <Check size={15} />}
          {message}
        </p>
      )}
      <div className="style-workspace">
        <aside
          data-tour="styles-library"
          aria-label={ui("Saved styles")}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{ui("Saved styles")}</h2>
            <span className="text-xs tabular-nums text-muted-foreground">
              {library.length}
            </span>
          </div>
          {library.length > 0 && (
            <label className="relative block">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-3 text-muted-foreground"
              />
              <input
                type="search"
                aria-label={ui("Search styles")}
                placeholder={ui("Search styles")}
                value={query}
                onChange={event => setQuery(event.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-xs"
              />
            </label>
          )}
          <div className="space-y-2">
            {filtered.map(style => {
              const Icon = kindIcons[styleKind(style)];
              return (
                <button
                  type="button"
                  key={styleKey(style)}
                  disabled={blocked}
                  aria-pressed={
                    mode === "update" &&
                    draft !== null &&
                    styleKey(style) === styleKey(draft)
                  }
                  onClick={() => open(style)}
                  className="style-list-item disabled:opacity-50"
                >
                  <span className="rounded-md bg-muted p-2 text-muted-foreground">
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {style.value.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {ui(kindLabels[styleKind(style)])}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {!library.length && (
            <p className="rounded-lg border border-dashed border-border p-4 text-xs leading-relaxed text-muted-foreground">
              {ui("Your saved styles appear here.")}
            </p>
          )}
          {library.length > 0 && !filtered.length && (
            <p className="py-4 text-xs text-muted-foreground">
              {ui("No matching styles")}
            </p>
          )}
        </aside>
        <section
          className="style-editor min-w-0"
          data-tour="styles-editor"
          aria-label={ui("Style editor")}
        >
          {!draft ? (
            <div className="flex min-h-80 flex-col items-center justify-center text-center">
              <Palette size={28} className="mb-4 text-primary" />
              <h2 className="text-lg font-semibold">
                {ui("Make it your style")}
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                {ui(
                  "Create an editing language, caption treatment, graphic or color look."
                )}
              </p>
              <button
                type="button"
                onClick={() => open()}
                disabled={blocked}
                className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm"
              >
                <Plus size={15} />
                {ui("New style")}
              </button>
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {mode === "create"
                      ? ui("New style")
                      : draft.value.name || ui("Edit style")}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dirty
                      ? ui("Unsaved changes")
                      : ui(kindLabels[styleKind(draft)])}
                  </p>
                </div>
                {mode === "update" && (
                  <button
                    type="button"
                    disabled={blocked || !canPersist}
                    aria-label={ui("Delete style")}
                    onClick={() => setConfirmDelete(value => !value)}
                    className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              {confirmDelete && (
                <div className="mb-4 rounded-lg border border-destructive/30 p-3">
                  <p className="text-sm">{ui("Delete this saved style?")}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => void remove()}
                      className="rounded-md bg-destructive px-3 py-2 text-xs text-destructive-foreground"
                    >
                      {ui("Delete")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-md border border-border px-3 py-2 text-xs"
                    >
                      {ui("Cancel")}
                    </button>
                  </div>
                </div>
              )}
              <form
                onSubmit={event => {
                  event.preventDefault();
                  void save();
                }}
              >
                <fieldset
                  disabled={blocked}
                  className="space-y-5 disabled:opacity-70"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label>
                      {ui("Style name")}
                      <input
                        required
                        maxLength={60}
                        value={draft.value.name}
                        placeholder={ui("Name this style")}
                        onChange={event =>
                          setDraft({
                            ...draft,
                            value: { ...draft.value, name: event.target.value },
                          } as WorkspaceStyle)
                        }
                      />
                    </label>
                    {mode === "create" ? (
                      <StyleSelect
                        label={ui("Style type")}
                        value={styleKind(draft)}
                        options={(Object.keys(kindLabels) as StyleKind[]).map(
                          kind => ({ value: kind, label: kindLabels[kind] })
                        )}
                        onChange={kind => {
                          const next = newWorkspaceStyle(
                            kind as StyleKind,
                            draft.value.id
                          );
                          next.value.name = draft.value.name;
                          setDraft(next);
                        }}
                      />
                    ) : (
                      <div className="flex items-end pb-2 text-xs text-muted-foreground">
                        {ui(kindLabels[styleKind(draft)])}
                      </div>
                    )}
                  </div>
                  {draft.kind === "editing" ? (
                    <EditingLanguageFields
                      value={draft.value.profile}
                      onChange={profile =>
                        setDraft({
                          ...draft,
                          value: { ...draft.value, profile },
                        })
                      }
                    />
                  ) : draft.value.type === "captions" ? (
                    <CaptionStyleFields
                      preset={draft.value.captionStyle}
                      appearance={draft.value.captionAppearance}
                      onChange={(captionStyle, captionAppearance) =>
                        setDraft({
                          kind: "element",
                          value: {
                            id: draft.value.id,
                            name: draft.value.name,
                            type: "captions",
                            captionStyle,
                            captionAppearance,
                          },
                        })
                      }
                    />
                  ) : draft.value.type === "graphic" ? (
                    <GraphicStyleFields
                      value={draft.value}
                      onChange={value => setDraft({ kind: "element", value })}
                    />
                  ) : (
                    <LookStyleFields
                      value={draft.value.settings}
                      onChange={settings =>
                        setDraft({
                          kind: "element",
                          value: {
                            id: draft.value.id,
                            name: draft.value.name,
                            type: "look",
                            settings,
                          },
                        })
                      }
                    />
                  )}
                  <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(JSON.parse(baseline) as WorkspaceStyle);
                        setMessage("");
                      }}
                      disabled={!dirty}
                      className="rounded-lg border border-border px-4 py-2.5 text-sm disabled:opacity-40"
                    >
                      {ui("Reset")}
                    </button>
                    <button
                      type="submit"
                      disabled={
                        !draft.value.name.trim() ||
                        !canPersist ||
                        (mode === "update" && !dirty)
                      }
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
                    >
                      <Save size={15} />
                      {busy ? ui("Saving…") : ui("Save style")}
                    </button>
                  </div>
                </fieldset>
              </form>
              {!canPersist && (
                <p role="status" className="mt-3 text-xs text-muted-foreground">
                  {ui("Saving is unavailable in this workspace.")}
                </p>
              )}
              {mode === "update" && (
                <div className="mt-6 space-y-3 border-t border-border pt-5">
                  <h3 className="text-sm font-semibold">
                    {ui("Use in editor")}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {draft.kind === "editing"
                      ? ui(
                          "Choose a project to use this language for its next edit."
                        )
                      : ui(
                          "Open a project, then apply this style from Saved styles."
                        )}
                  </p>
                  {workspace.projects.length ? (
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-0 flex-1">
                        <StyleSelect
                          label={ui("Projects")}
                          value={projectId}
                          options={[
                            { value: "", label: "Choose a project" },
                            ...workspace.projects.map(project => ({
                              value: project.id,
                              label: project.title,
                              translate: false,
                            })),
                          ]}
                          onChange={setProjectId}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={
                          blocked ||
                          dirty ||
                          !chosenProject ||
                          (draft.kind === "editing" && !canPersist)
                        }
                        onClick={() => void openInEditor()}
                        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-xs disabled:opacity-40"
                      >
                        {ui("Use in editor")}
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                  ) : (
                    <Link
                      to="/dashboard/edit?panel=styles"
                      className="inline-flex items-center gap-2 text-sm text-primary"
                    >
                      {ui("Open editing studio")}
                      <ArrowUpRight size={14} />
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
