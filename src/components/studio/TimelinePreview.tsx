import { Magnet } from "lucide-react";
import { useUiText } from "@/lib/i18n/ui";
import { colorGradeMatrix, colorToneTable } from "@/lib/color-grade";
import { visualFrame } from "@contracts/clip-visual";
import { graphicSelectionBounds } from "@contracts/graphic-selection";
import { CaptionLayer } from "./CaptionLayer";
import { compareTimelineLayers } from "@/lib/timeline-lanes";
import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  transformPreviewClip,
  mediaSelectionBounds,
  unionPreviewBounds,
  previewContains,
  snapPreviewMove,
  snapPreviewScale,
  type PreviewBounds,
  type PreviewTransform,
} from "@/lib/preview-transform";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { MotionGraphicLayer } from "./MotionGraphicLayer";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import { audioMixAt, audioMixAutomation } from "@contracts/audio-mix";
import {
  effectiveTimelineClips,
  timelineTrackGain,
} from "@contracts/timeline-mixer";

let previewAudioContext: AudioContext | undefined;

function MediaLayer({
  clip,
  asset,
  time,
  playing,
  trackGain = 1,
}: {
  clip: TimelineClip;
  asset: Asset;
  time: number;
  playing: boolean;
  trackGain?: number;
}) {
  const ref = useRef<HTMLMediaElement | null>(null);
  const gainRef = useRef<
    | {
        source: MediaElementAudioSourceNode;
        gain: GainNode;
        pan: StereoPannerNode;
      }
    | undefined
  >(undefined);
  const gradeId = useId().replace(/:/g, "");
  useEffect(() => {
    const media = ref.current;
    const nodes = gainRef.current;
    if (nodes && previewAudioContext) {
      nodes.source.connect(nodes.gain);
      nodes.gain.connect(nodes.pan);
      nodes.pan.connect(previewAudioContext.destination);
    }
    return () => {
      media?.pause();
      gainRef.current?.source.disconnect();
      gainRef.current?.gain.disconnect();
      gainRef.current?.pan.disconnect();
    };
  }, []);
  const elapsed = time - clip.start;
  useEffect(() => {
    const media = ref.current;
    if (!media) return;
    const sync = () => {
      const sourceTime =
        clip.inPoint + Math.max(0, time - clip.start) * (clip.speed ?? 1);
      if (Math.abs(media.currentTime - sourceTime) > (playing ? 0.25 : 0.015))
        media.currentTime = sourceTime;
      media.playbackRate = clip.speed ?? 1;
      const mix = audioMixAt(clip, time, trackGain);
      if (playing && !gainRef.current && typeof AudioContext !== "undefined") {
        try {
          previewAudioContext ??= new AudioContext();
          const pan = previewAudioContext.createStereoPanner();
          const gain = previewAudioContext.createGain();
          const source = previewAudioContext.createMediaElementSource(media);
          source.connect(gain);
          gain.connect(pan);
          pan.connect(previewAudioContext.destination);
          gainRef.current = { source, gain, pan };
        } catch {
          /* Keep native playback when Web Audio is unavailable. */
        }
      }
      if (gainRef.current && previewAudioContext) {
        media.volume = 1;
        const gain = gainRef.current.gain.gain;
        const now = previewAudioContext.currentTime;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(mix.gain, now);
        gainRef.current.pan.pan.setValueAtTime(mix.pan, now);
        if (playing)
          for (const point of audioMixAutomation(clip, time, trackGain).slice(
            1
          ))
            gain.linearRampToValueAtTime(point.gain, now + point.after);
        if (playing) void previewAudioContext?.resume().catch(() => undefined);
      } else media.volume = Math.min(1, mix.gain);
      media.muted = !!clip.muted;
      if (playing) void media.play().catch(() => undefined);
      else media.pause();
    };
    sync();
    media.addEventListener("loadedmetadata", sync);
    return () => media.removeEventListener("loadedmetadata", sync);
  }, [clip, time, playing, trackGain]);
  const opacity = Math.min(
    1,
    clip.fadeIn ? elapsed / clip.fadeIn : 1,
    clip.fadeOut ? (clip.duration - elapsed) / clip.fadeOut : 1
  );
  const frame = visualFrame(clip, time);
  const crop = frame.visual.crop;
  const style = {
    objectFit: clip.fit ?? "contain",
    filter: `url(#${gradeId})`,
  } as const;
  const transformStyle = {
    transform: `translate(${frame.x}%, ${frame.y}%) rotate(${frame.rotation}deg) scale(${frame.scale * (frame.visual.flipX ? -1 : 1)},${frame.scale * (frame.visual.flipY ? -1 : 1)})`,
    opacity: Math.max(0, opacity) * frame.opacity,
  };
  const maskStyle = {
    clipPath:
      frame.visual.mask === "ellipse"
        ? "ellipse(50% 50% at 50% 50%)"
        : frame.visual.mask === "rounded"
          ? `inset(0 round ${frame.visual.radius}%)`
          : frame.visual.mask === "polygon"
            ? `polygon(evenodd, ${frame.visual.polygon.map(p => `${p.x}% ${p.y}%`).join(", ")})`
            : undefined,
  };
  const revealStyle = {
    clipPath: `inset(${frame.reveal.top}% ${frame.reveal.right}% ${frame.reveal.bottom}% ${frame.reveal.left}%)`,
  };
  const wrap = (media: React.ReactNode) => (
    <div
      className="absolute inset-0"
      style={{
        ...revealStyle,
        visibility: clip.hidden ? "hidden" : undefined,
        mixBlendMode: frame.visual.blendMode,
      }}
    >
      <div className="absolute inset-0" style={transformStyle}>
        <div className="absolute inset-0" style={maskStyle}>
          <div
            className="absolute inset-0"
            style={{
              clipPath: `inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)`,
            }}
          >
            {media}
          </div>
        </div>
      </div>
    </div>
  );
  const grade = (
    <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0">
      <defs>
        <filter id={gradeId} colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values={colorGradeMatrix(clip).join(" ")}
          />
          <feComponentTransfer>
            <feFuncR
              type="table"
              tableValues={colorToneTable(clip).join(" ")}
            />
            <feFuncG
              type="table"
              tableValues={colorToneTable(clip).join(" ")}
            />
            <feFuncB
              type="table"
              tableValues={colorToneTable(clip).join(" ")}
            />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
  if (asset.kind === "audio" || clip.track === "audio")
    return (
      <audio
        crossOrigin="anonymous"
        ref={el => {
          ref.current = el;
        }}
        src={asset.url}
        preload="auto"
      />
    );
  if (asset.kind === "image")
    return (
      <>
        {grade}
        {wrap(
          <img
            data-preview-asset={asset.id}
            src={asset.url}
            alt={asset.name}
            className="absolute inset-0 h-full w-full"
            style={style}
          />
        )}
      </>
    );
  return (
    <>
      {grade}
      {wrap(
        <video
          data-preview-asset={asset.id}
          crossOrigin="anonymous"
          ref={el => {
            ref.current = el;
          }}
          src={asset.url}
          playsInline
          preload="auto"
          aria-label={asset.name}
          className="absolute inset-0 h-full w-full"
          style={style}
        >
          <track kind="captions" />
        </video>
      )}
    </>
  );
}

export function TimelinePreview({
  project,
  assets,
  time,
  playing,
  zoom = 1,
  pan = { x: 0, y: 0 },
  selectedClipId,
  selectedClipIds,
  onTransformMany,
  onSelectClip,
  onTransform,
  onInspectClip,
  onClipAction,
}: {
  project: EditProject;
  assets: Asset[];
  time: number;
  playing: boolean;
  zoom?: number;
  pan?: { x: number; y: number };
  selectedClipId?: string | null;
  selectedClipIds?: string[];
  onSelectClip?(id: string, additive?: boolean): void;
  onTransformMany?(
    changes: { id: string; change: PreviewTransform }[]
  ): Promise<void>;
  onTransform?(id: string, change: PreviewTransform): Promise<void>;
  onInspectClip?(id: string): void;
  onClipAction?(
    id: string,
    action: "fit" | "fill" | "flip" | "rotate" | "reset"
  ): Promise<void>;
}) {
  const ui = useUiText();
  const canvasRef = useRef<HTMLDivElement>(null);
  const stopGesture = useRef<(() => void) | undefined>(undefined);
  const [fit, setFit] = useState<{ width: number; height: number }>();
  const [moving, setMoving] =
    useState<{ id: string; base: TimelineClip; change: PreviewTransform }[]>();
  const [magnetic, setMagnetic] = useState(true);
  const [guides, setGuides] = useState<{ axis: "x" | "y"; at: number }[]>([]);
  const [dragError, setDragError] = useState("");
  const [mediaSizes, setMediaSizes] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const rememberMediaSize = (target: EventTarget) => {
    if (
      !(target instanceof HTMLVideoElement) &&
      !(target instanceof HTMLImageElement)
    )
      return;
    const id = target.dataset.previewAsset;
    const width =
      target instanceof HTMLVideoElement
        ? target.videoWidth
        : target.naturalWidth;
    const height =
      target instanceof HTMLVideoElement
        ? target.videoHeight
        : target.naturalHeight;
    if (id && width > 0 && height > 0)
      setMediaSizes(current =>
        current[id]?.width === width && current[id]?.height === height
          ? current
          : { ...current, [id]: { width, height } }
      );
  };
  const [aspectWidth, aspectHeight] = project.aspectRatio
    .split(":")
    .map(Number);
  const aspect = aspectWidth / aspectHeight;
  useLayoutEffect(() => {
    const parent = canvasRef.current?.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(entries => {
      const box = entries[0].contentRect;
      const width = Math.min(box.width, box.height * aspect);
      if (width > 0) setFit({ width, height: width / aspect });
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, [aspect]);
  useEffect(() => () => stopGesture.current?.(), []);
  const active = effectiveTimelineClips(project)
    .filter(
      c =>
        c.start <= time &&
        c.start + c.duration > time &&
        c.track !== "captions" &&
        !(c.graphic && c.hidden)
    )
    .sort(compareTimelineLayers);
  const selectionHeight = 1000 / aspect;
  const ids = selectedClipIds ?? (selectedClipId ? [selectedClipId] : []);
  const visible = active.filter(c => c.track !== "audio" && !c.hidden);
  const selectedItems = visible.filter(c => ids.includes(c.id));
  const selected =
    selectedItems.find(c => c.id === selectedClipId) ?? selectedItems[0];
  const displayed = (clip: TimelineClip) => {
    const pending = moving?.find(m => m.id === clip.id);
    return pending ? transformPreviewClip(pending.base, pending.change) : clip;
  };
  const bounds = (clip: TimelineClip): PreviewBounds | undefined => {
    const asset = assets.find(a => a.id === clip.assetId);
    const size =
      asset &&
      (mediaSizes[asset.id] ??
        (asset.width && asset.height
          ? { width: asset.width, height: asset.height }
          : undefined));
    return clip.graphic
      ? graphicSelectionBounds(clip, time, 1000, selectionHeight)
      : mediaSelectionBounds(clip, time, 1000, selectionHeight, size);
  };
  const selection = unionPreviewBounds(
    selectedItems
      .map(c => bounds(displayed(c)))
      .filter((b): b is PreviewBounds => !!b)
  );
  const canTransform =
    selectedItems.length > 0 && selectedItems.every(c => !c.locked);
  function begin(event: PointerEvent, resize = false) {
    if (
      event.button !== 0 ||
      event.altKey ||
      !onSelectClip ||
      !onTransform ||
      playing
    )
      return;
    const element = canvasRef.current!;
    const rect = element.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * 1000;
    const py = ((event.clientY - rect.top) / rect.height) * selectionHeight;
    const hit = [...visible].reverse().find(c => {
      const box = bounds(c);
      return box && previewContains(box, px, py);
    });
    const chosen = resize ? selected : hit;
    if (!chosen) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.shiftKey && !resize) {
      onSelectClip(chosen.id, true);
      return;
    }
    const group = ids.includes(chosen.id) ? selectedItems : [chosen];
    if (!ids.includes(chosen.id)) onSelectClip(chosen.id, false);
    if (group.some(c => c.locked)) return;
    const groupBounds = unionPreviewBounds(
      group.map(bounds).filter((b): b is PreviewBounds => !!b)
    );
    if (!groupBounds) return;
    const others = visible
      .filter(c => !group.some(g => g.id === c.id))
      .map(bounds)
      .filter((b): b is PreviewBounds => !!b);
    setDragError("");
    stopGesture.current?.();
    const origin = { x: event.clientX, y: event.clientY };
    const center = {
      x: groupBounds.x + groupBounds.width / 2,
      y: groupBounds.y + groupBounds.height / 2,
    };
    const screenCenter = {
      x: rect.left + (center.x / 1000) * rect.width,
      y: rect.top + (center.y / selectionHeight) * rect.height,
    };
    const radius = Math.max(
      12,
      Math.hypot(origin.x - screenCenter.x, origin.y - screenCenter.y)
    );
    element.setPointerCapture(event.pointerId);
    let changes: {
      id: string;
      base: TimelineClip;
      change: PreviewTransform;
    }[] = [];
    const move = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      let dx = ((e.clientX - origin.x) / rect.width) * 1000,
        dy = ((e.clientY - origin.y) / rect.height) * selectionHeight;
      let scale = 1;
      if (resize) {
        scale = Math.max(
          0.1,
          Math.min(
            4,
            Math.hypot(e.clientX - screenCenter.x, e.clientY - screenCenter.y) /
              radius
          )
        );
        if (magnetic)
          scale = snapPreviewScale(
            groupBounds,
            scale,
            others,
            1000,
            selectionHeight,
            (7 / rect.width) * 1000,
            (7 / rect.height) * selectionHeight
          );
        dx = 0;
        dy = 0;
      } else if (magnetic) {
        const snap = snapPreviewMove(
          groupBounds,
          dx,
          dy,
          others,
          1000,
          selectionHeight,
          (7 / rect.width) * 1000,
          (7 / rect.height) * selectionHeight
        );
        dx = snap.dx;
        dy = snap.dy;
        setGuides(snap.guides);
      }
      changes = group.map(base => {
        const b = bounds(base)!;
        return {
          id: base.id,
          base,
          change: {
            dx: (dx + (b.x + b.width / 2 - center.x) * (scale - 1)) / 10,
            dy:
              ((dy + (b.y + b.height / 2 - center.y) * (scale - 1)) /
                selectionHeight) *
              100,
            scale,
          },
        };
      });
      setMoving(changes);
    };
    const cleanup = () => {
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", finish);
      element.removeEventListener("pointercancel", cancel);
      element.removeEventListener("lostpointercapture", cancel);
      if (element.hasPointerCapture(event.pointerId))
        element.releasePointerCapture(event.pointerId);
      stopGesture.current = undefined;
      setGuides([]);
    };
    const cancel = () => {
      cleanup();
      setMoving(undefined);
    };
    const finish = () => {
      cleanup();
      if (!changes.length) {
        setMoving(undefined);
        return;
      }
      const save = onTransformMany
        ? onTransformMany(changes)
        : onTransform!(changes[0].id, changes[0].change);
      void save
        .catch(() => setDragError(ui("Could not save the position.")))
        .finally(() => setMoving(undefined));
    };
    stopGesture.current = cancel;
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", finish, { once: true });
    element.addEventListener("pointercancel", cancel, { once: true });
    element.addEventListener("lostpointercapture", cancel, { once: true });
  }
  const perform = (action: "fit" | "fill" | "flip" | "rotate" | "reset") => {
    if (selected && !selected.locked)
      void onClipAction?.(selected.id, action).catch(() =>
        setDragError(ui("Could not save the position."))
      );
  };
  return (
    <ContextMenu>
      {canTransform && !playing && onTransform && (
        <button
          type="button"
          aria-label={ui("Preview snapping")}
          aria-pressed={magnetic}
          title={ui("Snap to canvas, objects and spacing")}
          onClick={() => setMagnetic(v => !v)}
          className={`absolute left-2 top-2 z-40 flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium shadow-sm transition-colors ${magnetic ? "border-primary/60 bg-primary/20 text-primary ring-1 ring-primary/15" : "border-border bg-background/90 text-muted-foreground"}`}
        >
          <Magnet size={15} aria-hidden="true" />
          <span>{ui("Snap")}</span>
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${magnetic ? "bg-primary shadow-[0_0_6px_hsl(var(--primary))]" : "bg-muted-foreground/40"}`}
          />
        </button>
      )}

      <ContextMenuTrigger asChild disabled={!onSelectClip}>
        <div
          ref={canvasRef}
          data-preview-canvas
          onLoadCapture={event => rememberMediaSize(event.target)}
          onLoadedMetadataCapture={event => rememberMediaSize(event.target)}
          className="relative mx-auto shrink-0 overflow-hidden bg-black"
          onPointerDown={event => begin(event)}
          onDragStart={event => event.preventDefault()}
          onDoubleClick={() => selected && onInspectClip?.(selected.id)}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            pointerEvents: onSelectClip ? "auto" : "none",
            aspectRatio: aspect,
            width: fit?.width ?? "100%",
            height: fit?.height,
            maxWidth: "100%",
            maxHeight: "100%",
            containerType: "inline-size",
            isolation: "isolate",
            touchAction: "none",
          }}
        >
          {active.map(original => {
            const clip = displayed(original);
            if (clip.graphic)
              return (
                <MotionGraphicLayer key={clip.id} clip={clip} time={time} />
              );
            const asset = assets.find(a => a.id === clip.assetId);
            return asset ? (
              <MediaLayer
                key={clip.id}
                clip={clip}
                asset={asset}
                time={time}
                playing={playing}
                trackGain={timelineTrackGain(project, clip)}
              />
            ) : null;
          })}
          {!active.length && (
            <p className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-white/50">
              {project.clips.length
                ? ui("No media at this time")
                : ui("Add footage from your Library or upload it below")}
            </p>
          )}
          <CaptionLayer
            segments={project.transcript}
            presetId={project.captionStyle}
            appearance={project.captionAppearance}
            frameRate={project.frameRate}
            time={time}
          />
          {selection && !playing && onTransform && canTransform && (
            <>
              {(selected?.graphic || selectedItems.length > 1) && (
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-30 h-full w-full"
                  viewBox={`0 0 1000 ${selectionHeight}`}
                >
                  <rect
                    {...selection}
                    fill="none"
                    stroke="#d4d4d8"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              )}
              {[
                [0, 0],
                [1, 0],
                [0, 1],
                [1, 1],
              ].map(([x, y]) => (
                <button
                  key={`${x}-${y}`}
                  type="button"
                  aria-label={ui("Resize selected item")}
                  className="absolute z-30 h-3 w-3 bg-transparent"
                  style={{
                    left: `clamp(6px, ${(selection.x + x * selection.width) / 10}%, calc(100% - 6px))`,
                    top: `clamp(6px, ${((selection.y + y * selection.height) / selectionHeight) * 100}%, calc(100% - 6px))`,
                    transform: "translate(-50%, -50%)",
                    borderTop: y === 0 ? "2px solid white" : undefined,
                    borderBottom: y === 1 ? "2px solid white" : undefined,
                    borderLeft: x === 0 ? "2px solid white" : undefined,
                    borderRight: x === 1 ? "2px solid white" : undefined,
                    filter: "drop-shadow(0 1px 1px black)",
                    cursor: x === y ? "nwse-resize" : "nesw-resize",
                  }}
                  onPointerDown={event => begin(event, true)}
                  onKeyDown={event => {
                    if (
                      ["ArrowUp", "ArrowDown"].includes(event.key) &&
                      selected
                    ) {
                      event.preventDefault();
                      event.stopPropagation();
                      void onTransform(selected.id, {
                        scale: event.key === "ArrowUp" ? 1.05 : 1 / 1.05,
                      }).catch(() =>
                        setDragError(ui("Could not save the position."))
                      );
                    }
                  }}
                />
              ))}
            </>
          )}
          {guides.length > 0 && (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-30 h-full w-full"
              viewBox={`0 0 1000 ${selectionHeight}`}
            >
              {guides.map((g, i) => (
                <line
                  key={i}
                  x1={g.axis === "x" ? g.at : 0}
                  x2={g.axis === "x" ? g.at : 1000}
                  y1={g.axis === "y" ? g.at : 0}
                  y2={g.axis === "y" ? g.at : selectionHeight}
                  stroke="#a78bfa"
                  strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          )}
          {dragError && (
            <p
              role="alert"
              className="absolute bottom-2 z-40 rounded bg-black/80 p-2 text-xs text-white"
            >
              {dragError}
            </p>
          )}
        </div>
      </ContextMenuTrigger>
      {onSelectClip && (
        <ContextMenuContent>
          <ContextMenuItem
            disabled={!selected}
            onSelect={() => selected && onInspectClip?.(selected.id)}
          >
            {ui("Edit selected item")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            disabled={!selected || selected.locked}
            onSelect={() => perform("rotate")}
          >
            {ui("Rotate 90°")}
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!selected || selected.locked || !!selected.graphic}
            onSelect={() => perform("flip")}
          >
            {ui("Flip horizontal")}
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!selected || selected.locked || !!selected.graphic}
            onSelect={() => perform("fit")}
          >
            {ui("Fit")}
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!selected || selected.locked || !!selected.graphic}
            onSelect={() => perform("fill")}
          >
            {ui("Fill")}
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!selected || selected.locked}
            onSelect={() => perform("reset")}
          >
            {ui("Reset transform")}
          </ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}
