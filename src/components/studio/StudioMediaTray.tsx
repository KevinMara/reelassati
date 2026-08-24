import { useMemo, useState } from "react";
import {
  Film,
  Image as ImageIcon,
  Library,
  Music2,
  Scissors,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useWorkspace } from "@/providers/workspace";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function StudioMediaTray() {
  const { workspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const recentMedia = useMemo(
    () =>
      workspace.assets
        .filter(
          asset =>
            asset.kind === "video" ||
            asset.kind === "image" ||
            asset.kind === "audio"
        )
        .slice(0, 6),
    [workspace.assets]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group hidden h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs text-foreground/55 transition-all hover:-translate-y-px hover:border-primary/30 hover:text-foreground sm:flex"
          aria-label="Open connected media tray"
        >
          <Library className="h-3.5 w-3.5 text-primary" />
          Media
          {recentMedia.length ? (
            <span className="flex min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-primary">
              {recentMedia.length}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[340px] p-3">
        <div className="mb-3 flex items-start justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-semibold">Connected media</p>
            <p className="mt-0.5 text-[10px] text-foreground/45">
              Recent uploads and generations, ready for Edit.
            </p>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Synced
          </span>
        </div>

        {recentMedia.length ? (
          <div className="space-y-1.5">
            {recentMedia.map(asset => {
              const Icon =
                asset.kind === "image"
                  ? ImageIcon
                  : asset.kind === "audio"
                    ? Music2
                    : Film;
              return (
                <Link
                  key={asset.id}
                  to={`/dashboard/edit?asset=${encodeURIComponent(asset.id)}`}
                  onClick={() => setOpen(false)}
                  className="group flex min-w-0 items-center gap-3 rounded-lg border border-transparent p-2 transition-all hover:border-primary/20 hover:bg-primary/[0.05]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
                    {asset.kind === "image" ? (
                      <img
                        src={asset.url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Icon className="h-4 w-4 text-primary" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {asset.name}
                    </span>
                    <span className="mt-0.5 block text-[10px] capitalize text-foreground/40">
                      {asset.kind} · use in Edit
                    </span>
                  </span>
                  <Scissors className="h-3.5 w-3.5 text-foreground/25 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
            <p className="text-xs font-medium">No media yet</p>
            <p className="mt-1 text-[10px] text-foreground/45">
              Upload or generate something and it will appear here.
            </p>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
          <Link
            to="/dashboard/library"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-border px-3 py-2 text-center text-[11px] font-medium hover:border-primary/30"
          >
            Full library
          </Link>
          <Link
            to="/dashboard/edit"
            onClick={() => setOpen(false)}
            className="rounded-lg bg-primary px-3 py-2 text-center text-[11px] font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Open Edit
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
