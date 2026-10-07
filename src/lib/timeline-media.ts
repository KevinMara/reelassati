import type { Asset, TimelineClip } from "@contracts/workspace";
import { readDecodedFrame } from "./region-tracking";

// Decorative timeline previews never launch a paid job or an unbounded decode.
export const TIMELINE_MEDIA_LIMITS = {
  audioBytes: 16 * 1024 * 1024,
  audioSeconds: 300,
  videoBytes: 64 * 1024 * 1024,
  videoSeconds: 1800,
  imageBytes: 12 * 1024 * 1024,
  sourcePixels: 4096 * 2160,
  thumbnailSide: 240,
  thumbnails: 12,
  waveformBins: 18000,
} as const;

export interface TimelineWaveform {
  /** Absolute linear amplitude, not an invented or normalized pattern. */
  peaks: Float32Array;
  duration: number;
}
export interface TimelineThumbnail {
  url: string;
  /** Decoder presentation time, rather than the requested seek time. */
  sourceTime: number;
}

export function sourceTimeAtClipFraction(
  clip: Pick<TimelineClip, "inPoint" | "duration" | "speed">,
  fraction: number
) {
  return (
    Math.max(0, clip.inPoint) +
    Math.max(0, clip.duration) *
      Math.max(0.001, clip.speed ?? 1) *
      Math.max(0, Math.min(1, fraction))
  );
}

/** Retain transients and either stereo channel, including opposite-phase audio. */
export function pcmWaveform(
  channels: readonly Float32Array[],
  sampleRate: number,
  maxBins = TIMELINE_MEDIA_LIMITS.waveformBins
): TimelineWaveform {
  const waveform = emptyPcmWaveform(channels, sampleRate, maxBins);
  for (const channel of channels)
    addPcmSamples(waveform.peaks, channel, 0, channel.length);
  return waveform;
}

function emptyPcmWaveform(
  channels: readonly Float32Array[],
  sampleRate: number,
  maxBins: number
): TimelineWaveform {
  if (
    !channels.length ||
    !Number.isFinite(sampleRate) ||
    sampleRate <= 0 ||
    channels.some(channel => channel.length !== channels[0].length) ||
    !Number.isFinite(maxBins) ||
    maxBins < 1
  )
    throw new Error("The decoded audio samples are invalid.");
  const length = channels[0].length;
  const duration = length / sampleRate;
  const count = Math.max(
    1,
    Math.min(maxBins, length, Math.ceil(duration * 60))
  );
  const peaks = new Float32Array(count);
  return { peaks, duration };
}

function addPcmSamples(
  peaks: Float32Array,
  channel: Float32Array,
  from: number,
  to: number
) {
  for (let i = from; i < to; i++) {
    const value = Math.abs(channel[i]);
    if (Number.isFinite(value)) {
      const bin = Math.min(
        peaks.length - 1,
        Math.floor((i * peaks.length) / channel.length)
      );
      peaks[bin] = Math.max(peaks[bin], Math.min(1, value));
    }
  }
}

