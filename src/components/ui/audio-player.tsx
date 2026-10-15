import { useUiText } from "@/lib/i18n/ui";
import { useEffect, useRef, useState, type AudioHTMLAttributes } from "react";
import { Download, Loader2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

export function mediaTime(value: number) {
  const rounded = value > 0 && value < 10 ? Math.round(value * 10) / 10 : value;
  const seconds = Number.isFinite(rounded)
    ? Math.max(0, Math.floor(rounded))
    : 0;
  const fraction =
    value > 0 && value < 10 ? `.${Math.round((rounded % 1) * 10)}` : "";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}${fraction}`;
}

type AudioPlayerProps = AudioHTMLAttributes<HTMLAudioElement> & {
  downloadName?: string;
};
/** A new source owns a fresh clock, player and cancelable download. */
export function AudioPlayer(props: AudioPlayerProps) {
  return <SourceAudioPlayer key={props.src} {...props} />;
}

/** Shared source and Library player; its actual media clock drives every label. */
function SourceAudioPlayer({
  src,
  className,
  onLoadedMetadata,
  downloadName,
  ...props
}: AudioPlayerProps) {
  const ui = useUiText();
  const audio = useRef<HTMLAudioElement>(null);
  const downloadController = useRef<AbortController | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const player = audio.current;
    return () => {
      player?.pause();
      downloadController.current?.abort();
    };
  }, [src]);
  const label = props["aria-label"] || "Audio preview";
  const progress = duration > 0 ? (time / duration) * 100 : 0;
  async function download() {
    if (!src || downloading) return;
    const controller = new AbortController();
    downloadController.current = controller;
    setDownloading(true);
    setDownloadError("");
    try {
      const response = await fetch(src, { signal: controller.signal });
      if (!response.ok)
        throw new Error(
          ui(
            "Audio download is unavailable. Reload its Library link and try again."
          )
        );
      const blob = await response.blob();
      controller.signal.throwIfAborted();
      const extension = blob.type.includes("wav")
        ? "wav"
        : blob.type.includes("mp4")
          ? "m4a"
          : "mp3";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const name = downloadName || "REELassati audio";
      link.download = /\.[a-z0-9]{2,5}$/i.test(name)
        ? name
        : `${name}.${extension}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (cause) {
      if (!controller.signal.aborted)
        setDownloadError(
          cause instanceof Error ? cause.message : "Audio download failed."
        );
    } finally {
      if (!controller.signal.aborted) setDownloading(false);
    }
  }
  return (
    <div
      className={cn(
        "audio-player rounded-xl border border-border/80 bg-background/70 p-3",
        className
      )}
      role="group"
      aria-label={label}
    >
      <audio
        {...props}
        key={src}
        ref={audio}
        src={src}
        controls={false}
        preload="metadata"
        onLoadedMetadata={event => {
          setTime(0);
          setPlaying(false);
          setError("");
          setBusy(false);
          setDuration(
            Number.isFinite(event.currentTarget.duration)
              ? event.currentTarget.duration
              : 0
          );
          onLoadedMetadata?.(event);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={event => setTime(event.currentTarget.currentTime)}
        onWaiting={() => setBusy(true)}
        onCanPlay={() => setBusy(false)}
        onError={() => {
          setBusy(false);
          setPlaying(false);
          setError(ui("Audio could not load. Reload the source to try again."));
        }}
      />
      <div className="audio-player-controls flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label={ui(playing ? "Pause {{label}}" : "Play {{label}}", {
            label,
          })}
          disabled={!src || Boolean(error)}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary-hover disabled:opacity-40"
          onClick={() => {
            const player = audio.current;
            if (!player) return;
            if (playing) player.pause();
            else
              void player
                .play()
                .catch(() =>
                  setError(ui("Playback could not start. Try again."))
                );
          }}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : playing ? (
            <Pause className="size-4" />
          ) : (
            <Play className="ml-0.5 size-4" />
          )}
        </button>
        <span className="audio-player-clock w-24 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {mediaTime(time)} <span className="opacity-40">/</span>{" "}
          {mediaTime(duration)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.01}
          value={time}
          disabled={!duration}
          aria-label={ui("Seek {{label}}", { label })}
          style={{
            background: `linear-gradient(to right,hsl(var(--primary)) ${progress}%,hsl(var(--foreground)/.12) ${progress}%)`,
          }}
          className="audio-player-seek media-seek min-w-8 flex-1"
          onChange={event => {
            const next = Number(event.target.value);
            if (audio.current) audio.current.currentTime = next;
            setTime(next);
          }}
        />
        <button
          type="button"
          aria-label={muted ? ui("Unmute audio") : ui("Mute audio")}
          aria-pressed={muted}
          className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          onClick={() => {
            if (audio.current) audio.current.muted = !muted;
            setMuted(!muted);
          }}
        >
          {muted ? (
            <VolumeX className="size-4" />
          ) : (
            <Volume2 className="size-4" />
          )}
        </button>
        {src && (
          <button
            type="button"
            onClick={() => void download()}
            disabled={downloading}
            aria-label={ui("Download audio")}
            title={ui("Download audio")}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {downloadError && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {downloadError}
        </p>
      )}
    </div>
  );
}
