import { useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export const EDITOR_SHORTCUTS = [
  ["Playback", "Play / pause", "Space", "K"],
  ["Playback", "Previous / next frame", "←", "→"],
  ["Playback", "Back / forward one second", "Shift + ←", "Shift + →", "J", "L"],
  ["Playback", "Beginning / end of edit", "Home", "End"],
  ["Clips", "Split at playhead", "S"],
  ["Clips", "Trim start / end to playhead", "Q", "W"],
  ["Clips", "Delete selected clip", "Delete", "Backspace"],
  [
    "Clips",
    "Copy / cut / paste at playhead",
    "Ctrl/⌘ + C",
    "Ctrl/⌘ + X",
    "Ctrl/⌘ + V",
  ],
  ["Clips", "Duplicate", "Ctrl/⌘ + D"],
  ["Clips", "Detach video audio", "Shift + D"],
  ["Clips", "Mute / unmute", "M"],
  ["Clips", "Lock / unlock", "Shift + L"],
  ["Clips", "Deselect", "Esc"],
  ["Clips", "Select all clips", "Ctrl/⌘ + A"],
  ["Clips", "Add / remove from selection", "Shift + click"],
  ["Workspace", "Undo / redo", "Ctrl/⌘ + Z", "Ctrl/⌘ + Shift + Z", "Ctrl + Y"],
  ["Workspace", "Toggle snapping", "N"],
  ["Workspace", "Bypass snapping while dragging", "Alt / Option"],
  ["Workspace", "Zoom timeline in / out / fit", "+", "−", "0"],
  ["Workspace", "Open Library / Adjust", "Shift + B", "Shift + I"],
  ["Workspace", "Keyboard shortcuts", "Ctrl/⌘ + /"],
] as const;
export function EditorShortcuts({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const found = EDITOR_SHORTCUTS.filter(row =>
    row.join(" ").toLowerCase().includes(query.toLowerCase())
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>
          Available when you are editing the timeline. Text fields keep their
          normal typing shortcuts.
        </DialogDescription>
        <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
          <Search className="size-4 text-foreground/50" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Find an action…"
            aria-label="Search shortcuts"
            className="w-full bg-transparent py-2.5 text-sm outline-none"
          />
        </label>
        {["Playback", "Clips", "Workspace"].map(group => {
          const rows = found.filter(row => row[0] === group);
          return rows.length ? (
            <section key={group}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                {group}
              </h3>
              <dl className="divide-y divide-border">
                {rows.map(([, label, ...keys]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 py-2.5"
                  >
                    <dt className="text-sm">{label}</dt>
                    <dd className="flex max-w-[55%] flex-wrap justify-end gap-1.5 text-xs text-foreground/70">
                      {keys.map(key => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null;
        })}
        {!found.length && (
          <p className="py-4 text-sm text-foreground/60">
            No matching shortcut.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
