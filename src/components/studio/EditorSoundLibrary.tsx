import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Pause, Play, Check } from "lucide-react";
import { editorAudioCatalog, editorAudioUrl } from "@/lib/editor-audio-catalog";
import { platformApi } from "@/lib/platform-api";
import { useWorkspace } from "@/providers/workspace";
import { CompactSelect } from "@/components/ui/compact-select";
import { LibraryAssetCard } from "./LibraryAssetCard";

export function EditorSoundLibrary() {
  const { workspace, updateWorkspace, capabilities } = useWorkspace();
  const [tab, setTab] = useState<"catalog" | "files">("catalog");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [playing, setPlaying] = useState("");
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(
    () => () => {
      audio.current?.pause();
    },
    []
  );
  const categories = [
    ...new Set(editorAudioCatalog.map(entry => entry.category)),
  ];
  const entries = editorAudioCatalog.filter(
    entry =>
      (category === "all" || entry.category === category) &&
      `${entry.name} ${entry.category} ${entry.type}`
        .toLowerCase()
        .includes(query.toLowerCase())
  );
  const files = workspace.assets.filter(
    a =>
      a.kind === "audio" &&
      a.status === "ready" &&
      a.name.toLowerCase().includes(query.toLowerCase())
  );
  function preview(entry: (typeof editorAudioCatalog)[number]) {
    audio.current?.pause();
    if (playing === entry.id) {
      setPlaying("");
      return;
    }
    const player = new Audio(editorAudioUrl(entry));
    audio.current = player;
    player.onended = () => setPlaying("");
    player.onerror = () => {
      setPlaying("");
      setMessage("This preview could not load.");
    };
    setPlaying(entry.id);
    void player.play().catch(() => {
      setPlaying("");
      setMessage("This preview could not play. Try again.");
    });
  }
  async function save(entry: (typeof editorAudioCatalog)[number]) {
    if (saving) return;
    setSaving(entry.id);
    setMessage("");
    try {
      const response = await fetch(editorAudioUrl(entry));
      if (!response.ok)
        throw new Error("The sound file could not be downloaded.");
      const blob = await response.blob();
      const extension = entry.file.split(".").pop() || "mp3";
      const type =
        extension === "wav"
          ? "audio/wav"
          : extension === "ogg"
            ? "audio/ogg"
            : "audio/mpeg";
      const asset = await platformApi.uploadAsset(
        new File([blob], `${entry.name}.${extension}`, { type }),
        "audio"
      );
      await updateWorkspace(w => ({
        ...w,
        assets: [
          {
            ...asset,
            name: entry.name,
            duration: entry.duration,
            variantGroupId: `builtin-audio:${entry.id}`,
          },
          ...w.assets.filter(a => a.id !== asset.id),
        ],
      }));
      setMessage(
        `${entry.name} saved to Library. Drag it from My audio files to the timeline.`
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Could not save this sound."
      );
    } finally {
      setSaving("");
    }
  }
  return (
    <section aria-label="Sound library" className="space-y-3">
      <div className="flex gap-1 rounded-lg bg-background/60 p-1">
        <button
          type="button"
          onClick={() => setTab("catalog")}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs ${tab === "catalog" ? "bg-primary/15 text-primary" : "text-foreground/60"}`}
        >
          Free sounds & music
        </button>
        <button
          type="button"
          onClick={() => setTab("files")}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs ${tab === "files" ? "bg-primary/15 text-primary" : "text-foreground/60"}`}
        >
          My audio files
        </button>
      </div>
      <input
        type="search"
        aria-label="Search sounds"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search sounds…"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
      />
      {tab === "catalog" ? (
        <>
          <CompactSelect
            aria-label="Sound category"
            value={category}
            onValueChange={setCategory}
            options={[
              { value: "all", label: "All categories" },
              ...categories.map(value => ({ value, label: value })),
            ]}
            className="w-full"
          />
          <p className="text-[11px] leading-relaxed text-foreground/50">
            Free to use · no AI credits
          </p>
          <div className="space-y-2">
            {entries.map(entry => {
              const saved = workspace.assets.some(
                a => a.variantGroupId === `builtin-audio:${entry.id}`
              );
              return (
                <article
                  key={entry.id}
                  className="rounded-lg border border-border bg-background/40 p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`${playing === entry.id ? "Pause" : "Preview"} ${entry.name}`}
                      onClick={() => preview(entry)}
                      className="rounded-full border border-primary/25 p-2 text-primary"
                    >
                      {playing === entry.id ? (
                        <Pause size={13} />
                      ) : (
                        <Play size={13} />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-xs font-medium"
                        title={entry.name}
                      >
                        {entry.name}
                      </p>
                      <p className="text-[11px] text-foreground/50">
                        {entry.category} · {entry.duration.toFixed(1)}s
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!!saving || saved || !capabilities.uploads}
                      onClick={() => void save(entry)}
                      aria-label={
                        saved
                          ? `${entry.name} saved to Library`
                          : `Save ${entry.name} to Library`
                      }
                      title={saved ? "Saved to Library" : "Save to Library"}
                      className="rounded-lg p-2 text-primary disabled:opacity-40"
                    >
                      {saving === entry.id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : saved ? (
                        <Check size={15} />
                      ) : (
                        <Download size={15} />
                      )}
                    </button>
                  </div>
                  <details className="mt-1 text-[10px] text-foreground/40">
                    <summary className="cursor-pointer">
                      Source & license
                    </summary>
                    <p className="mt-1">
                      {entry.author} · {entry.license} ·{" "}
                      <a
                        href={entry.source}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Source
                      </a>
                    </p>
                  </details>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          {files.map(asset => (
            <div key={asset.id} className="rounded-lg border border-border p-2">
              <LibraryAssetCard
                asset={asset}
                view="list"
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
          ))}
          {!files.length && (
            <p className="py-4 text-center text-xs text-foreground/50">
              Save a free sound, upload audio, or generate a new track.
            </p>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="text-xs leading-relaxed text-foreground/65">
          {message}
        </p>
      )}
    </section>
  );
}
