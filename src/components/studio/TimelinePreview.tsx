import { useUiText } from "@/lib/i18n/ui";
import { colorGradeMatrix, colorToneTable } from "@/lib/color-grade";
import { normalizeVisual, patchVisual, visualFrame } from "@contracts/clip-visual";
import { CaptionLayer } from "./CaptionLayer";
import { compareTimelineLayers } from "@/lib/timeline-lanes";
import { useEffect, useId, useRef, useState } from "react";
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
  onSelectClip,
  onTransform,
}: {
  project: EditProject;
  assets: Asset[];
  time: number;
  playing: boolean;
  zoom?: number;
  pan?: { x: number; y: number };
  selectedClipId?: string | null;
  onSelectClip?(id: string): void;
  onTransform?(id: string, dx: number, dy: number): Promise<void>;
}) {
  const ui = useUiText();
  const [moving, setMoving] = useState<{
    id: string;
    dx: number;
    dy: number;
  }>();
  const [dragError, setDragError] = useState("");
  const active = effectiveTimelineClips(project)
    .filter(
      c =>
        c.start <= time &&
        c.start + c.duration > time &&
        c.track !== "captions" &&
        !(c.graphic && c.hidden)
    )
    .sort(compareTimelineLayers);
  return (
    <div
      className="relative mx-auto w-full overflow-hidden bg-black"
      onPointerDown={event => {
        if (!onSelectClip || !onTransform) return;
        event.stopPropagation();
        const chosen =
          active.find(c => c.id === selectedClipId && c.track !== "audio") ??
          [...active].reverse().find(c => c.track !== "audio");
        if (!chosen) return;
        onSelectClip(chosen.id);
        if (chosen.locked) return;
        const element = event.currentTarget;
        const rect = element.getBoundingClientRect();
        const origin = { x: event.clientX, y: event.clientY };
        element.setPointerCapture(event.pointerId);
        let delta = { dx: 0, dy: 0 };
        const move = (e: globalThis.PointerEvent) => {
          delta = {
            dx: ((e.clientX - origin.x) / rect.width) * 100,
            dy: ((e.clientY - origin.y) / rect.height) * 100,
          };
          setMoving({ id: chosen.id, ...delta });
        };
        const stop = () => {
          element.removeEventListener("pointermove", move);
          element.removeEventListener("pointerup", stop);
          element.removeEventListener("pointercancel", cancel);
          if (Math.abs(delta.dx) + Math.abs(delta.dy) > 0.1)
            void onTransform(chosen.id, delta.dx, delta.dy)
              .catch(() => setDragError(ui("Could not save the position.")))
              .finally(() => setMoving(undefined));
          else setMoving(undefined);
        };
        const cancel = () => {
          delta = { dx: 0, dy: 0 };
          stop();
        };
        element.addEventListener("pointermove", move);
        element.addEventListener("pointerup", stop, { once: true });
        element.addEventListener("pointercancel", cancel, { once: true });
      }}
      style={{
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        pointerEvents: onSelectClip ? "auto" : "none",
        aspectRatio: project.aspectRatio.replace(":", "/"),
        ...{
          "--preview-aspect":
            Number(project.aspectRatio.split(":")[0]) /
            Number(project.aspectRatio.split(":")[1]),
        },
        containerType: "inline-size",
        isolation: "isolate",
        maxHeight: "100%",
        maxWidth:
          project.aspectRatio === "9:16"
            ? "min(100%, calc((var(--editor-upper, 540px) - 110px) * 9 / 16))"
            : project.aspectRatio === "1:1"
              ? "434px"
              : "100%",
      }}
    >
      {active.map(original => {
        let c = original;
        if (moving?.id === c.id)
          c = c.graphic
            ? {
                ...c,
                graphic: {
                  ...c.graphic,
                  x: c.graphic.x + moving.dx,
                  y: c.graphic.y + moving.dy,
                },
              }
            : {
                ...c,
                visual: patchVisual(c, {
                  x: normalizeVisual(c.visual).x + moving.dx,
                  y: normalizeVisual(c.visual).y + moving.dy,
                }),
              };
        if (c.graphic)
          return <MotionGraphicLayer key={c.id} clip={c} time={time} />;
        const asset = assets.find(a => a.id === c.assetId);
        return asset ? (
          <MediaLayer
            key={c.id}
            clip={c}
            asset={asset}
            time={time}
            playing={playing}
            trackGain={timelineTrackGain(project, c)}
          />
        ) : null;
      })}
      {onSelectClip && active.some(c => c.id === selectedClipId) && (
        <span
          className="pointer-events-none absolute inset-0 z-30 rounded-sm border-2 border-primary/80"
          aria-hidden="true"
        >
          <i className="absolute -left-1 -top-1 size-2 bg-primary" />
          <i className="absolute -right-1 -bottom-1 size-2 bg-primary" />
        </span>
      )}
      {dragError && (
        <p
          role="alert"
          className="absolute bottom-2 z-40 rounded bg-black/80 p-2 text-xs text-white"
        >
          {dragError}
        </p>
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
    </div>
  );
}
