import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { findVoice } from "../../../contracts/voices";
import { platformApi } from "@/lib/platform-api";

// URLs are signed. Keep only a short-lived browser cache; the server caches the
// generated sample itself, so listening again does not generate another sample.
const sampleCache = new Map<string, { url: string; until: number }>();
const pendingSamples = new Map<string, Promise<{ url: string }>>();
async function getSample(voice: string): Promise<{ url: string }> {
  const cached = sampleCache.get(voice);
  if (cached && cached.until > Date.now()) return cached;
  const pending = pendingSamples.get(voice);
  if (pending) return pending;
  const request = platformApi
    .voicePreview(voice)
    .then(result => {
      sampleCache.set(voice, { ...result, until: Date.now() + 60_000 });
      return result;
    })
    .finally(() => pendingSamples.delete(voice));
  pendingSamples.set(voice, request);
  return request;
}

function sampleTime(seconds: number): string {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function VoicePreviewPlayer({
  voice,
  disabled = false,
}: {
  voice: string;
  disabled?: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const requestVersion = useRef({ value: 0 });
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [error, setError] = useState("");
  const name = findVoice(voice)?.name || "Selected voice";

  useEffect(() => {
    const player = audio.current;
    const request = requestVersion.current;
    return () => {
      request.value++;
      player?.pause();
    };
  }, []);

  async function toggleSample() {
    const player = audio.current;
    if (!player || busy) return;
    if (!player.paused) {
      player.pause();
      return;
    }
    const current = ++requestVersion.current.value;
    setError("");
    try {
      if (!url) {
        setBusy(true);
        const result = await getSample(voice);
        if (current !== requestVersion.current.value || !audio.current) return;
        setUrl(result.url);
        player.src = result.url;
      } else if (player.ended) {
        player.currentTime = 0;
      }
      await player.play();
    } catch (cause) {
      if (current !== requestVersion.current.value) return;
      // Some browsers require a second tap after an asynchronous URL lookup.
      if (!(
        cause instanceof DOMException && cause.name === "NotAllowedError"
      )) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Sample unavailable. Try again."
        );
      }
    } finally {
      if (current === requestVersion.current.value) setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-background/60 px-2.5 py-2">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => void toggleSample()}
          className="flex shrink-0 items-center gap-1.5 rounded-md text-xs font-medium text-primary outline-none hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          aria-label={`${playing ? "Pause" : "Listen to"} ${name} sample`}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : playing ? (
            <Pause className="size-3.5" aria-hidden="true" />
          ) : (
            <Play className="size-3.5" aria-hidden="true" />
          )}
          {busy
            ? "Preparing sample…"
            : playing
              ? "Pause sample"
              : "Listen to sample"}
        </button>
        {duration > 0 && !error ? (
          <>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.05}
              value={time}
              aria-label={`${name} sample playback position`}
              onChange={event => {
                const next = Number(event.target.value);
                if (audio.current) audio.current.currentTime = next;
                setTime(next);
              }}
              className="h-1 min-w-4 flex-1 accent-primary"
            />
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {sampleTime(time)} / {sampleTime(duration)}
            </span>
          </>
        ) : (
          <span className="ml-auto text-[10px] text-muted-foreground">
            Voice sample
          </span>
        )}
      </div>
      <audio
        ref={audio}
        preload="none"
        aria-label={`${name} voice sample`}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={event =>
          setDuration(
            Number.isFinite(event.currentTarget.duration)
              ? event.currentTarget.duration
              : 0
          )
        }
        onTimeUpdate={event => setTime(event.currentTarget.currentTime)}
        onError={() => {
          sampleCache.delete(voice);
          setUrl("");
          setPlaying(false);
          setError("This sample could not play. Try loading it again.");
        }}
      />
      {error && (
        <div
          className="flex items-start gap-2 text-xs text-destructive"
          role="alert"
        >
          <span className="flex-1">{error}</span>
          <button
            type="button"
            disabled={busy || disabled}
            onClick={() => void toggleSample()}
            aria-label="Retry voice sample"
            className="shrink-0 rounded p-0.5 hover:bg-destructive/10"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function VoicePreview(props: { voice: string; disabled?: boolean }) {
  // Changing voices stops the previous player and discards any pending UI update.
  return <VoicePreviewPlayer key={props.voice} {...props} />;
}
