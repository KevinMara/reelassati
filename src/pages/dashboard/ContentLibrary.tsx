import { LibraryOrganization } from "@/components/studio/LibraryOrganization";
import {
  DEFAULT_LIBRARY_ORGANIZATION,
  libraryOrganizationMatches,
  isStockCollection,
} from "@/lib/library-organization";
import { CompactSelect } from "@/components/ui/compact-select";
import { StockLibrary } from "@/components/studio/StockLibrary";
import { useUiText } from "@/lib/i18n/ui";
import { useTranslation } from "react-i18next";
import { StudioSelect } from "@/components/ui/studio-select";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ExternalLink,
  FileText,
  Grid3X3,
  Image as ImageIcon,
  List,
  Loader2,
  Music,
  Pencil,
  Search,
  Star,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import type { Asset, AssetKind, ScriptDraft } from "@contracts/workspace";
import { platformApi } from "@/lib/platform-api";
import { useWorkspace } from "@/providers/workspace";
import { useFileDropZone } from "@/hooks/useFileDropZone";
import { AiProvenanceBadge } from "@/components/compliance/AiProvenanceBadge";
import { EditAssetLink } from "@/components/studio/EditAssetLink";
import { copyTextWithProvenance } from "@/lib/provenance";
import { validateFileSelection } from "@/lib/file-validation";
import posthog from "@/lib/posthog";

type LibraryFilter = "all" | AssetKind;

type LibraryItem =
  | {
      id: string;
      source: "asset";
      title: string;
      kind: AssetKind;
      createdAt: string;
      asset: Asset;
    }
  | {
      id: string;
      source: "script";
      title: string;
      kind: "script";
      createdAt: string;
      script: ScriptDraft;
    };

const FILTERS: Array<{ value: LibraryFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "video", label: "Video" },
  { value: "image", label: "Images" },
  { value: "audio", label: "Audio" },
  { value: "script", label: "Scripts" },
  { value: "export", label: "Exports" },
];

const KIND_META: Record<
  AssetKind,
  { label: string; icon: typeof Video; color: string }
> = {
  video: { label: "Video", icon: Video, color: "bg-blue-500/10 text-blue-500" },
  image: {
    label: "Image",
    icon: ImageIcon,
    color: "bg-emerald-500/10 text-emerald-500",
  },
  audio: {
    label: "Audio",
    icon: Music,
    color: "bg-purple-500/10 text-purple-500",
  },
  script: {
    label: "Script",
    icon: FileText,
    color: "bg-amber-500/10 text-amber-500",
  },
  export: { label: "Export", icon: Video, color: "bg-primary/10 text-primary" },
};

