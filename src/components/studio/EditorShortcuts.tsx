import { useUiText } from "@/lib/i18n/ui";
import { useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createDefaultEditorKeybindings,
  editorChordFromEvent,
  EDITOR_KEYBOARD_ACTIONS,
  formatEditorChord,
  loadEditorKeybindings,
  saveEditorKeybindings,
  validateEditorKeybindings,
  type EditorActionId,
  type EditorKeybindings,
} from "@/lib/editor-keybindings";

type EditingBinding = { action: EditorActionId; index: number; draft: string };

export function EditorShortcuts({
  open,
  onOpenChange,
  bindings,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bindings?: EditorKeybindings;
  onChange?: (bindings: EditorKeybindings) => void;
}) {
  const ui = useUiText();
  const [query, setQuery] = useState("");
  const [localBindings, setLocalBindings] = useState(loadEditorKeybindings);
  const [editing, setEditing] = useState<EditingBinding | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const activeBindings = bindings ?? localBindings;
  const found = EDITOR_KEYBOARD_ACTIONS.filter(action =>
    [
      ui(action.label),
      ui(action.group),
      action.label,
      action.group,
      ...activeBindings[action.id],
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  const publishBindings = (next: EditorKeybindings) => {
    const result = validateEditorKeybindings(next);
    if (!result.valid) {
      setError(result.errors.map(item => item.message).join(" "));
      return false;
    }
    if (onChange) onChange(result.bindings!);
    else {
      setLocalBindings(result.bindings!);
      if (!saveEditorKeybindings(result.bindings!)) {
        setError(
          ui(
            "Shortcuts changed for this session. Your browser could not save the preference."
          )
        );
        return true;
      }
    }
    setError("");
    return true;
  };
  const editBinding = (action: EditorActionId, index: number) => {
    setEditing({ action, index, draft: activeBindings[action][index] ?? "" });
    setRecording(false);
    setError("");
  };
  const applyBinding = () => {
    if (!editing) return;
    const next = {
      ...activeBindings,
      [editing.action]: [...activeBindings[editing.action]],
    };
    next[editing.action][editing.index] = editing.draft;
    if (publishBindings(next)) {
      setEditing(null);
      setRecording(false);
    }
  };
  const close = (nextOpen: boolean) => {
    if (!nextOpen) {
      setEditing(null);
      setRecording(false);
      setError("");
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
        onKeyDownCapture={event => {
          if (!recording || !editing || event.key === "Tab") return;
          event.preventDefault();
          event.stopPropagation();
          if (event.key === "Escape") {
            setRecording(false);
            return;
          }
          const chord = editorChordFromEvent(event.nativeEvent);
          if (!chord) return;
          setEditing({ ...editing, draft: chord });
          setRecording(false);
          setError("");
        }}
      >
        <DialogTitle>{ui("Keyboard shortcuts")}</DialogTitle>
        <DialogDescription>
          {ui(
            "Customize timeline commands. Preferences stay in this browser. Text fields and dialogs keep their normal typing shortcuts. Mod means Ctrl on Windows/Linux and ⌘ on macOS. Recorded shortcuts use physical keys, including on other keyboard layouts."
          )}
        </DialogDescription>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-48 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3">
            <Search className="size-4 text-foreground/50" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={ui("Find an action…")}
              aria-label={ui("Search shortcuts")}
              className="w-full bg-transparent py-2.5 text-sm outline-none"
            />
          </label>
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-foreground/5"
            onClick={() => {
              if (publishBindings(createDefaultEditorKeybindings())) {
                setEditing(null);
                setRecording(false);
              }
            }}
          >
            {ui("Reset defaults")}
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {["Playback", "Clips", "Workspace"].map(group => {
          const rows = found.filter(action => action.group === group);
          return rows.length ? (
            <section key={group}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                {ui(group)}
              </h3>
              <dl className="divide-y divide-border">
                {rows.map(action => (
                  <div key={action.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-sm">{ui(action.label)}</dt>
                      <dd className="flex max-w-[60%] flex-wrap items-center justify-end gap-1.5 text-xs text-foreground/70">
                        {!activeBindings[action.id].length && (
                          <span>{ui("Unassigned")}</span>
                        )}
                        {activeBindings[action.id].map((chord, index) => (
                          <span
                            key={chord}
                            className="inline-flex items-center overflow-hidden rounded border border-border"
                          >
                            <button
                              type="button"
                              aria-label={ui(
                                "Edit {{action}} shortcut {{shortcut}}",
                                {
                                  action: ui(action.label),
                                  shortcut: formatEditorChord(chord),
                                }
                              )}
                              className="px-2 py-1 hover:bg-foreground/5"
                              onClick={() => editBinding(action.id, index)}
                            >
                              <kbd>{formatEditorChord(chord)}</kbd>
                            </button>
                            <button
                              type="button"
                              aria-label={ui(
                                "Remove {{action}} shortcut {{shortcut}}",
                                {
                                  action: ui(action.label),
                                  shortcut: formatEditorChord(chord),
                                }
                              )}
                              className="border-l border-border px-1.5 py-1 hover:bg-foreground/5"
                              onClick={() => {
                                publishBindings({
                                  ...activeBindings,
                                  [action.id]: activeBindings[action.id].filter(
                                    (_, i) => i !== index
                                  ),
                                });
                                if (editing?.action === action.id) {
                                  setEditing(null);
                                  setRecording(false);
                                }
                              }}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <button
                          type="button"
                          className="rounded border border-border px-2 py-1 hover:bg-foreground/5"
                          aria-label={ui("Add shortcut for {{action}}", {
                            action: ui(action.label),
                          })}
                          disabled={activeBindings[action.id].length >= 8}
                          onClick={() =>
                            editBinding(
                              action.id,
                              activeBindings[action.id].length
                            )
                          }
                        >
                          {ui("Add")}
                        </button>
                      </dd>
                    </div>
                    {editing?.action === action.id && (
                      <div className="mt-3 rounded-lg border border-border bg-background p-3">
                        <label
                          htmlFor={`shortcut-${action.id}`}
                          className="mb-1 block text-xs text-foreground/70"
                        >
                          {ui("Shortcut for")} {ui(action.label)}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <input
                            id={`shortcut-${action.id}`}
                            value={editing.draft}
                            placeholder={ui("e.g. Mod+Shift+S")}
                            className="min-w-32 flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
                            onChange={event =>
                              setEditing({
                                ...editing,
                                draft: event.target.value,
                              })
                            }
                            onKeyDown={event => {
                              if (event.key === "Enter" && !recording) {
                                event.preventDefault();
                                applyBinding();
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="rounded border border-border px-2 py-1.5 text-xs"
                            onClick={() => setRecording(value => !value)}
                          >
                            {recording ? ui("Stop recording") : ui("Record")}
                          </button>
                          <button
                            type="button"
                            className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground"
                            disabled={!editing.draft.trim() || recording}
                            onClick={applyBinding}
                          >
                            {ui("Apply")}
                          </button>
                          <button
                            type="button"
                            className="rounded border border-border px-2 py-1.5 text-xs"
                            onClick={() => {
                              setEditing(null);
                              setRecording(false);
                              setError("");
                            }}
                          >
                            {ui("Cancel")}
                          </button>
                        </div>
                        <p
                          aria-live="polite"
                          className="mt-2 text-xs text-foreground/60"
                        >
                          {recording
                            ? ui(
                                "Press the new key combination. Esc stops recording; Tab moves focus."
                              )
                            : ui(
                                "Click Record or type a chord. Enter Escape to assign Esc. Remove every shortcut to disable an action."
                              )}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </dl>
            </section>
          ) : null;
        })}
        <section className="rounded-xl border border-border bg-background/60 p-4 text-sm leading-relaxed">
          <h3 className="mb-2 font-semibold">
            {ui("Selecting and moving clips")}
          </h3>
          {ui("Hold")} <kbd>{ui("Shift")}</kbd>{" "}
          {ui(
            "and click to add or remove clips from the selection. Drag a selected clip to move the group. Copy, duplicate and delete work on the selection. Unlock clips before moving or deleting them."
          )}
          <p className="mt-3">
            {ui(
              "Ripple delete removes the selected time intervals from every unlocked track and closes the gaps. Undo restores the complete edit."
            )}
          </p>
          <p className="mt-3">
            {ui(
              "Snapping aligns clip edges with nearby clips and the playhead. Hold"
            )}{" "}
            <kbd>Alt</kbd> / <kbd>Option</kbd>{" "}
            {ui("while dragging for exact placement.")}
          </p>
        </section>
        {!found.length && (
          <p className="py-4 text-sm text-foreground/60">
            {ui("No matching shortcut.")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
