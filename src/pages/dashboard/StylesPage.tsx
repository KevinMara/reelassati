import { useState } from "react";
import { Link } from "react-router-dom";
import { Palette, ArrowUpRight, BookmarkPlus, Trash2 } from "lucide-react";
import { useWorkspace } from "@/providers/workspace";
import { useUiText } from "@/lib/i18n/ui";
import { EDIT_RECIPES } from "@/lib/editor-production";
import { CAPTION_PRESETS } from "@contracts/editor-presets";
import {
  addEditorSavedStyle,
  removeEditorSavedStyle,
} from "@contracts/editor-style-library";
import { CaptionStylePreview } from "@/components/studio/CaptionStylePreview";

export default function StylesPage() {
  const ui = useUiText();
  const { workspace, updateWorkspace, saving } = useWorkspace();
  const [tab, setTab] = useState<"editing" | "captions" | "saved">("editing");
  const [notice, setNotice] = useState("");
  const editingCards = [
    {
      recipe: "Fast product demo",
      name: ui("Fast product demo"),
      description: ui("Result first. Clear proof and purposeful pace."),
    },
    {
      recipe: "Clean editorial",
      name: ui("Clean editorial"),
      description: ui("Confident typography and precise, understated cuts."),
    },
    {
      recipe: "Cinematic story",
      name: ui("Cinematic story"),
      description: ui("Atmosphere, motivated motion and a complete story."),
    },
    {
      recipe: "Natural talking head",
      name: ui("Natural talking head"),
      description: ui("Speech-led rhythm with space for personality."),
    },
  ] as const;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <Palette className="text-primary" />
          {ui("Styles")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {ui("One visual language. Adapted to every video.")}
        </p>
      </header>
      <div
        className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1"
        role="tablist"
        tabIndex={-1}
        aria-label={ui("Style library")}
        onKeyDown={event => {
          const tabs = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>(
              '[role="tab"]'
            )
          );
          const index = tabs.indexOf(event.target as HTMLButtonElement);
          if (index < 0) return;
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? tabs.length - 1
                : event.key === "ArrowRight"
                  ? (index + 1) % tabs.length
                  : event.key === "ArrowLeft"
                    ? (index - 1 + tabs.length) % tabs.length
                    : -1;
          if (next < 0) return;
          event.preventDefault();
          event.stopPropagation();
          tabs[next].focus();
          tabs[next].click();
        }}
      >
        {(
          [
            ["editing", ui("Editing")],
            ["captions", ui("Captions")],
            ["saved", ui("My templates")],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            role="tab"
            id={`styles-tab-${value}`}
            tabIndex={tab === value ? 0 : -1}
            aria-selected={tab === value}
            aria-controls="styles-panel"
            key={value}
            onClick={() => setTab(value)}
            className={`rounded-lg px-4 py-2 text-sm transition-all ${tab === value ? "bg-primary/15 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {notice && (
        <p role="status" className="text-sm text-primary">
          {notice}
        </p>
      )}
      <div
        role="tabpanel"
        id="styles-panel"
        aria-labelledby={`styles-tab-${tab}`}
        tabIndex={0}
      >
        {tab === "editing" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {editingCards.map(({ recipe, name, description }, index) => (
              <Link
                key={recipe}
                to={`/dashboard/edit?style=${encodeURIComponent(EDIT_RECIPES[recipe])}`}
                className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40"
              >
                <div
                  className="mb-6 h-16 rounded-xl bg-gradient-to-br from-primary/25 via-primary/5 to-transparent"
                  style={{ filter: `hue-rotate(${index * 28}deg)` }}
                />
                <h2 className="text-lg font-semibold">{name}</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  {description}
                </p>
                <ArrowUpRight className="absolute right-5 top-5 size-4 text-primary" />
              </Link>
            ))}
          </div>
        )}
        {tab === "captions" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPTION_PRESETS.map(preset => (
              <section
                key={preset.id}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <CaptionStylePreview presetId={preset.id} />
                <div className="mt-3 flex items-center justify-between">
                  <h2 className="text-sm font-medium">{ui(preset.name)}</h2>
                  <button
                    type="button"
                    aria-label={ui("Save {{name}}", { name: preset.name })}
                    disabled={saving}
                    onClick={() =>
                      void updateWorkspace(w => ({
                        ...w,
                        editorStyles: addEditorSavedStyle(w.editorStyles, {
                          id: crypto.randomUUID(),
                          name: preset.name,
                          type: "captions",
                          captionStyle: preset.id,
                          captionAppearance: {},
                        }),
                      }))
                        .then(() => setNotice(ui("Template saved")))
                        .catch(() => setNotice(ui("Save failed")))
                    }
                    className="rounded-lg p-2 text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    <BookmarkPlus size={17} />
                  </button>
                </div>
              </section>
            ))}
          </div>
        )}
        {tab === "saved" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ...(workspace.editStyleTemplates ?? []).map(t => ({
                id: t.id,
                name: t.name,
                kind: "Editing style",
                editing: true,
              })),
              ...(workspace.editorStyles ?? []).map(t => ({
                id: t.id,
                name: t.name,
                kind: t.type,
                editing: false,
              })),
            ].map(template => (
              <article
                key={template.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4"
              >
                <div>
                  <h2 className="text-sm font-semibold">{template.name}</h2>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    {ui(template.kind)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  aria-label={ui("Delete {{name}}", { name: template.name })}
                  onClick={() =>
                    void updateWorkspace(w =>
                      template.editing
                        ? {
                            ...w,
                            editStyleTemplates: w.editStyleTemplates?.filter(
                              t => t.id !== template.id
                            ),
                          }
                        : {
                            ...w,
                            editorStyles: removeEditorSavedStyle(
                              w.editorStyles,
                              template.id
                            ),
                          }
                    ).catch(() => setNotice(ui("Save failed")))
                  }
                  className="rounded-lg p-2 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={15} />
                </button>
              </article>
            ))}
            {!(
              workspace.editStyleTemplates?.length ||
              workspace.editorStyles?.length
            ) && (
              <p className="col-span-full rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
                {ui(
                  "Save a finished edit, caption treatment, graphic or look from the editor. Your templates appear here."
                )}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