async function decodedWaveform(audio: AudioBuffer, signal: AbortSignal) {
  const channels = Array.from({ length: audio.numberOfChannels }, (_, i) =>
    audio.getChannelData(i)
  );
  const waveform = emptyPcmWaveform(
    channels,
    audio.sampleRate,
    TIMELINE_MEDIA_LIMITS.waveformBins
  );
  for (const channel of channels)
    for (let from = 0; from < channel.length; from += 65536) {
      signal.throwIfAborted();
      addPcmSamples(
        waveform.peaks,
        channel,
        from,
        Math.min(channel.length, from + 65536)
      );
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  return waveform;
}

/** Draw only the visible source interval; trims and speed share the preview clock. */
export function waveformColumns(
  waveform: TimelineWaveform,
  clip: Pick<TimelineClip, "inPoint" | "duration" | "speed">,
  leftFraction: number,
  rightFraction: number,
  count: number
): Float32Array {
  const columns = new Float32Array(
    Math.max(0, Math.min(1600, Math.floor(count)))
  );
  if (!columns.length || !waveform.peaks.length || waveform.duration <= 0)
    return columns;
  const start = sourceTimeAtClipFraction(clip, leftFraction);
  const end = sourceTimeAtClipFraction(clip, rightFraction);
  for (let x = 0; x < columns.length; x++) {
    const from = start + ((end - start) * x) / columns.length;
    const to = start + ((end - start) * (x + 1)) / columns.length;
    if (to <= 0 || from >= waveform.duration) continue;
    const first = Math.max(
      0,
      Math.floor((from * waveform.peaks.length) / waveform.duration)
    );
    const last = Math.min(
      waveform.peaks.length,
      Math.max(
        first + 1,
        Math.ceil((to * waveform.peaks.length) / waveform.duration)
      )
    );
    for (let i = first; i < last; i++)
      columns[x] = Math.max(columns[x], waveform.peaks[i]);
  }
  return columns;
}

function abortError() {
  return new DOMException("Timeline preview cancelled", "AbortError");
}

interface CacheEntry<T> {
  promise: Promise<T>;
  controller: AbortController;
  users: number;
  settled: boolean;
  touched: number;
  bytes: number;
  failed: boolean;
}

/** In-memory only. Multiple visible clips share work; the last cancellation stops it. */
export class TimelineMediaCache<T> {
  private entries = new Map<string, CacheEntry<T>>();
  private readonly size: (value: T) => number;
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  constructor(
    size: (value: T) => number,
    maxEntries = 48,
    maxBytes = 8 * 1024 * 1024
  ) {
    this.size = size;
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
  }

  private prune() {
    let bytes = Array.from(this.entries.values()).reduce(
      (n, item) => n + item.bytes,
      0
    );
    const idle = Array.from(this.entries.entries())
      .filter(([, entry]) => entry.settled && entry.users === 0)
      .sort((a, b) => a[1].touched - b[1].touched);
    for (const [key, entry] of idle) {
      if (
        this.entries.size <= this.maxEntries &&
        bytes <= this.maxBytes &&
        Date.now() - entry.touched < (entry.failed ? 60_000 : 300_000)
      )
        continue;
      this.entries.delete(key);
      bytes -= entry.bytes;
    }
  }

  get(
    key: string,
    produce: (signal: AbortSignal) => Promise<T>,
    signal: AbortSignal
  ): Promise<T> {
    if (signal.aborted) return Promise.reject(abortError());
    this.prune();
    let entry = this.entries.get(key);
    if (
      entry &&
      (entry.controller.signal.aborted ||
        (entry.settled &&
          Date.now() - entry.touched >= (entry.failed ? 60_000 : 300_000)))
    ) {
      this.entries.delete(key);
      entry = undefined;
    }
    if (!entry) {
      const next: CacheEntry<T> = {
        promise: Promise.resolve(undefined as T),
        controller: new AbortController(),
        users: 0,
        settled: false,
        touched: Date.now(),
        bytes: 0,
        failed: false,
      };
      // Defer the producer until the subscribing caller has registered its abort listener.
      next.promise = Promise.resolve()
        .then(() => produce(next.controller.signal))
        .then(
          value => {
            next.bytes = this.size(value);
            return value;
          },
          error => {
            next.failed = true;
            throw error;
          }
        )
        .finally(() => {
          next.settled = true;
          this.prune();
        });
      entry = next;
      this.entries.set(key, entry);
    }
    const selected = entry;
    selected.users++;
    selected.touched = Date.now();
    return new Promise<T>((resolve, reject) => {
      let complete = false;
      const release = () => {
        if (complete) return false;
        complete = true;
        signal.removeEventListener("abort", cancel);
        selected.users--;
        selected.touched = Date.now();
        if (!selected.users && !selected.settled) selected.controller.abort();
        this.prune();
        return true;
      };
      const cancel = () => {
        if (release()) reject(abortError());
      };
      signal.addEventListener("abort", cancel, { once: true });
      selected.promise.then(
        value => {
          if (release()) resolve(value);
        },
        error => {
          if (release()) reject(error);
        }
      );
      if (signal.aborted) cancel();
    });
  }
}

const waveformCache = new TimelineMediaCache<TimelineWaveform>(
  wave => wave.peaks.byteLength,
  32,
  2 * 1024 * 1024
);
const thumbnailCache = new TimelineMediaCache<TimelineThumbnail[]>(frames =>
  frames.reduce((n, frame) => n + frame.url.length * 2, 0)
);
let running = 0;
const waiting: Array<() => void> = [];

async function limited<T>(
  signal: AbortSignal,
  task: () => Promise<T>
): Promise<T> {
  signal.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const start = () => {
      signal.removeEventListener("abort", cancel);
      running++;
      resolve();
    };
    const cancel = () => {
      const index = waiting.indexOf(start);
      if (index >= 0) waiting.splice(index, 1);
      reject(abortError());
    };
    if (running < 2) start();
    else if (waiting.length >= 48) reject(new Error("Preview queue is busy."));
    else {
      waiting.push(start);
      signal.addEventListener("abort", cancel, { once: true });
    }
  });
  try {
    signal.throwIfAborted();
    return await task();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

async function withDeadline<T>(
  signal: AbortSignal,
  milliseconds: number,
  task: (signal: AbortSignal) => Promise<T>
) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, milliseconds);
  if (signal.aborted) cancel();
  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
  }
}

