import { Magnet } from "lucide-react";
import {
  observePreviewReadiness,
  type PreviewReadiness,
} from "@/lib/preview-buffering";
import { useUiText } from "@/lib/i18n/ui";
import { colorGradeMatrix, colorToneTable } from "@/lib/color-grade";
import { normalizeClipColorLut } from "@contracts/color-lut";
import { LutPreview } from "./LutPreview";
import { visualFrame } from "@contracts/clip-visual";
import { graphicSelectionBounds } from "@contracts/graphic-selection";
import { CaptionLayer } from "./CaptionLayer";
import { compareTimelineLayers } from "@/lib/timeline-lanes";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
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
import {
  createPreviewMediaTransport,
  previewMediaAt,
  previewMediaRuns,
  previewSourceTime,
  previewEvaluationTime,
} from "@/lib/preview-media";

let previewAudioContext: AudioContext | undefined;

function MediaLayer({
  clip,
  asset,
  time,
  playing,
  active,
  seekVersion,
  trackGain = 1,
  waitingForMedia = false,
}: {
  clip: TimelineClip;
  asset: Asset;
  time: number;
  playing: boolean;
  active: boolean;
  seekVersion: number;
  trackGain?: number;
  waitingForMedia?: boolean;
}) {
  const ref = useRef<HTMLMediaElement | null>(null);
  const pictureRef = useRef<HTMLVideoElement | HTMLImageElement | null>(null);
  const [lutReady, setLutReady] = useState(false);
  const colorLut = normalizeClipColorLut(clip.colorLut);
  const previousSeek = useRef(seekVersion);
  const transportRef = useRef<
    ReturnType<typeof createPreviewMediaTransport> | undefined
  >(undefined);
  const gainRef = useRef<
    | {
        source: MediaElementAudioSourceNode;
        gain: GainNode;
        pan: StereoPannerNode;
      }
    | undefined
  >(undefined);
  const gradeId = useId().replace(/:/g, "");
  useLayoutEffect(() => {
    const media = ref.current;
    if (media) transportRef.current = createPreviewMediaTransport(media);
    const nodes = gainRef.current;
    if (nodes && previewAudioContext) {
      nodes.source.connect(nodes.gain);
      nodes.gain.connect(nodes.pan);
      nodes.pan.connect(previewAudioContext.destination);
    }
    return () => {
      transportRef.current?.dispose();
      transportRef.current = undefined;
      gainRef.current?.source.disconnect();
      gainRef.current?.gain.disconnect();
      gainRef.current?.pan.disconnect();
    };
  }, []);
  const elapsed = time - clip.start;
  useLayoutEffect(() => {
    const media = ref.current;
    if (!media) return;
    const forceSeek = previousSeek.current !== seekVersion;
    previousSeek.current = seekVersion;
    const sync = () => {
      // Let the waiting decoder fill its queue. Pausing it at HAVE_CURRENT_DATA
      // can prevent canplay from arriving. Other ready tracks wait silently.
      const advance =
        playing &&
        !media.error &&
        (!waitingForMedia || media.readyState < 3 || media.seeking);
      const sourceTime = previewSourceTime(clip, time);
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
      media.muted = !active || !!clip.muted || waitingForMedia;
      transportRef.current?.sync(
        sourceTime,
        clip.speed ?? 1,
        advance,
        forceSeek
      );
    };
    sync();
    media.addEventListener("loadedmetadata", sync);
    return () => media.removeEventListener("loadedmetadata", sync);
  }, [
    clip,
    time,
    playing,
    active,
    seekVersion,
    trackGain,
    asset.url,
    waitingForMedia,
  ]);
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
        visibility: !active || clip.hidden ? "hidden" : undefined,
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
  const lut =
    colorLut && colorLut.amount > 0 ? (
      <LutPreview
        key={colorLut.sha256}
        sourceRef={pictureRef}
        reference={colorLut}
        playing={playing}
        active={active}
        style={style}
        onReady={setLutReady}
      />
    ) : null;
  if (asset.kind === "audio" || clip.track === "audio")
    return (
      <audio
        data-preview-clip={clip.id}
        data-preview-state={active ? "active" : "preload"}
        crossOrigin="anonymous"
        ref={el => {
          ref.current = el;
        }}
        src={asset.url}
        muted={!active || !!clip.muted}
        preload="auto"
      />
    );
  if (asset.kind === "image")
    return (
      <>
        {grade}
        {wrap(
          <>
            <img
              data-preview-asset={asset.id}
              data-preview-clip={clip.id}
              data-preview-state={active ? "active" : "preload"}
              src={asset.url}
              crossOrigin={colorLut ? "anonymous" : undefined}
              ref={element => {
                pictureRef.current = element;
              }}
              alt={asset.name}
              className="absolute inset-0 h-full w-full"
              style={{
                ...style,
                visibility: lut && lutReady ? "hidden" : undefined,
              }}
            />
            {lut}
          </>
        )}
      </>
    );
  return (
    <>
      {grade}
      {wrap(
        <>
          <video
            data-preview-asset={asset.id}
            data-preview-clip={clip.id}
            data-preview-state={active ? "active" : "preload"}
            crossOrigin="anonymous"
            ref={el => {
              ref.current = el;
              pictureRef.current = el;
            }}
            src={asset.url}
            muted={!active || !!clip.muted}
            playsInline
            preload="auto"
            aria-label={asset.name}
            className="absolute inset-0 h-full w-full"
            style={{
              ...style,
              visibility: lut && lutReady ? "hidden" : undefined,
            }}
          >
            <track kind="captions" />
          </video>
          {lut}
        </>
      )}
    </>
  );
}

