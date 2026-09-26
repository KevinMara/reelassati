import { colorGradeMatrix } from "@/lib/color-grade";
import { CaptionLayer } from "./CaptionLayer";
import { compareTimelineLayers } from "@/lib/timeline-lanes";
import { useEffect, useId, useRef } from "react";
import { MotionGraphicLayer } from "./MotionGraphicLayer";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";

let previewAudioContext: AudioContext | undefined;

function MediaLayer({
  clip,
  asset,
  time,
  playing,
}: {
  clip: TimelineClip;
  asset: Asset;
  time: number;
  playing: boolean;
}) {
  const ref = useRef<HTMLMediaElement | null>(null);
  const gainRef = useRef<
    { source: MediaElementAudioSourceNode; gain: GainNode } | undefined
  >(undefined);
  const gradeId = useId().replace(/:/g, "");
  useEffect(() => {
    const nodes = gainRef.current;
    if (nodes && previewAudioContext) {
      nodes.source.connect(nodes.gain);
      nodes.gain.connect(previewAudioContext.destination);
    }
    return () => {
      gainRef.current?.source.disconnect();
      gainRef.current?.gain.disconnect();
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
      const volume =
        (clip.volume ?? 1) > 2
          ? (clip.volume ?? 100) / 100
          : (clip.volume ?? 1);
      const fade = Math.max(
        0,
        Math.min(
          1,
          clip.fadeIn ? (time - clip.start) / clip.fadeIn : 1,
          clip.fadeOut ? (clip.start + clip.duration - time) / clip.fadeOut : 1
        )
      );
      if (playing && !gainRef.current && typeof AudioContext !== "undefined") {
        try {
          previewAudioContext ??= new AudioContext();
          const source = previewAudioContext.createMediaElementSource(media);
          const gain = previewAudioContext.createGain();
          source.connect(gain);
          gain.connect(previewAudioContext.destination);
          gainRef.current = { source, gain };
        } catch {
          /* Keep native playback when Web Audio is unavailable. */
        }
      }
      if (gainRef.current) {
        media.volume = 1;
        gainRef.current.gain.gain.value = Math.max(0, volume * fade);
        if (playing) void previewAudioContext?.resume().catch(() => undefined);
      } else media.volume = Math.min(1, Math.max(0, volume * fade));
      media.muted = !!clip.muted;
      if (playing) void media.play().catch(() => undefined);
      else media.pause();
    };
    sync();
    media.addEventListener("loadedmetadata", sync);
    return () => media.removeEventListener("loadedmetadata", sync);
  }, [clip, time, playing]);
  const opacity = Math.min(
    1,
    clip.fadeIn ? elapsed / clip.fadeIn : 1,
    clip.fadeOut ? (clip.duration - elapsed) / clip.fadeOut : 1
  );
  const style = {
    objectFit: clip.fit ?? "contain",
    opacity: Math.max(0, opacity),
    filter: `url(#${gradeId})`,
  } as const;
  const grade = (
    <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0">
      <defs>
        <filter id={gradeId} colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values={colorGradeMatrix(clip).join(" ")}
          />
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
        <img
          src={asset.url}
          alt={asset.name}
          className="absolute inset-0 h-full w-full"
          style={style}
        />
      </>
    );
  return (
    <>
      {grade}
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
}: {
  project: EditProject;
  assets: Asset[];
  time: number;
  playing: boolean;
  zoom?: number;
  pan?: { x: number; y: number };
}) {
  const active = project.clips
    .filter(
      c =>
        c.start <= time && c.start + c.duration > time && c.track !== "captions"
    )
    .sort(compareTimelineLayers);
  return (
    <div
      className="relative mx-auto w-full overflow-hidden bg-black"
      style={{
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        pointerEvents: "none",
        aspectRatio: project.aspectRatio.replace(":", "/"),
        containerType: "inline-size",
        maxHeight: "100%",
        maxWidth:
          project.aspectRatio === "9:16"
            ? "min(360px, calc(434px * 9 / 16))"
            : project.aspectRatio === "1:1"
              ? "434px"
              : "100%",
      }}
    >
      {active.map(c => {
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
          />
        ) : null;
      })}
      {!active.length && (
        <p className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-white/50">
          {project.clips.length
            ? "No media at this time"
            : "Add footage from your Library or upload it below"}
        </p>
      )}
      <CaptionLayer
        segments={project.transcript}
        presetId={project.captionStyle}
        appearance={project.captionAppearance}
        time={time}
      />
    </div>
  );
}
