import { useUiText } from "@/lib/i18n/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Asset, TimelineClip } from "@contracts/workspace";
import {
  sourceTimeAtClipFraction,
  timelineThumbnails,
  timelineWaveform,
  waveformColumns,
  type TimelineThumbnail,
  type TimelineWaveform,
} from "@/lib/timeline-media";

type View = { width: number; left: number; right: number };
type Preview =
  | { key: string; kind: "waveform"; waveform: TimelineWaveform }
  | { key: string; kind: "frames"; frames: TimelineThumbnail[] }
  | { key: string; kind: "unavailable" };

/** Visible clips request real media only after scrolling/zooming has settled. */
export function TimelineMediaStrip({
  clip,
  asset,
}: {
  clip: TimelineClip;
  asset?: Asset;
}) {
  const ui = useUiText();
  const element = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<View | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const audio = clip.track === "audio";
  const source = useMemo(
    () => ({
      inPoint: clip.inPoint,
      duration: clip.duration,
      speed: clip.speed,
    }),
    [clip.inPoint, clip.duration, clip.speed]
  );
  // Asset arrays are rehydrated on workspace updates. Producer identity depends
  // on media fields so unrelated edits cannot starve a pending frame decode.
  const mediaAsset = useMemo<Asset>(
    () => ({
      id: asset?.id ?? "",
      name: asset?.name ?? "",
      kind: asset?.kind ?? "video",
      contentType: asset?.contentType ?? "",
      size: asset?.size ?? 0,
      duration: asset?.duration,
      url: asset?.url ?? "",
      status: asset?.status ?? "failed",
      createdAt: asset?.createdAt ?? "",
    }),
    [
      asset?.id,
      asset?.name,
      asset?.kind,
      asset?.contentType,
      asset?.size,
      asset?.duration,
      asset?.url,
      asset?.status,
      asset?.createdAt,
    ]
  );
  const eligible =
    mediaAsset.status === "ready" &&
    (audio ||
      mediaAsset.kind === "video" ||
      mediaAsset.kind === "image" ||
      mediaAsset.contentType.startsWith("video/"));

  useEffect(() => {
    const node = element.current;
    const scroll = node?.closest<HTMLElement>(".editor-timeline-scroll");
    if (!node || !scroll || !eligible) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let intersecting = false;
    const update = () => {
      const clipRect = node.getBoundingClientRect();
      const scrollRect = scroll.getBoundingClientRect();
      const width = clipRect.width;
      const rawLeft = Math.max(0, Math.max(0, scrollRect.left) - clipRect.left);
      const rawRight = Math.min(
        width,
        Math.min(window.innerWidth, scrollRect.right) - clipRect.left
      );
      const verticallyVisible =
        clipRect.bottom > Math.max(0, scrollRect.top) &&
        clipRect.top < Math.min(window.innerHeight, scrollRect.bottom);
      // Quantized viewport edges avoid restarting a decode for every pixel of scrolling.
      const next =
        intersecting &&
        width >= 72 &&
        rawRight - rawLeft >= 48 &&
        verticallyVisible
          ? {
              width,
              left: Math.max(0, Math.floor(rawLeft / 64) * 64),
              right: Math.min(width, Math.ceil(rawRight / 64) * 64),
            }
          : null;
      // Offscreen React state must release decoded previews too; a bounded shared
      // cache alone would leave one retained filmstrip per previously visited clip.
      if (!next) setPreview(previous => (previous ? null : previous));
      setView(previous =>
        previous?.width === next?.width &&
        previous?.left === next?.left &&
        previous?.right === next?.right
          ? previous
          : next
      );
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(update, 120);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(node);
    resize.observe(scroll);
    const intersection = new IntersectionObserver(
      entries => {
        intersecting = entries[0]?.isIntersecting ?? false;
        schedule();
      },
      { root: scroll }
    );
    intersection.observe(node);
    scroll.addEventListener("scroll", schedule, { passive: true });
    schedule();
    return () => {
      clearTimeout(timer);
      resize.disconnect();
      intersection.disconnect();
      scroll.removeEventListener("scroll", schedule);
    };
  }, [eligible, clip.start]);

  const key =
    eligible && view
      ? JSON.stringify([
          mediaAsset.id,
          mediaAsset.url,
          mediaAsset.size,
          mediaAsset.duration,
          mediaAsset.createdAt,
          audio,
          source,
          view,
        ])
      : "";
  useEffect(() => {
    if (!key || !view) return;
    const abort = new AbortController();
    if (audio) {
      void timelineWaveform(mediaAsset, abort.signal).then(
        waveform => {
          if (!abort.signal.aborted)
            setPreview({ key, kind: "waveform", waveform });
        },
        () => {
          if (!abort.signal.aborted) setPreview({ key, kind: "unavailable" });
        }
      );
    } else {
      const count = Math.max(
        1,
        Math.min(12, Math.ceil((view.right - view.left) / 70))
      );
      const times = Array.from({ length: count }, (_, i) =>
        sourceTimeAtClipFraction(
          source,
          (view.left + ((i + 0.5) * (view.right - view.left)) / count) /
            view.width
        )
      );
      void timelineThumbnails(mediaAsset, times, abort.signal).then(
        frames => {
          if (!abort.signal.aborted)
            setPreview({ key, kind: "frames", frames });
        },
        () => {
          if (!abort.signal.aborted) setPreview({ key, kind: "unavailable" });
        }
      );
    }
    return () => abort.abort();
  }, [key, view, mediaAsset, audio, source]);

  useEffect(() => {
    const node = canvas.current;
    if (!node || !view || preview?.key !== key || preview.kind !== "waveform")
      return;
    const width = Math.max(
      1,
      Math.min(1600, Math.ceil(view.right - view.left))
    );
    node.width = width;
    node.height = 24;
    const context = node.getContext("2d");
    if (!context) return;
    const columns = waveformColumns(
      preview.waveform,
      source,
      view.left / view.width,
      view.right / view.width,
      width
    );
    context.clearRect(0, 0, width, 24);
    context.fillStyle = "rgba(255,255,255,0.78)";
    for (let x = 0; x < columns.length; x++) {
      const height = columns[x] * 22;
      // A real silent sample stays silent; the center rule is drawn separately.
      if (height > 0) context.fillRect(x, (24 - height) / 2, 1, height);
    }
    context.fillStyle = "rgba(255,255,255,0.18)";
    context.fillRect(0, 12, width, 1);
  }, [key, preview, view, source]);

  const current = preview?.key === key ? preview : null;
  return (
    <span
      ref={element}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 top-5 overflow-hidden"
    >
      {current?.kind === "frames" && view && (
        <span
          className="absolute inset-y-0 flex opacity-65"
          style={{ left: view.left, width: view.right - view.left }}
        >
          {current.frames.map((frame, index) => (
            <img
              key={index}
              src={frame.url}
              alt=""
              draggable={false}
              className="h-full min-w-0 flex-1 object-cover"
              style={{ width: `${100 / current.frames.length}%` }}
            />
          ))}
        </span>
      )}
      {current?.kind === "waveform" && view && (
        <canvas
          ref={canvas}
          className="absolute bottom-0 h-6"
          style={{ left: view.left, width: view.right - view.left }}
        />
      )}
      {current?.kind === "unavailable" && (
        <span className="absolute bottom-0 right-1 max-w-full truncate text-[8px] font-normal text-white/60">
          {audio ? ui("Waveform unavailable") : ui("Filmstrip unavailable")}
        </span>
      )}
    </span>
  );
}