function identity(asset: Asset) {
  return JSON.stringify([
    asset.id,
    asset.url,
    asset.size,
    asset.duration,
    asset.createdAt,
  ]);
}

function checkSize(asset: Asset, maximum: number) {
  if (!Number.isFinite(asset.size) || asset.size <= 0 || asset.size > maximum)
    throw new Error("This source exceeds the timeline preview size limit.");
}

async function boundedSource(
  asset: Asset,
  signal: AbortSignal,
  maximum: number = TIMELINE_MEDIA_LIMITS.audioBytes
): Promise<Blob> {
  checkSize(asset, maximum);
  // Prefer a signed preview URL, whose stream can be stopped before its byte budget.
  try {
    const response = await fetch(asset.url, { signal });
    if (!response.ok || !response.body)
      throw new Error("Source URL unavailable.");
    const declared = Number(response.headers.get("content-length"));
    if (declared > maximum) {
      await response.body.cancel();
      throw new Error("Source too large.");
    }
    const reader = response.body.getReader();
    const parts: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    try {
      for (;;) {
        signal.throwIfAborted();
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maximum) throw new Error("Source too large.");
        parts.push(new Uint8Array(value));
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    return new Blob(parts, { type: asset.contentType });
  } catch (error) {
    signal.throwIfAborted();
    // The owner-scoped API is used only for sources whose server metadata is bounded.
    if (error instanceof Error && error.message === "Source too large.")
      throw error;
    const { platformApi } = await import("./platform-api");
    const blob = await platformApi.downloadAssetBlob(asset.id, signal);
    if (!blob.size || blob.size > maximum) throw new Error("Source too large.");
    return blob;
  }
}

export function timelineWaveform(asset: Asset, signal: AbortSignal) {
  return waveformCache.get(
    identity(asset),
    shared =>
      limited(shared, async () => {
        checkSize(asset, TIMELINE_MEDIA_LIMITS.audioBytes);
        if (
          !Number.isFinite(asset.duration) ||
          asset.duration! <= 0 ||
          asset.duration! > TIMELINE_MEDIA_LIMITS.audioSeconds
        )
          throw new Error(
            "Waveforms support measured audio up to five minutes."
          );
        if (typeof AudioContext === "undefined")
          throw new Error("Audio decoding is unavailable.");
        const controller = new AbortController();
        const cancel = () => controller.abort();
        shared.addEventListener("abort", cancel, { once: true });
        const timeout = setTimeout(cancel, 25_000);
        let context: AudioContext | undefined;
        try {
          const blob = await boundedSource(asset, controller.signal);
          controller.signal.throwIfAborted();
          context = new AudioContext({ sampleRate: 8000 });
          if (context.sampleRate > 16000)
            throw new Error("Bounded audio decoding is unavailable.");
          const audio = await context.decodeAudioData(await blob.arrayBuffer());
          controller.signal.throwIfAborted();
          if (
            audio.duration > TIMELINE_MEDIA_LIMITS.audioSeconds ||
            audio.numberOfChannels > 2 ||
            audio.length > 16000 * TIMELINE_MEDIA_LIMITS.audioSeconds
          )
            throw new Error("The decoded source exceeds the waveform limit.");
          return await decodedWaveform(audio, controller.signal);
        } finally {
          clearTimeout(timeout);
          shared.removeEventListener("abort", cancel);
          await context?.close().catch(() => undefined);
        }
      }),
    signal
  );
}

function waitMedia(
  media: HTMLMediaElement | HTMLImageElement,
  event: "loadedmetadata" | "load",
  signal: AbortSignal,
  action: () => void
) {
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      media.removeEventListener(event, ready);
      media.removeEventListener("error", failed);
      signal.removeEventListener("abort", cancel);
      if (error) reject(error);
      else resolve();
    };
    const ready = () => finish();
    const failed = () =>
      finish(new Error("The source preview could not load."));
    const cancel = () => finish(abortError());
    const timeout = setTimeout(failed, 12_000);
    media.addEventListener(event, ready, { once: true });
    media.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
    else action();
  });
}

