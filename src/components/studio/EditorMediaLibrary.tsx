import { CompactSelect } from "@/components/ui/compact-select";
import { assetOrigin } from "@/lib/library-organization";
import { StockLibrary } from "./StockLibrary";
import { getUiLocale, useUiText } from "@/lib/i18n/ui";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  captureUploadRequestScope,
  verifyUploadRequestScope,
  platformApi,
} from "@/lib/platform-api";
import { selectedBrand } from "@/lib/workspace-scope";
import { DirectVideoImport } from "./DirectVideoImport";
import { resolveMediaDuration } from "@/lib/media-metadata";
import { validateFileSelection } from "@/lib/file-validation";
import { LibraryAssetCard } from "./LibraryAssetCard";
import type { Asset } from "@contracts/workspace";
import { Check, Loader2, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function EditorMediaLibrary({
  playhead,
  onInsert,
}: {
  playhead: number;
  onInsert: (asset: Asset, position: "playhead" | "end") => Promise<void>;
}) {
  const ui = useUiText();
  const { workspace, updateWorkspace, capabilities } = useWorkspace();
  const [folderId, setFolderId] = useState("");
  const [view, setView] = useState<"grid" | "list">("list");
  const [position, setPosition] = useState<"playhead" | "end">("playhead");
  const [inserting, setInserting] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const insertLock = useRef(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [sort, setSort] = useState("newest");
  const [origin,setOrigin]=useState("all");
  const [date,setDate]=useState("all");
  const [now]=useState(()=>Date.now());
  const [folderName, setFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const uploadController = useRef<AbortController | null>(null);
  const uploadGeneration = useRef(0);
  const owner = workspace.profile.email.toLowerCase();
  const brand = selectedBrand(owner);
  useEffect(
    () => () => {
      uploadGeneration.current++;
      uploadController.current?.abort();
    },
    [owner, brand]
  );
  const folders = workspace.mediaFolders ?? [];
  const currentFolder = folders.find(f => f.id === folderId);
  async function insert(asset: Asset) {
    if (insertLock.current || asset.status !== "ready") return;
    insertLock.current = true;
    setInserting(asset.id);
    setAdded(null);
    setMessage("");
    try {
      await onInsert(asset, position);
      setAdded(asset.id);
      setMessage(ui("Added to timeline"));
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : ui("The file could not be added.")
      );
    } finally {
      insertLock.current = false;
      setInserting(null);
    }
  }
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
            (origin==="all"||assetOrigin(a)===origin) &&
            (date==="all"||Date.parse(a.createdAt)>=now-Number(date)*86400000) &&
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
    [workspace.assets, folderId, kind, query, sort, reviewedContent,origin,date,now]
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
      text: ui,
      purpose: "media",
      multiple: true,
      maxFiles: 50,
    });
    if (checked.error) {
      setMessage(checked.error);
      return;
    }
    const generation = ++uploadGeneration.current;
    await action(async () => {
      uploadController.current?.abort();
      const controller = new AbortController();
      uploadController.current = controller;
      const scope = await captureUploadRequestScope();
      controller.signal.throwIfAborted();
      if (
        scope.ownerEmail !== owner ||
        scope.brandId !== brand ||
        generation !== uploadGeneration.current
      )
        throw new Error(ui("The Library workspace changed before uploading."));
      const destination = folderId;
      for (const file of checked.files) {
        controller.signal.throwIfAborted();
        setMessage(`Uploading ${file.name}…`);
        const asset = await platformApi.uploadAsset(
          file,
          file.type.startsWith("image/")
            ? "image"
            : file.type.startsWith("audio/")
              ? "audio"
              : "video",
          undefined,
          undefined,
          { scope, signal: controller.signal }
        );
        controller.signal.throwIfAborted();
        await verifyUploadRequestScope(scope);
        // Save the upload before metadata probing, so a failed probe never loses a file.
        await updateWorkspace(w => {
          controller.signal.throwIfAborted();
          if (
            generation !== uploadGeneration.current ||
            w.profile.email.toLowerCase() !== scope.ownerEmail ||
            selectedBrand(scope.ownerEmail) !== scope.brandId
          )
            throw new Error(
              ui("The Library workspace changed before saving the upload.")
            );
          return {
            ...w,
            assets: [
              ...w.assets.filter(a => a.id !== asset.id),
              { ...asset, folderId: destination || undefined },
            ],
          };
        });
        const duration = await resolveMediaDuration(asset).catch(
          () => undefined
        );
        controller.signal.throwIfAborted();
        await verifyUploadRequestScope(scope);
        if (duration)
          await updateWorkspace(w => {
            controller.signal.throwIfAborted();
            if (
              generation !== uploadGeneration.current ||
              w.profile.email.toLowerCase() !== scope.ownerEmail ||
              selectedBrand(scope.ownerEmail) !== scope.brandId
            )
              throw new Error(
                ui(
                  "The Library workspace changed before saving the measured duration."
                )
              );
            return {
              ...w,
              assets: w.assets.map(a =>
                a.id === asset.id ? { ...a, duration } : a
              ),
            };
          });
      }
      setMessage(ui("Ready to add to your timeline."));
      uploadController.current = null;
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
      aria-label={ui("Media library")}
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
      <div className="grid grid-cols-2 gap-2"><CompactSelect aria-label={ui("Media source")} value={origin} onValueChange={setOrigin} options={[{value:"all",label:ui("All sources")},{value:"uploaded",label:ui("Uploaded")},{value:"generated",label:ui("Generated")},{value:"stock",label:ui("Reel stock")}]} /><CompactSelect aria-label={ui("Date added")} value={date} onValueChange={setDate} options={[{value:"all",label:ui("Any time")},{value:"1",label:ui("Last 24 hours")},{value:"7",label:ui("Last 7 days")},{value:"30",label:ui("Last 30 days")}]} /></div>
      {origin==="stock"&&<StockLibrary/>}
      <DirectVideoImport
        key={`${owner}:${brand}:${folderId}`}
        disabled={busy || !capabilities.uploads}
        onImported={async (asset, scope) => {
          await updateWorkspace(w => {
            if (
              w.profile.email.toLowerCase() !== scope.ownerEmail ||
              selectedBrand(scope.ownerEmail) !== scope.brandId
            )
              throw new Error(
                ui(
                  "The Library workspace changed before saving the imported video."
                )
              );
            return {
              ...w,
              assets: [
                ...w.assets.filter(a => a.id !== asset.id),
                { ...asset, folderId: folderId || undefined },
              ],
            };
          });
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
          {ui("Upload")}
        </button>
        <button
          type="button"
          disabled={busy}
          title={ui("Create folder")}
          aria-label={ui("Create folder")}
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
          aria-label={ui("Thumbnail view")}
          aria-pressed={view === "grid"}
          onClick={() => setView("grid")}
          className={`ml-auto rounded-lg p-2 ${view === "grid" ? "bg-primary/15 text-primary" : ""}`}
        >
          <LayoutGrid size={17} />
        </button>
        <button
          type="button"
          aria-label={ui("List view")}
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
          aria-label={ui("Parent folder")}
          onClick={() => setFolderId(currentFolder?.parentId ?? "")}
          className="p-1 disabled:opacity-30"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="truncate">
          {currentFolder?.name ?? ui("Media library")}
        </span>
        <span className="ml-auto text-xs text-foreground/60">
          {assets.length} {assets.length === 1 ? ui("file") : ui("files")}
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
            aria-label={ui("Folder name")}
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
            {ui("Save")}
          </button>
          <button
            type="button"
            onClick={() => setEditingFolder(null)}
            className="text-xs"
          >
            {ui("Cancel")}
          </button>
        </form>
      )}
      <input
        type="search"
        aria-label={ui("Search library")}
        placeholder={ui("Search files…")}
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="mb-2 w-full rounded-lg border border-border bg-background p-2 text-sm"
      />
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger
            aria-label={ui("Media type")}
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
              ["all", ui("All types")],
              ["video", ui("Video")],
              ["image", ui("Image")],
              ["audio", ui("Audio")],
            ].map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger
            aria-label={ui("Sort files")}
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
              ["newest", ui("Newest first")],
              ["oldest", ui("Oldest first")],
              ["name", ui("Name")],
              ["duration", ui("Duration")],
              ["size", ui("File size")],
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
                aria-label={ui("Rename {{name}}", { name: f.name })}
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
                aria-label={ui("Remove empty folder {{name}}", {
                  name: f.name,
                })}
                title={ui("Only empty folders can be removed")}
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
          {ui(
            "Searching all folders and saved AI observations. Unreviewed footage is matched by filename."
          )}
        </p>
      )}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2">
        <span className="text-xs tabular-nums text-foreground/70">
          {ui("Add to timeline")}
        </span>
        <Select
          value={position}
          onValueChange={value => setPosition(value as "playhead" | "end")}
        >
          <SelectTrigger
            aria-label={ui("Insert position")}
            size="sm"
            className="w-auto min-w-0 gap-2 text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="playhead">
              {ui("At playhead")} ·{" "}
              {playhead.toLocaleString(getUiLocale(), {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              s
            </SelectItem>
            <SelectItem value="end">{ui("At end")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {message && (
        <p role="status" className="mb-3 text-xs text-foreground/70">
          {message}
        </p>
      )}
      <div className={view === "grid" ? "grid grid-cols-2 gap-2" : "space-y-2"}>
        {assets.map(asset => (
          <div
            key={asset.id}
            className={`group min-w-0 rounded-lg border bg-background/50 p-2 transition-colors ${added === asset.id ? "border-emerald-400/50 bg-emerald-400/5" : "border-border hover:border-primary/40"}`}
          >
            <div
              className={
                view === "list"
                  ? "flex min-w-0 items-center gap-2"
                  : "space-y-2"
              }
            >
              <div className="min-w-0 flex-1">
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
              </div>
              <button
                type="button"
                disabled={
                  busy || Boolean(inserting) || asset.status !== "ready"
                }
                aria-label={ui("Add {{name}} to timeline", {
                  name: asset.name,
                })}
                onClick={() => void insert(asset)}
                className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-2 text-xs font-medium text-primary transition hover:bg-primary/20 active:scale-95 disabled:opacity-40 ${view === "grid" ? "w-full" : ""}`}
              >
                {inserting === asset.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : added === asset.id ? (
                  <Check size={14} />
                ) : (
                  <Plus size={14} />
                )}
                {ui("Add")}
              </button>
            </div>
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
            <details className="mt-1 text-[11px] text-foreground/55">
              <summary className="cursor-pointer py-1">
                {ui("Move to folder")}
              </summary>
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
                  aria-label={ui("Move {{name}} to folder", {
                    name: asset.name,
                  })}
                  size="sm"
                  className="mt-2 w-full min-w-0 border-border text-[11px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  className="border-border bg-surface text-foreground"
                >
                  <SelectItem value="__root">{ui("Root folder")}</SelectItem>
                  {folders.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </details>
          </div>
        ))}
      </div>
      {!assets.length && (
        <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-foreground/60">
          {ui("Drop media here, upload files, or open a folder.")}
        </p>
      )}
    </section>
  );
}