export function TimelinePreview({
  project,
  assets,
  time: requestedTime,
  playing,
  seekVersion = 0,
  zoom = 1,
  pan = { x: 0, y: 0 },
  selectedClipId,
  selectedClipIds,
  onTransformMany,
  onSelectClip,
  onTransform,
  onInspectClip,
  onClipAction,
  onBufferingChange,
}: {
  project: EditProject;
  assets: Asset[];
  time: number;
  playing: boolean;
  onBufferingChange?(blocked: boolean): void;
  seekVersion?: number;
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
  const time = previewEvaluationTime(
    requestedTime,
    project.duration,
    project.frameRate
  );
  const ui = useUiText();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [readiness, setReadiness] = useState<PreviewReadiness>("loading");
  const playbackIntent = useRef(playing);
  playbackIntent.current = playing;
  const readinessObserver = useRef<
    ReturnType<typeof observePreviewReadiness> | undefined
  >(undefined);
  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    const observer = observePreviewReadiness(
      canvasRef.current,
      (state, paused) => {
        setReadiness(current => (current === state ? current : state));
        onBufferingChange?.(
          state !== "ready" || (playbackIntent.current && paused)
        );
      }
    );
    readinessObserver.current = observer;
    return () => {
      observer.dispose();
      readinessObserver.current = undefined;
    };
  }, [project.id, onBufferingChange]);
  // Run after the child transports cue newly active sources, including source jumps.
  useLayoutEffect(() => {
    readinessObserver.current?.refresh();
  });
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
  const effectiveClips = useMemo(
    () => effectiveTimelineClips(project),
    [project]
  );
  const mediaRuns = useMemo(
    () => previewMediaRuns(effectiveClips),
    [effectiveClips]
  );
  const active = effectiveClips
    .filter(
      c =>
        c.start <= time &&
        c.start + c.duration > time &&
        c.track !== "captions" &&
        !(c.graphic && c.hidden)
    )
    .sort(compareTimelineLayers);
  const order = new Map(effectiveClips.map((clip, index) => [clip.id, index]));
  const previewLayers = [
    ...previewMediaAt(mediaRuns, time),
    ...active
      .filter(clip => clip.graphic)
      .map(clip => ({
        key: clip.id,
        clip,
        active: true,
      })),
  ].sort(
    (a, b) =>
      compareTimelineLayers(a.clip, b.clip) ||
      order.get(a.clip.id)! - order.get(b.clip.id)!
  );
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
          className={`absolute left-2 top-2 z-40 flex h-8 w-8 items-center justify-center rounded-lg border text-[11px] font-medium shadow-sm transition-colors ${magnetic ? "border-primary/60 bg-primary/20 text-primary ring-1 ring-primary/15" : "border-border bg-background/90 text-muted-foreground"}`}
        >
          <Magnet size={15} aria-hidden="true" />
        </button>
      )}

      <ContextMenuTrigger asChild disabled={!onSelectClip}>
        <div
          ref={canvasRef}
          data-preview-canvas
          data-preview-readiness={readiness}
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
          {previewLayers.map(({ key, clip: original, active: mediaActive }) => {
            const clip = displayed(original);
            if (clip.graphic)
              return (
                <MotionGraphicLayer key={clip.id} clip={clip} time={time} />
              );
            const asset = assets.find(a => a.id === clip.assetId);
            return asset ? (
              <MediaLayer
                key={`${project.id}:${key}:${asset.url}:${asset.kind}`}
                clip={clip}
                asset={asset}
                time={mediaActive ? time : clip.start}
                playing={playing && mediaActive}
                waitingForMedia={readiness !== "ready"}
                active={mediaActive}
                seekVersion={seekVersion}
                trackGain={timelineTrackGain(project, clip)}
              />
            ) : null;
          })}
          {readiness !== "ready" && (playing || readiness === "error") && (
            <div
              role="status"
              className="absolute inset-0 z-40 flex items-center justify-center bg-black/20"
            >
              <div className="rounded-lg border border-white/10 bg-black/80 px-3 py-2 text-center text-xs text-white/90">
                {readiness === "loading"
                  ? ui("Loading preview…")
                  : ui("Preview couldn't load.")}
                {readiness === "error" && (
                  <button
                    type="button"
                    className="pointer-events-auto ml-2 text-primary underline"
                    onPointerDown={event => event.stopPropagation()}
                    onClick={() => {
                      canvasRef.current
                        ?.querySelectorAll<HTMLMediaElement>("video,audio")
                        .forEach(media => {
                          if (media.error) media.load();
                        });
                      canvasRef.current
                        ?.querySelectorAll<HTMLImageElement>("img")
                        .forEach(image => {
                          if (image.complete && !image.naturalWidth)
                            image.src = image.src;
                        });
                      readinessObserver.current?.refresh();
                    }}
                  >
                    {ui("Retry")}
                  </button>
                )}
              </div>
            </div>
          )}
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
