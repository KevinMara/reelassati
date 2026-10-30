import { useRef, useState } from "react";
import { Download, Pencil, Plus, Upload } from "lucide-react";
import { useWorkspace } from "@/providers/workspace";
import { useUiText } from "@/lib/i18n/ui";
import { selectedBrand } from "@/lib/workspace-scope";
import {
  normalizeEditorSavedStyle,
  type EditorSavedStyle,
} from "@contracts/editor-style-library";
import {
  readEditorPresetFile,
  writeEditorPresetFile,
} from "@contracts/editor-preset-file";
import {
  CAPTION_PRESETS,
  GRAPHIC_PRESETS,
  CLIP_LOOK_PRESETS,
} from "@contracts/editor-presets";
import { normalizeVisual } from "@contracts/clip-visual";
import { CaptionStyleFields } from "@/components/styles/CaptionStyleFields";
import { GraphicStyleFields } from "@/components/styles/GraphicStyleFields";
import { LookStyleFields } from "@/components/styles/LookStyleFields";
import { saveWorkspaceStyle } from "@/components/styles/style-workspace";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function PersonalPresetLibrary({
  mode,
  onApply,
  disabled = false,
}: {
  mode: "captions" | "graphics" | "looks";
  onApply(style: EditorSavedStyle): void;
  disabled?: boolean;
}) {
  const ui = useUiText();
  const { workspace, updateWorkspace } = useWorkspace();
  const type =
    mode === "graphics" ? "graphic" : mode === "looks" ? "look" : "captions";
  const [draft, setDraft] = useState<EditorSavedStyle>();
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const scope = useRef<
    { owner: string; brand: string | undefined } | undefined
  >(undefined);
  const saved = (workspace.editorStyles ?? []).filter(s => s.type === type);
  const open = (value: EditorSavedStyle, existing = false) => {
    scope.current = {
      owner: workspace.profile.email.toLowerCase(),
      brand: selectedBrand(workspace.profile.email.toLowerCase()),
    };
    setDraft(structuredClone(value));
    setEditing(existing);
    setError("");
  };
  const fromStock = (id: string) => {
    const identity = { id: crypto.randomUUID(), name: "" };
    if (type === "captions") {
      const p = CAPTION_PRESETS.find(p => p.id === id)!;
      open({
        ...identity,
        name: ui(p.name),
        type,
        captionStyle: p.id,
        captionAppearance: {},
      });
    } else if (type === "graphic") {
      const p = GRAPHIC_PRESETS.find(p => p.id === id)!;
      open({
        ...identity,
        name: ui(p.name),
        type,
        graphic: p.graphic,
        graphicDuration: p.duration,
      });
    } else {
      const p = CLIP_LOOK_PRESETS.find(p => p.id === id)!;
      open({
        ...identity,
        name: ui(p.name),
        type,
        settings: { ...p.settings, fit: "contain", visual: normalizeVisual() },
      });
    }
  };
  const stock =
    type === "captions"
      ? CAPTION_PRESETS
      : type === "graphic"
        ? GRAPHIC_PRESETS
        : CLIP_LOOK_PRESETS;
  return (
    <details className="rounded-lg border border-border p-2.5">
      <summary className="cursor-pointer text-xs font-medium">
        {ui("Personal styles")} · {saved.length}
      </summary>
      <div className="mt-3 space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => fromStock(stock[0].id)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs"
          >
            <Plus size={13} />
            {ui("Create style")}
          </button>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => file.current?.click()}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs"
          >
            <Upload size={13} />
            {ui("Import preset")}
          </button>
        </div>
        <label className="block space-y-1 text-xs">
          <span>{ui("Customize a stock preset")}</span>
          <select
            aria-label={ui("Customize a stock preset")}
            value=""
            disabled={disabled || busy}
            onChange={e => fromStock(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5"
          >
            <option value="" disabled>
              {ui("Choose a preset")}
            </option>
            {stock.map(p => (
              <option key={p.id} value={p.id}>
                {ui(p.name)}
              </option>
            ))}
          </select>
        </label>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={async e => {
            const chosen = e.target.files?.[0];
            e.target.value = "";
            if (!chosen) return;
            try {
              if (chosen.size > 256000)
                throw new Error("This preset file is too large.");
              const imported = readEditorPresetFile(await chosen.text());
              if (imported.type !== type)
                throw new Error(
                  "Open the matching preset library to import this file."
                );
              open({ ...imported, id: crypto.randomUUID() });
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : "Import failed"
              );
            }
          }}
        />
        {saved.map(style => (
          <div
            key={style.id}
            className="flex items-center gap-1 rounded-md border border-border p-2"
          >
            <button
              type="button"
              disabled={disabled || busy}
              className="min-w-0 flex-1 truncate text-left text-xs"
              onClick={() => onApply(style)}
            >
              {style.name}
            </button>
            <button
              type="button"
              disabled={disabled || busy}
              aria-label={ui("Edit style")}
              onClick={() => open(style, true)}
              className="p-1.5"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              aria-label={ui("Export preset")}
              className="p-1.5"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([writeEditorPresetFile(style)], {
                    type: "application/json",
                  })
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = `${style.name.replace(/[^a-z0-9_-]/gi, "-")}.reel-preset.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <Download size={13} />
            </button>
          </div>
        ))}
        {error && !draft && (
          <p role="alert" className="text-xs text-destructive">
            {ui(error)}
          </p>
        )}
      </div>
      <Dialog
        open={!!draft}
        onOpenChange={open => {
          if (!open && !busy) setDraft(undefined);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogTitle>
            {ui(editing ? "Edit style" : "Create style")}
          </DialogTitle>
          <DialogDescription>
            {ui("Customize, save and reuse this preset in any edit.")}
          </DialogDescription>
          {draft && (
            <>
              <input
                aria-label={ui("Style name")}
                value={draft.name}
                maxLength={60}
                onChange={e => setDraft({ ...draft, name: e.target.value })}
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              />
              {draft.type === "captions" ? (
                <CaptionStyleFields
                  preset={draft.captionStyle}
                  appearance={draft.captionAppearance}
                  onChange={(captionStyle, captionAppearance) =>
                    setDraft({ ...draft, captionStyle, captionAppearance })
                  }
                />
              ) : draft.type === "graphic" ? (
                <GraphicStyleFields value={draft} onChange={setDraft} />
              ) : (
                <LookStyleFields
                  value={draft.settings}
                  onChange={settings => setDraft({ ...draft, settings })}
                />
              )}
              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {ui(error)}
                </p>
              )}
              <button
                type="button"
                disabled={busy || !draft.name.trim()}
                className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-40"
                onClick={async () => {
                  if (busy) return;
                  setBusy(true);
                  setError("");
                  try {
                    const normalized = normalizeEditorSavedStyle(draft);
                    if (!normalized)
                      throw new Error(
                        "This preset contains unsupported settings."
                      );
                    await updateWorkspace(current => {
                      if (
                        current.profile.email.toLowerCase() !==
                          scope.current?.owner ||
                        selectedBrand(current.profile.email.toLowerCase()) !==
                          scope.current?.brand
                      )
                        throw new Error(
                          "The destination workspace changed. Start the import again."
                        );
                      return saveWorkspaceStyle(
                        current,
                        { kind: "element", value: normalized },
                        editing ? "update" : "create"
                      );
                    });
                    setDraft(undefined);
                  } catch (cause) {
                    setError(
                      cause instanceof Error ? cause.message : "Save failed"
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {ui(busy ? "Saving…" : "Save style")}
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </details>
  );
}
