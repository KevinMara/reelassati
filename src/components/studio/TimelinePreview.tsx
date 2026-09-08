import { useEffect, useRef } from "react";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";

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
      media.volume = Math.min(1, Math.max(0, volume * fade));
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
    filter: `brightness(${1 + (clip.brightness ?? 0)}) contrast(${clip.contrast ?? 1}) saturate(${clip.saturation ?? 1})`,
  } as const;
  if (asset.kind === "audio" || clip.track === "audio")
    return (
      <audio
        ref={el => {
          ref.current = el;
        }}
        src={asset.url}
        preload="auto"
      />
    );
  if (asset.kind === "image")
    return (
      <img
        src={asset.url}
        alt={asset.name}
        className="absolute inset-0 h-full w-full bg-black"
        style={style}
      />
    );
  return (
    <video
      ref={el => {
        ref.current = el;
      }}
      src={asset.url}
      playsInline
      preload="auto"
      aria-label={asset.name}
      className="absolute inset-0 h-full w-full bg-black"
      style={style}
    >
      <track kind="captions" />
    </video>
  );
}

export function TimelinePreview({
  project,
  assets,
  time,
  playing,
}: {
  project: EditProject;
  assets: Asset[];
  time: number;
  playing: boolean;
}) {
  const active = project.clips
    .filter(
      c =>
        c.start <= time && c.start + c.duration > time && c.track !== "captions"
    )
    .sort(
      (a, b) => Number(a.track === "overlay") - Number(b.track === "overlay")
    );
  const caption = project.transcript
    .filter(s => s.start <= time && s.end > time)
    .map(s => s.text)
    .join(" ");
  return (
    <div
      className="relative mx-auto w-full overflow-hidden bg-black"
      style={{
        aspectRatio: project.aspectRatio.replace(":", "/"),
        maxHeight: "65vh",
        maxWidth:
          project.aspectRatio === "9:16"
            ? "360px"
            : project.aspectRatio === "1:1"
              ? "560px"
              : "100%",
      }}
    >
      {active.map(c => {
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
      {caption && (
        <div className="pointer-events-none absolute inset-x-[8%] bottom-[14%] text-center text-lg font-bold leading-tight text-white [text-shadow:0_2px_3px_black,1px_0_black,-1px_0_black]">
          {caption}
        </div>
      )}
    </div>
  );
}
