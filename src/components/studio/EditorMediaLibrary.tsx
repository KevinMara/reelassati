import { useMemo, useRef, useState } from "react";
import { v4 as createUuid } from "uuid";
import {
  FolderPlus,
  Upload,
  LayoutGrid,
  List,
  ArrowLeft,
  Folder,
  Pencil,
  Trash2,
} from "lucide-react";
import { useWorkspace } from "@/providers/workspace";
import { platformApi } from "@/lib/platform-api";
import { resolveMediaDuration } from "@/lib/media-metadata";
import { validateFileSelection } from "@/lib/file-validation";
import { LibraryAssetCard } from "./LibraryAssetCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function EditorMediaLibrary() {
  const { workspace, updateWorkspace, capabilities } = useWorkspace();
  const [folderId, setFolderId] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [sort, setSort] = useState("newest");
  const [folderName, setFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const folders = workspace.mediaFolders ?? [];
  const currentFolder = folders.find(f => f.id === folderId);
  const reviewedContent = useMemo(() => {
    const index = new Map<string, string[]>();
    for (const project of workspace.projects) {
      for (const review of project.sourceReviews ?? []) {
        index.set(review.assetId, [
          ...(index.get(review.assetId) ?? []),
          review.summary,
          ...review.moments.map(
            m => `${m.start.toFixed(1)}–${m.end.toFixed(1)}s: ${m.note}`
          ),
        ]);
      }
    }
    return index;
  }, [workspace.projects]);
  const assets = useMemo(
    () =>
      workspace.assets
        .filter(
          a =>
            ["video", "image", "audio"].includes(a.kind) &&
            (query.trim() || (a.folderId ?? "") === folderId) &&
            (kind === "all" || a.kind === kind) &&
            [a.name, ...(reviewedContent.get(a.id) ?? [])]
              .join(" ")
              .toLowerCase()
              .includes(query.trim().toLowerCase())
        )
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "duration"
              ? (b.duration ?? 0) - (a.duration ?? 0)
              : sort === "size"
                ? b.size - a.size
                : sort === "oldest"
                  ? a.createdAt.localeCompare(b.createdAt)
                  : b.createdAt.localeCompare(a.createdAt)
        ),
    [workspace.assets, folderId, kind, query, sort, reviewedContent]
  );
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not update your library."
      );
    } finally {
      setBusy(false);
    }
  }
  async function upload(files: File[]) {
    const checked = validateFileSelection(files, {
      purpose: "media",
      multiple: true,
      maxFiles: 50,
    });
    if (checked.error) {
      setMessage(checked.error);
      return;
    }
    await action(async () => {
      const destination = folderId;
      for (const file of checked.files) {
        setMessage(`Uploading ${file.name}…`);
        const asset = await platformApi.uploadAsset(
          file,
          file.type.startsWith("image/")
            ? "image"
            : file.type.startsWith("audio/")
              ? "audio"
              : "video"
        );
        // Save the upload before metadata probing, so a failed probe never loses a file.
        await updateWorkspace(w => ({
          ...w,
          assets: [
            ...w.assets.filter(a => a.id !== asset.id),
            { ...asset, folderId: destination || undefined },
          ],
        }));
        const duration = await resolveMediaDuration(asset).catch(
          () => undefined
        );
        if (duration)
          await updateWorkspace(w => ({
            ...w,
            assets: w.assets.map(a =>
              a.id === asset.id ? { ...a, duration } : a
            ),
          }));
      }
      setMessage(
        "Uploaded to Library. Drag a thumbnail onto the timeline to place it."
      );
    });
  }
  async function saveFolder() {
    const name = folderName.trim();
    if (!name) return;
    await action(() =>
      updateWorkspace(w => ({
        ...w,
        mediaFolders:
          editingFolder && editingFolder !== "new"
            ? (w.mediaFolders ?? []).map(f =>
                f.id === editingFolder ? { ...f, name } : f
              )
            : [
                ...(w.mediaFolders ?? []),
                {
                  id: createUuid(),
                  name,
                  parentId: folderId || undefined,
                },
              ],
      }))
    );
    setEditingFolder(null);
    setFolderName("");
  }
  return (
    <section
      aria-label="Media library"
      onDragOver={e => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={e => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        if (!busy && capabilities.uploads && e.dataTransfer.files.length)
          void upload(Array.from(e.dataTransfer.files));
      }}
      className={`min-h-80 ${dragging ? "bg-primary/15 ring-2 ring-inset ring-primary" : ""}`}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept="video/*,image/*,audio/*"
        className="hidden"
        onChange={e => {
          if (e.target.files) void upload(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !capabilities.uploads}
          onClick={() => input.current?.click()}
          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-40"
        >
          <Upload size={15} />
          Upload
        </button>
        <button
          type="button"
          disabled={busy}
          title="Create folder"
          aria-label="Create folder"
          onClick={() => {
            setEditingFolder("new");
            setFolderName("");
          }}
          className="rounded-lg border border-border p-2"
        >
          <FolderPlus size={17} />
        </button>
        <button
          type="button"
          aria-label="Thumbnail view"
          aria-pressed={view === "grid"}
          onClick={() => setView("grid")}
          className={`ml-auto rounded-lg p-2 ${view === "grid" ? "bg-primary/15 text-primary" : ""}`}
        >
          <LayoutGrid size={17} />
        </button>
        <button
          type="button"
          aria-label="List view"
          aria-pressed={view === "list"}
          onClick={() => setView("list")}
          className={`rounded-lg p-2 ${view === "list" ? "bg-primary/15 text-primary" : ""}`}
        >
          <List size={17} />
        </button>
      </div>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <button
          type="button"
          disabled={!folderId}
          aria-label="Parent folder"
          onClick={() => setFolderId(currentFolder?.parentId ?? "")}
          className="p-1 disabled:opacity-30"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="truncate">
          {currentFolder?.name ?? "Media library"}
        </span>
        <span className="ml-auto text-xs text-foreground/60">
          {assets.length} {assets.length === 1 ? "file" : "files"}
        </span>
      </div>
      {editingFolder && (
        <form
          onSubmit={e => {
            e.preventDefault();
            void saveFolder();
          }}
          className="mb-3 flex gap-2"
        >
          <input
            ref={node => {
              node?.focus();
            }}
            aria-label="Folder name"
            value={folderName}
            maxLength={100}
            onChange={e => setFolderName(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background p-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !folderName.trim()}
            className="text-sm text-primary"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditingFolder(null)}
            className="text-xs"
          >
            Cancel
          </button>
        </form>
      )}
      <input
        type="search"
        aria-label="Search library"
        placeholder="Search files…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="mb-2 w-full rounded-lg border border-border bg-background p-2 text-sm"
      />
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger
            aria-label="Media type"
            size="sm"
            className="w-full min-w-0 border-border bg-background text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            position="popper"
            className="border-border bg-surface text-foreground"
          >
            {[
              ["all", "All types"],
              ["video", "Video"],
              ["image", "Image"],
              ["audio", "Audio"],
            ].map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger
            aria-label="Sort files"
            size="sm"
            className="w-full min-w-0 border-border bg-background text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            position="popper"
            className="border-border bg-surface text-foreground"
          >
            {[
              ["newest", "Newest first"],
              ["oldest", "Oldest first"],
              ["name", "Name"],
              ["duration", "Duration"],
              ["size", "File size"],
            ].map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mb-3 space-y-1">
        {folders
          .filter(f => (f.parentId ?? "") === folderId)
          .map(f => (
            <div
              key={f.id}
              className="flex gap-1 rounded-lg border border-border px-2 py-1"
            >
              <button
                type="button"
                onClick={() => setFolderId(f.id)}
                className="flex min-w-0 flex-1 items-center gap-2 py-2 text-sm"
              >
                <Folder size={16} className="shrink-0 text-primary" />
                <span className="truncate">{f.name}</span>
              </button>
              <button
                type="button"
                aria-label={`Rename ${f.name}`}
                disabled={busy}
                onClick={() => {
                  setEditingFolder(f.id);
                  setFolderName(f.name);
                }}
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                aria-label={`Remove empty folder ${f.name}`}
                title="Only empty folders can be removed"
                disabled={
                  busy ||
                  workspace.assets.some(a => a.folderId === f.id) ||
                  folders.some(child => child.parentId === f.id)
                }
                onClick={() =>
                  void action(() =>
                    updateWorkspace(w => ({
                      ...w,
                      mediaFolders: (w.mediaFolders ?? []).filter(
                        x => x.id !== f.id
                      ),
                    }))
                  )
                }
                className="p-2 disabled:opacity-20"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
      </div>
      {query.trim() && (
        <p className="mb-2 text-xs text-foreground/60">
          Searching all folders and saved AI observations. Unreviewed footage is
          matched by filename.
        </p>
      )}
      <p className="mb-3 text-[11px] text-foreground/45">
        Click to preview · drag to place on the timeline
      </p>
      <div className={view === "grid" ? "grid grid-cols-2 gap-2" : "space-y-2"}>
        {assets.map(asset => (
          <div
            key={asset.id}
            className="min-w-0 rounded-lg border border-border bg-background/50 p-2"
          >
            <LibraryAssetCard
              asset={asset}
              view={view}
              onRename={async name => {
                await platformApi.renameAsset(asset.id, name);
                await updateWorkspace(w => ({
                  ...w,
                  assets: w.assets.map(a =>
                    a.id === asset.id ? { ...a, name } : a
                  ),
                  editorGenerations: w.editorGenerations?.map(g =>
                    g.assetId === asset.id ? { ...g, name } : g
                  ),
                }));
              }}
            />
            {query.trim() &&
              reviewedContent
                .get(asset.id)
                ?.filter(note =>
                  note.toLowerCase().includes(query.trim().toLowerCase())
                )
                .slice(0, 2)
                .map((note, i) => (
                  <p
                    key={i}
                    className="mt-1 line-clamp-3 text-xs text-foreground/65"
                  >
                    {note}
                  </p>
                ))}
            <Select
              disabled={busy}
              value={asset.folderId || "__root"}
              onValueChange={destination => {
                void action(() =>
                  updateWorkspace(w => ({
                    ...w,
                    assets: w.assets.map(a =>
                      a.id === asset.id
                        ? {
                            ...a,
                            folderId:
                              destination === "__root"
                                ? undefined
                                : destination,
                          }
                        : a
                    ),
                  }))
                );
              }}
            >
              <SelectTrigger
                aria-label={`Move ${asset.name} to folder`}
                size="sm"
                className="mt-2 w-full min-w-0 border-border text-[11px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="popper"
                className="border-border bg-surface text-foreground"
              >
                <SelectItem value="__root">Root folder</SelectItem>
                {folders.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      {!assets.length && (
        <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-foreground/60">
          Drop media here, upload files, or open a folder.
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-foreground/70">
          {message}
        </p>
      )}
    </section>
  );
}