export function timelineThumbnails(
  asset: Asset,
  sourceTimes: readonly number[],
  signal: AbortSignal
) {
  const times = sourceTimes
    .slice(0, TIMELINE_MEDIA_LIMITS.thumbnails)
    .map(time => Math.round(time * 1000) / 1000);
  return thumbnailCache.get(
    `${identity(asset)}:${JSON.stringify(times)}`,
    outer =>
      limited(outer, () =>
        withDeadline(outer, 35_000, async shared => {
          const image = asset.kind === "image";
          checkSize(
            asset,
            image
              ? TIMELINE_MEDIA_LIMITS.imageBytes
              : TIMELINE_MEDIA_LIMITS.videoBytes
          );
          if (
            !image &&
            (!Number.isFinite(asset.duration) ||
              asset.duration! <= 0 ||
              asset.duration! > TIMELINE_MEDIA_LIMITS.videoSeconds)
          )
            throw new Error(
              "The footage duration exceeds the filmstrip limit."
            );
          const media = document.createElement(image ? "img" : "video");
          media.crossOrigin = "anonymous";
          let objectUrl = "";
          const video = media instanceof HTMLVideoElement ? media : undefined;
          if (video) {
            video.preload = "metadata";
            video.muted = true;
            video.playsInline = true;
            if (typeof video.requestVideoFrameCallback !== "function")
              throw new Error("Decoded video frames are unavailable.");
            video.setAttribute("aria-hidden", "true");
            Object.assign(video.style, {
              position: "fixed",
              width: "1px",
              height: "1px",
              left: "0",
              bottom: "0",
              opacity: "0",
              pointerEvents: "none",
            });
            document.body.appendChild(video);
          }
          try {
            const load = (url: string) =>
              waitMedia(
                media,
                image ? "load" : "loadedmetadata",
                shared,
                () => {
                  media.src = url;
                }
              );
            try {
              await load(asset.url);
            } catch {
              shared.throwIfAborted();
              // Smaller private sources can use the authenticated owner-scoped API fallback.
              const blob = await boundedSource(
                asset,
                shared,
                image
                  ? TIMELINE_MEDIA_LIMITS.imageBytes
                  : TIMELINE_MEDIA_LIMITS.audioBytes
              );
              objectUrl = URL.createObjectURL(blob);
              await load(objectUrl);
            }
            const width =
              video?.videoWidth ?? (media as HTMLImageElement).naturalWidth;
            const height =
              video?.videoHeight ?? (media as HTMLImageElement).naturalHeight;
            if (
              !width ||
              !height ||
              width * height > TIMELINE_MEDIA_LIMITS.sourcePixels
            )
              throw new Error(
                "The decoded picture exceeds the filmstrip limit."
              );
            if (
              video &&
              (!Number.isFinite(video.duration) ||
                times.some(time => time < 0 || time >= video.duration))
            )
              throw new Error(
                "The clip interval extends beyond the decoded source."
              );
            const scale = Math.min(
              1,
              TIMELINE_MEDIA_LIMITS.thumbnailSide / Math.max(width, height)
            );
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(width * scale));
            canvas.height = Math.max(1, Math.round(height * scale));
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Picture previews are unavailable.");
            const draw = () =>
              context.drawImage(media, 0, 0, canvas.width, canvas.height);
            const frames: TimelineThumbnail[] = [];
            for (const time of image ? [0] : times) {
              shared.throwIfAborted();
              let sourceTime = 0;
              if (video) {
                sourceTime = await readDecodedFrame(
                  video,
                  shared,
                  () => {
                    video.currentTime = time;
                  },
                  Math.abs(video.currentTime - time) > 0.0001,
                  draw
                );
                if (Math.abs(sourceTime - time) > 0.5)
                  throw new Error(
                    "The decoder did not present the requested source interval."
                  );
              } else draw();
              const url = canvas.toDataURL("image/jpeg", 0.6);
              if (url.length > 160_000)
                throw new Error("The picture preview exceeds its cache limit.");
              frames.push({ url, sourceTime });
            }
            return image ? times.map(() => frames[0]) : frames;
          } finally {
            video?.pause();
            media.removeAttribute("src");
            video?.load();
            video?.remove();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
          }
        })
      ),
    signal
  );
}
