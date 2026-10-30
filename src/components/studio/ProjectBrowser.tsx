import { useEffect, useMemo, useRef, useState } from "react";
import { Folder, FolderPlus, Film, Plus, Search } from "lucide-react";
import type { Asset, EditProject } from "@contracts/workspace";
import { useWorkspace } from "@/providers/workspace";
import { getUiLocale, useUiText } from "@/lib/i18n/ui";
import { TimelinePreview } from "./TimelinePreview";
import { CompactSelect } from "@/components/ui/compact-select";

function ProjectPreview({
  project,
  assets,
}: {
  project: EditProject;
  assets: Asset[];
}) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "120px" }
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const first = project.clips
    .filter(c => !c.hidden && c.track !== "audio")
    .sort((a, b) => a.start - b.start)[0];
  const time = Math.min(
    Math.max(0, project.duration - 0.01),
    (first?.start ?? 0) + 0.5
  );
  return (
    <div
      ref={host}
      className="mb-3 flex h-36 items-center justify-center overflow-hidden rounded-lg bg-black"
      aria-hidden="true"
    >
      {visible && first ? (
        <TimelinePreview
          project={project}
          assets={assets}
          time={time}
          playing={false}
        />
      ) : (
        <Film className="size-6 text-muted-foreground" />
      )}
    </div>
  );
}

export function ProjectBrowser({
  onOpen,
  onCreate,
  busy,
}: {
  onOpen(project: EditProject): void;
  onCreate(): void;
  busy: boolean;
}) {
  const { workspace, updateWorkspace } = useWorkspace();
  const ui = useUiText();
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("");
  const [sort, setSort] = useState("recent");
  const [status, setStatus] = useState("");
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [error, setError] = useState("");
  const folders = workspace.projectFolders ?? [];
  const projects = useMemo(
    () =>
      workspace.projects
        .filter(
          p =>
            (!query || p.title.toLowerCase().includes(query.toLowerCase())) &&
            (!folder || p.folderId === folder) &&
            (!status || p.status === status)
        )
        .sort((a, b) =>
          sort === "name"
            ? a.title.localeCompare(b.title)
            : sort === "oldest"
              ? a.createdAt.localeCompare(b.createdAt)
              : b.updatedAt.localeCompare(a.updatedAt)
        ),
    [workspace.projects, query, folder, status, sort]
  );
  async function saveFolder() {
    if (!newFolder?.trim()) return;
    try {
      await updateWorkspace(w => ({
        ...w,
        projectFolders: [
          ...(w.projectFolders ?? []),
          { id: crypto.randomUUID(), name: newFolder.trim().slice(0, 60) },
        ],
      }));
      setNewFolder(null);
    } catch {
      setError(ui("Save failed"));
    }
  }
  return (
    <section className="space-y-4" aria-label={ui("Projects")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{ui("Projects")}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setNewFolder("")}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"
          >
            <FolderPlus size={15} />
            {ui("New folder")}
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={busy}
            className="ai-magic inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} />
            {ui("New project")}
          </button>
        </div>
      </div>
      {newFolder !== null && (
        <form
          className="flex gap-2"
          onSubmit={e => {
            e.preventDefault();
            void saveFolder();
          }}
        >
          <input
            aria-label={ui("Folder name")}
            value={newFolder}
            maxLength={60}
            onChange={e => setNewFolder(e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          />
          <button type="submit" className="text-sm text-primary">
            {ui("Create")}
          </button>
          <button
            type="button"
            onClick={() => setNewFolder(null)}
            className="text-sm text-muted-foreground"
          >
            {ui("Cancel")}
          </button>
        </form>
      )}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search
            size={15}
            className="absolute left-3 top-3 text-muted-foreground"
          />
          <input
            aria-label={ui("Search projects")}
            placeholder={ui("Search projects")}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm"
          />
        </div>
        <div className="w-40">
          <CompactSelect
            aria-label={ui("Project status")}
            value={status}
            onValueChange={setStatus}
            options={[
              { value: "", label: ui("All statuses") },
              ...["editing", "review", "published"].map(value => ({
                value,
                label: ui(
                  value === "editing"
                    ? "Editing"
                    : value === "review"
                      ? "Review"
                      : "Published"
                ),
              })),
            ]}
          />
        </div>
        <div className="w-44">
          <CompactSelect
            aria-label={ui("Sort projects")}
            value={sort}
            onValueChange={setSort}
            options={[
              { value: "recent", label: ui("Last edited") },
              { value: "oldest", label: ui("Oldest first") },
              { value: "name", label: ui("Name A–Z") },
            ]}
          />
        </div>
      </div>
      {!!folders.length && (
        <div className="flex flex-wrap gap-2">
          {[{ id: "", name: ui("All projects") }, ...folders].map(f => (
            <button
              type="button"
              key={f.id}
              onClick={() => setFolder(f.id)}
              aria-pressed={folder === f.id}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${folder === f.id ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-surface"}`}
            >
              <Folder size={14} />
              {f.name}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map(p => (
          <article
            key={p.id}
            className="group overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-primary/40"
          >
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpen(p)}
              className="block w-full p-4 text-left"
            >
              <ProjectPreview project={p} assets={workspace.assets} />
              <h3 className="truncate text-sm font-semibold">{p.title}</h3>
              <p className="mt-2 text-xs text-muted-foreground">
                {p.aspectRatio} · {p.clips.length} {ui("clips")} ·{" "}
                {Math.round(p.duration)}s
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {ui("Last edited")}{" "}
                {new Date(p.updatedAt).toLocaleDateString(getUiLocale())}
              </p>
            </button>
            <div className="border-t border-border px-3 py-2">
              <CompactSelect
                aria-label={ui("Move {{name}} to folder", { name: p.title })}
                value={p.folderId ?? ""}
                onValueChange={id =>
                  void updateWorkspace(w => ({
                    ...w,
                    projects: w.projects.map(item =>
                      item.id === p.id
                        ? { ...item, folderId: id || undefined }
                        : item
                    ),
                  })).catch(() => setError(ui("Save failed")))
                }
                options={[
                  { value: "", label: ui("No folder") },
                  ...folders.map(f => ({ value: f.id, label: f.name })),
                ]}
              />
            </div>
          </article>
        ))}
      </div>
      {!projects.length && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {ui("No matching projects")}
        </p>
      )}
    </section>
  );
}
