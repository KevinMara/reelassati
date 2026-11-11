import type { TimelineClip } from "@contracts/workspace";
import { clipLaneKind, clipLaneNumber } from "@contracts/timeline-layers";

const EPSILON = 0.000001;
const PRELOAD_SECONDS = 2;
const PRELOAD_RUNS_PER_LANE = 2;

/** Clip intervals are end-exclusive. At the project endpoint, retain its final
 * sample instead of unmounting the picture. Only evaluation is nudged; genuine
 * gaps (including trailing gaps) still have no active media at that sample. */
export function previewEvaluationTime(
  time: number,
  duration: number,
  frameRate = 30
) {
  const frame = 1 / Math.max(1, Number.isFinite(frameRate) ? frameRate : 30);
  return duration > 0 && time >= duration && time <= duration + frame + EPSILON
    ? Math.max(0, duration - Math.min(EPSILON, duration / 2))
    : time;
}

export interface PreviewMediaRun {
  key: string;
  lane: string;
  clips: TimelineClip[];
}

const laneKey = (clip: TimelineClip) =>
  `${clipLaneKind(clip)}:${clipLaneNumber(clip)}`;

/** A split changes editorial properties, but need not replace a running decoder. */
export function continuousPreviewMedia(a: TimelineClip, b: TimelineClip) {
  return (
    !!a.assetId &&
    a.assetId === b.assetId &&
    laneKey(a) === laneKey(b) &&
    Math.abs(a.start + a.duration - b.start) <= EPSILON &&
    Math.abs(a.inPoint + a.duration * (a.speed ?? 1) - b.inPoint) <= EPSILON
  );
}

export function previewMediaRuns(clips: TimelineClip[]): PreviewMediaRun[] {
  const runs: PreviewMediaRun[] = [];
  const latest = new Map<string, PreviewMediaRun>();
  for (const clip of [...clips].sort((a, b) => a.start - b.start)) {
    if (clip.graphic || clip.track === "captions" || !clip.assetId) continue;
    const lane = laneKey(clip);
    const source = JSON.stringify([lane, clip.assetId]);
    const previous = latest.get(source);
    if (
      previous &&
      continuousPreviewMedia(previous.clips[previous.clips.length - 1], clip)
    ) {
      previous.clips.push(clip);
    } else {
      const run = { key: clip.id, lane, clips: [clip] };
      runs.push(run);
      latest.set(source, run);
    }
  }
  return runs;
}

/** Keep active decoders and a bounded, paused preroll for upcoming source jumps. */
export function previewMediaAt(runs: PreviewMediaRun[], time: number) {
  const upcoming = new Map<string, number>();
  return runs.flatMap(run => {
    const active = run.clips.find(
      clip => clip.start <= time && clip.start + clip.duration > time
    );
    if (active) return [{ key: run.key, clip: active, active: true }];
    const first = run.clips[0];
    if (first.start <= time || first.start > time + PRELOAD_SECONDS) return [];
    const count = upcoming.get(run.lane) ?? 0;
    if (count >= PRELOAD_RUNS_PER_LANE) return [];
    upcoming.set(run.lane, count + 1);
    return [{ key: run.key, clip: first, active: false }];
  });
}

export function previewSourceTime(clip: TimelineClip, time: number) {
  return (
    clip.inPoint +
    Math.max(0, Math.min(clip.duration, time - clip.start)) * (clip.speed ?? 1)
  );
}

type PreviewMedia = Pick<
  HTMLMediaElement,
  | "currentTime"
  | "readyState"
  | "playbackRate"
  | "paused"
  | "seeking"
  | "play"
  | "pause"
>;

/** Transport lifetime matches the media element, including unresolved play requests. */
export function createPreviewMediaTransport(media: PreviewMedia) {
  let pendingPlay: Promise<void> | undefined;
  return {
    sync(
      sourceTime: number,
      speed: number,
      playing: boolean,
      forceSeek = false
    ) {
      // A new/paused player must be cued precisely before starting. Avoid throwing
      // on a not-yet-loaded source, or repeatedly restarting a decoder's seek.
      const tolerance = forceSeek || !playing || media.paused ? 0.015 : 0.25;
      if (
        media.readyState >= 1 &&
        (!media.seeking || !playing || forceSeek) &&
        Math.abs(media.currentTime - sourceTime) > tolerance
      )
        media.currentTime = sourceTime;
      media.playbackRate = speed;
      if (!playing) {
        if (!media.paused || pendingPlay) media.pause();
        pendingPlay = undefined;
      } else if (media.readyState >= 1 && media.paused && !pendingPlay) {
        const request = media.play();
        pendingPlay = request;
        void request
          .catch(() => undefined)
          .finally(() => {
            if (pendingPlay === request) pendingPlay = undefined;
          });
      }
    },
    dispose() {
      media.pause();
      pendingPlay = undefined;
    },
  };
}
