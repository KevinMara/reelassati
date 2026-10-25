import { useState } from "react";
import { Folder, FolderPlus } from "lucide-react";
import { useWorkspace } from "@/providers/workspace";
import { useUiText } from "@/lib/i18n/ui";
import { CompactSelect } from "@/components/ui/compact-select";
import type { LibraryOrganizationState } from "@/lib/library-organization";

export function LibraryOrganization({
  value,
  onChange,
}: {
  value: LibraryOrganizationState;
  onChange(value: LibraryOrganizationState): void;
}) {
  const ui = useUiText();
  const { workspace, updateWorkspace, saving } = useWorkspace();
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState("");
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={!value.folder && value.origin === "all"}
          onClick={() => onChange({ ...value, folder: "", origin: "all" })}
          className="rounded-xl border border-border px-3 py-2 text-xs"
        >
          {ui("All files")}
        </button>
        <button
          type="button"
          aria-pressed={value.origin === "stock"}
          onClick={() =>
            onChange({
              ...value,
              folder: "",
              origin: value.origin === "stock" ? "all" : "stock",
            })
          }
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${value.origin === "stock" ? "border-primary/40 bg-primary/10 text-primary" : "border-border"}`}
        >
          <Folder size={14} />
          {ui("Reel stock")}
        </button>
        {(workspace.mediaFolders ?? []).map(folder => (
          <button
            type="button"
            key={folder.id}
            onClick={() =>
              onChange({ ...value, folder: folder.id, origin: "all" })
            }
            aria-pressed={value.folder === folder.id}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${value.folder === folder.id ? "border-primary/40 bg-primary/10 text-primary" : "border-border"}`}
          >
            <Folder size={14} />
            {folder.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setName("")}
          aria-label={ui("New folder")}
          className="rounded-xl border border-dashed border-border p-2 text-muted-foreground"
        >
          <FolderPlus size={15} />
        </button>
      </div>
      {name !== null && (
        <form
          className="flex gap-2"
          onSubmit={e => {
            e.preventDefault();
            if (!name.trim()) return;
            void updateWorkspace(w => ({
              ...w,
              mediaFolders: [
                ...(w.mediaFolders ?? []),
                { id: crypto.randomUUID(), name: name.trim().slice(0, 60) },
              ],
            }))
              .then(() => setName(null))
              .catch(() => setError(ui("Save failed")));
          }}
        >
          <input
            aria-label={ui("Folder name")}
            value={name}
            maxLength={60}
            onChange={e => setName(e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="text-xs text-primary"
          >
            {ui("Create")}
          </button>
          <button
            type="button"
            onClick={() => setName(null)}
            className="text-xs text-muted-foreground"
          >
            {ui("Cancel")}
          </button>
        </form>
      )}
      <div className="flex flex-wrap gap-2">
        {(
          [
            [
              "origin",
              "Source",
              [
                ["all", "All sources"],
                ["uploaded", "Uploaded"],
                ["generated", "Generated"],
                ["stock", "Stock"],
                ["export", "Exports"],
              ],
            ],
            [
              "date",
              "Uploaded",
              [
                ["all", "Any time"],
                ["1", "Past day"],
                ["7", "Past week"],
                ["30", "Past month"],
              ],
            ],
            [
              "sort",
              "Sort files",
              [
                ["recent", "Newest first"],
                ["oldest", "Oldest first"],
                ["name", "Name A–Z"],
              ],
            ],
          ] as const
        ).map(([key, label, options]) => (
          <div key={key} className="min-w-36 flex-1 sm:max-w-48">
            <CompactSelect
              aria-label={ui(label)}
              value={value[key]}
              onValueChange={next => onChange({ ...value, [key]: next })}
              options={options.map(([value, label]) => ({
                value,
                label: ui(label),
              }))}
            />
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