function formatBytes(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function AssetPreview({ asset }: { asset: Asset }) {
  if (asset.kind === "image") {
    return (
      <img
        src={asset.url}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
      />
    );
  }
  if (asset.kind === "video" || asset.kind === "export") {
    return (
      <video
        src={asset.url}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
    );
  }
  const Icon = KIND_META[asset.kind].icon;
  return <Icon className="h-8 w-8 text-primary" aria-hidden="true" />;
}

export default function ContentLibrary() {
  const ui = useUiText();
  const { i18n } = useTranslation();
  const interfaceLocale = i18n.resolvedLanguage || i18n.language || "en";
  const { workspace, capabilities, updateWorkspace, loading, saving } =
    useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const focusSearch = searchParams.get("focus") === "search";
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [projectFilter, setProjectFilter] = useState("");
  const [organization, setOrganization] = useState(
    DEFAULT_LIBRARY_ORGANIZATION
  );
  const [now] = useState(() => Date.now());
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    message: string;
    values?: Record<string, string>;
  } | null>(null);

  useEffect(() => {
    if (!focusSearch) return;
    searchInputRef.current?.focus();
    const nextParams = new URLSearchParams(searchParamsKey);
    nextParams.delete("focus");
    setSearchParams(nextParams, { replace: true });
  }, [focusSearch, searchParamsKey, setSearchParams]);

  const items = useMemo<LibraryItem[]>(
    () =>
      [
        ...workspace.assets.map((asset): LibraryItem => ({
          id: `asset-${asset.id}`,
          source: "asset",
          title: asset.name,
          kind: asset.kind,
          createdAt: asset.createdAt,
          asset,
        })),
        ...workspace.scripts.map((script): LibraryItem => ({
          id: `script-${script.id}`,
          source: "script",
          title: script.title,
          kind: "script",
          createdAt: script.createdAt,
          script,
        })),
      ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [workspace.assets, workspace.scripts]
  );

  const filteredItems = useMemo(
    () =>
      items
        .filter(item => {
          if (
            item.source === "asset" &&
            !libraryOrganizationMatches(
              item.asset,
              organization,
              now,
              workspace.mediaFolders
            )
          )
            return false;
          if (
            item.source === "script" &&
            (organization.folder ||
              !["all", "generated"].includes(organization.origin))
          )
            return false;
          if (
            favoritesOnly &&
            (item.source !== "asset" || !item.asset.favorite)
          )
            return false;
          if (
            projectFilter &&
            (item.source !== "asset" ||
              !(
                item.asset.projectId === projectFilter ||
                workspace.projects
                  .find(project => project.id === projectFilter)
                  ?.clips.some(clip => clip.assetId === item.asset.id)
              ))
          )
            return false;
          if (filter !== "all" && item.kind !== filter) return false;
          return (
            !deferredSearch ||
            item.title.toLowerCase().includes(deferredSearch) ||
            item.kind.includes(deferredSearch)
          );
        })
        .sort((a, b) =>
          organization.sort === "name"
            ? a.title.localeCompare(b.title)
            : organization.sort === "oldest"
              ? a.createdAt.localeCompare(b.createdAt)
              : b.createdAt.localeCompare(a.createdAt)
        ),
    [
      organization,
      now,
      deferredSearch,
      filter,
      items,
      favoritesOnly,
      projectFilter,
      workspace.projects,
      workspace.mediaFolders,
    ]
  );

  const uploadSelectedFile = async (file: File | undefined) => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setNotice(null);
    try {
      const asset = await platformApi.uploadAsset(
        file,
        undefined,
        setUploadProgress
      );
      await updateWorkspace(current => ({
        ...current,
        assets: [
          asset,
          ...current.assets.filter(existing => existing.id !== asset.id),
        ],
        activity: [
          {
            id: `event_${asset.id}`,
            type: "upload" as const,
            label: "Asset uploaded",
            detail: asset.name,
            createdAt: asset.createdAt,
          },
          ...current.activity,
        ].slice(0, 100),
      }));
      posthog?.capture("asset_uploaded", {
        asset_kind: asset.kind,
        asset_size_bytes: asset.size,
      });
      setNotice({
        tone: "success",
        message: "{{name}} is ready in your library.",
        values: { name: asset.name },
      });
    } catch (cause) {
      setNotice({
        tone: "error",
        message: cause instanceof Error ? cause.message : "The upload failed.",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const uploadFile = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    acceptMediaFiles(files);
  };

  const acceptMediaFiles = (files: File[]) => {
    const selection = validateFileSelection(files, {
      purpose: "media",
      text: ui,
    });
    if (selection.error) {
      setNotice({ tone: "error", message: selection.error });
      return;
    }
    void uploadSelectedFile(selection.files[0]);
  };

  const { isDragging, dropZoneProps } = useFileDropZone({
    disabled: uploading || !capabilities.uploads,
    onFiles: acceptMediaFiles,
  });

  const deleteItem = async (item: LibraryItem) => {
    if (
      !window.confirm(
        ui("Permanently delete “{{name}}”?", { name: item.title })
      )
    )
      return;
    setDeletingId(item.id);
    setNotice(null);
    try {
      if (item.source === "asset") {
        await platformApi.deleteAsset(item.asset.id);
        await updateWorkspace(current => ({
          ...current,
          assets: current.assets.filter(asset => asset.id !== item.asset.id),
          projects: current.projects.map(project => ({
            ...project,
            activeAssetId:
              project.activeAssetId === item.asset.id
                ? undefined
                : project.activeAssetId,
            clips: project.clips.filter(clip => clip.assetId !== item.asset.id),
          })),
          posts: current.posts.map(post =>
            post.mediaAssetId === item.asset.id
              ? { ...post, mediaAssetId: undefined }
              : post
          ),
        }));
      } else {
        await updateWorkspace(current => ({
          ...current,
          scripts: current.scripts.filter(
            script => script.id !== item.script.id
          ),
        }));
      }
      setNotice({
        tone: "success",
        message: "{{name}} was deleted.",
        values: { name: item.title },
      });
    } catch (cause) {
      setNotice({
        tone: "error",
        message:
          cause instanceof Error
            ? cause.message
            : "The item could not be deleted.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const renameAsset = async (
    item: Extract<LibraryItem, { source: "asset" }>
  ) => {
    const nextName = window
      .prompt(ui("Name this asset"), item.asset.name)
      ?.trim();
    if (!nextName || nextName === item.asset.name) return;
    setRenamingId(item.id);
    setNotice(null);
    try {
      const { asset } = await platformApi.renameAsset(item.asset.id, nextName);
      await updateWorkspace(current => ({
        ...current,
        assets: current.assets.map(candidate =>
          candidate.id === asset.id ? { ...candidate, ...asset } : candidate
        ),
        projects: current.projects.map(project => ({
          ...project,
          clips: project.clips.map(clip =>
            clip.assetId === asset.id ? { ...clip, label: asset.name } : clip
          ),
        })),
      }));
      setNotice({
        tone: "success",
        message: "Renamed to {{name}}.",
        values: { name: asset.name },
      });
    } catch (cause) {
      setNotice({
        tone: "error",
        message:
          cause instanceof Error
            ? cause.message
            : "The asset could not be renamed.",
      });
    } finally {
      setRenamingId(null);
    }
  };

  const copyLibraryScript = async (
    item: Extract<LibraryItem, { source: "script" }>
  ) => {
    setNotice(null);
    try {
      await copyTextWithProvenance(
        item.script.fullScript,
        item.script.provenance
      );
      setNotice({
        tone: "success",
        message: "{{name}} was copied.",
        values: { name: item.title },
      });
    } catch {
      setNotice({
        tone: "error",
        message:
          "Copying was blocked by the browser. Select the script and copy it manually.",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div
        {...dropZoneProps}
        className={`mb-8 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-dashed p-2 transition-all ${
          isDragging
            ? "border-primary bg-primary/10 shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]"
            : "border-transparent"
        }`}
      >
        <div>
          <p className="mono-eyebrow mb-2 text-primary">
            {ui("Private media system")}
          </p>
          <h1 className="text-3xl font-semibold">{ui("Content Library")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/70">
            {ui(
              "Your uploaded footage, generated media, exports, and saved scripts, ready to reuse across your projects."
            )}
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,audio/*,image/*"
            onChange={uploadFile}
            className="sr-only"
            aria-label={ui("Choose media to upload")}
          />
          <button
            type="button"
            data-tour="library-upload"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !capabilities.uploads}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading
              ? ui("Uploading {{progress}}%", { progress: uploadProgress })
              : ui("Upload media")}
          </button>
          <p className="mt-1 text-center text-xs text-foreground/65">
            {isDragging ? ui("Drop files here") : ui("or drop a file here")}
          </p>
          {!capabilities.uploads ? (
            <p className="mt-2 max-w-52 text-right text-xs text-amber-600">
              {ui("Media storage needs configuration.")}
            </p>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div
          role="status"
          className={`mb-5 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            notice.tone === "error"
              ? "border-red-500/20 bg-red-500/5 text-red-600"
              : "border-emerald-500/20 bg-emerald-500/5 text-emerald-600"
          }`}
        >
          {notice.tone === "error" ? <AlertCircle className="h-4 w-4" /> : null}
          {ui(notice.message, notice.values)}
        </div>
      ) : null}

      <div
        data-tour="library-find"
        className="mb-3 flex flex-wrap items-center gap-3"
      >
        <label className="relative min-w-64 flex-1 sm:max-w-md">
          <span className="sr-only">{ui("Search library")}</span>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/65" />
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={ui("Search by name or type")}
            className="h-9 w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <div className="flex flex-wrap gap-1" aria-label={ui("Filter library")}>
          {FILTERS.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                filter === option.value
                  ? "bg-primary text-white"
                  : "border border-border bg-surface hover:border-primary/40"
              }`}
            >
              {ui(option.label)}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            aria-label={ui("Grid view")}
            aria-pressed={viewMode === "grid"}
            className={`rounded-lg p-2 ${
              viewMode === "grid"
                ? "bg-primary text-white"
                : "border border-border bg-surface"
            }`}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-label={ui("List view")}
            aria-pressed={viewMode === "list"}
            className={`rounded-lg p-2 ${
              viewMode === "list"
                ? "bg-primary text-white"
                : "border border-border bg-surface"
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      <LibraryOrganization
        value={organization}
        onChange={setOrganization}
        extraFiltersActive={favoritesOnly || Boolean(projectFilter)}
        filterControls={
          <div className="grid gap-3">
            <button
              type="button"
              aria-pressed={favoritesOnly}
              onClick={() => setFavoritesOnly(!favoritesOnly)}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${favoritesOnly ? "border-primary bg-primary/15" : "border-border"}`}
            >
              <Star className="h-4 w-4" />
              {ui("Favorites")}
            </button>
            <StudioSelect
              aria-label={ui("Filter Library by project")}
              value={projectFilter}
              onChange={event => setProjectFilter(event.target.value)}
              className="h-8 w-full rounded-lg border border-border bg-surface px-2.5 text-xs"
            >
              <option value="">{ui("All projects")}</option>
              {workspace.projects.map(project => (
                <option value={project.id} key={project.id}>
                  {project.title}
                </option>
              ))}
            </StudioSelect>
          </div>
        }
      />
      {organization.origin === "stock" && <StockLibrary />}
      {filteredItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center">
          <FileText className="mx-auto h-7 w-7 text-primary" />
          <h2 className="mt-4 font-medium">
            {items.length
              ? ui("No matching content")
              : ui("Your reusable library starts here")}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-foreground/70">
            {items.length
              ? ui("Change the search or filter to reveal more items.")
              : ui(
                  "Upload real media here, or create a script and it will appear automatically."
                )}
          </p>
          {!items.length ? (
            <Link
              to="/dashboard/script"
              className="mt-5 inline-flex rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-primary/40"
            >
              {ui("Create a script")}
            </Link>
          ) : null}
        </div>
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "space-y-3"
          }
        >
          {filteredItems.map(item => {
            const meta = KIND_META[item.kind];
            const Icon = meta.icon;
            const isDeleting = deletingId === item.id;
            const isRenaming = renamingId === item.id;
            return (
              <article
                key={item.id}
                className={`relative min-w-0 overflow-visible rounded-xl border border-border bg-surface transition-shadow focus-within:z-30 hover:shadow-card-hover ${
                  viewMode === "list" ? "flex items-center gap-4 p-4" : ""
                }`}
              >
                {item.source === "asset" && (
                  <button
                    type="button"
                    aria-label={
                      item.asset.favorite
                        ? ui("Remove favorite")
                        : ui("Add favorite")
                    }
                    aria-pressed={item.asset.favorite === true}
                    disabled={saving}
                    onClick={() => {
                      void updateWorkspace(current => ({
                        ...current,
                        assets: current.assets.map(asset =>
                          asset.id === item.asset.id
                            ? { ...asset, favorite: !asset.favorite }
                            : asset
                        ),
                      })).catch(() =>
                        setNotice({
                          tone: "error",
                          message: "Favorite could not be saved.",
                        })
                      );
                    }}
                    className="absolute right-3 top-3 z-10 rounded-full border border-border bg-surface p-2 text-primary"
                  >
                    <Star
                      className="h-4 w-4"
                      fill={item.asset.favorite ? "currentColor" : "none"}
                    />
                  </button>
                )}
                <div
                  className={`flex shrink-0 items-center justify-center overflow-hidden bg-background ${
                    viewMode === "grid"
                      ? "aspect-video w-full rounded-t-xl"
                      : "h-14 w-20 rounded-lg"
                  }`}
                >
                  {item.source === "asset" ? (
                    <AssetPreview asset={item.asset} />
                  ) : (
                    <Icon className="h-7 w-7 text-primary" />
                  )}
                </div>
                <div
                  className={
                    viewMode === "grid" ? "min-w-0 p-4" : "min-w-0 flex-1"
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}
                      >
                        {ui(meta.label)}
                      </span>
                      <h2
                        className="mt-2 truncate text-sm font-medium"
                        title={item.title}
                      >
                        {item.title}
                      </h2>
                      <p className="mt-1 text-xs text-foreground/65">
                        {new Date(item.createdAt).toLocaleDateString(
                          interfaceLocale
                        )}
                        {item.source === "asset"
                          ? ` · ${formatBytes(item.asset.size)}`
                          : ""}
                      </p>
                      {item.source === "asset" && (
                        <div className="mt-2 max-w-48">
                          <CompactSelect
                            aria-label={ui("Move {{name}} to folder", {
                              name: item.title,
                            })}
                            value={item.asset.folderId ?? ""}
                            options={[
                              { value: "", label: ui("No folder") },
                              ...(workspace.mediaFolders ?? []).map(f => ({
                                value: f.id,
                                label: isStockCollection(f)
                                  ? ui("Stock")
                                  : f.name,
                              })),
                            ]}
                            onValueChange={folderId =>
                              void updateWorkspace(w => ({
                                ...w,
                                assets: w.assets.map(a =>
                                  a.id === item.asset.id
                                    ? { ...a, folderId: folderId || undefined }
                                    : a
                                ),
                              })).catch(() =>
                                setNotice({
                                  tone: "error",
                                  message: "Save failed",
                                })
                              )
                            }
                          />
                        </div>
                      )}
                      <div className="mt-2">
                        <AiProvenanceBadge
                          provenance={
                            item.source === "asset"
                              ? item.asset.provenance
                              : item.script.provenance
                          }
                          compact
                        />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {item.source === "asset" ? (
                        <button
                          type="button"
                          onClick={() => void renameAsset(item)}
                          disabled={isRenaming || saving}
                          aria-label={ui("Rename {{name}}", {
                            name: item.title,
                          })}
                          className="rounded-md p-1.5 text-foreground/70 transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                        >
                          {isRenaming ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Pencil className="h-4 w-4" />
                          )}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void deleteItem(item)}
                        disabled={isDeleting || saving}
                        aria-label={ui("Delete {{name}}", { name: item.title })}
                        className="rounded-md p-1.5 text-foreground/70 transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4">
                    {item.source === "asset" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {item.asset.kind === "video" ||
                        item.asset.kind === "image" ||
                        item.asset.kind === "audio" ? (
                          <EditAssetLink
                            assetId={item.asset.id}
                            label={ui("Use in Edit")}
                            compact
                          />
                        ) : null}
                        <a
                          href={item.asset.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground/70 transition-colors hover:border-primary/35 hover:text-foreground"
                        >
                          {ui("Open")} <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs">
                        <Link
                          to={`/dashboard/script?script=${encodeURIComponent(item.script.id)}`}
                          className="inline-flex rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground hover:bg-primary-hover"
                        >
                          {ui("Open in Script")}
                        </Link>
                        <details>
                          <summary className="cursor-pointer font-medium text-primary">
                            {ui("Read script")}
                          </summary>
                          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-background p-3 leading-relaxed text-foreground/65">
                            {item.script.fullScript}
                          </p>
                          <button
                            type="button"
                            onClick={() => void copyLibraryScript(item)}
                            className="mt-2 text-xs font-medium text-primary hover:underline"
                          >
                            {ui("Copy with origin record")}
                          </button>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
