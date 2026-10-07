import type { TimelineClip } from "./workspace";

export interface AudioGainKey {
  /** Seconds in the original media, independent of the clip's timeline position. */
  at: number;
  gain: number;
}
export interface ClipAudioMix {
  pan: number;
  /** Linear gain multipliers, with the first/last value held outside the keys. */
  gainKeys: AudioGainKey[];
}
export const MAX_AUDIO_GAIN_KEYS = 64;
const bounded = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;

export function normalizeAudioMix(value?: unknown): ClipAudioMix {
  const mix =
    value && typeof value === "object" ? (value as Partial<ClipAudioMix>) : {};
  const keys = new Map<number, AudioGainKey>();
  if (Array.isArray(mix.gainKeys)) {
    for (const key of mix.gainKeys.slice(0, MAX_AUDIO_GAIN_KEYS)) {
      if (!key || typeof key !== "object" || !Number.isFinite(key.at)) continue;
      const at = Number(bounded(key.at, 0, 0, 86400).toFixed(6));
      keys.set(at, { at, gain: bounded(key.gain, 1, 0, 2) });
    }
  }
  return {
    pan: bounded(mix.pan, 0, -1, 1),
    gainKeys: [...keys.values()].sort((a, b) => a.at - b.at),
  };
}

/** Accept the project's historical percent volume convention without changing it. */
export function audioBaseVolume(clip: TimelineClip) {
  const raw = clip.volume ?? 1;
  return bounded(raw > 2 ? raw / 100 : raw, 1, 0, 2);
}

export function audioEnvelopeAt(mix: ClipAudioMix, sourceTime: number) {
  const keys = mix.gainKeys;
  if (!keys.length) return 1;
  if (sourceTime <= keys[0].at) return keys[0].gain;
  for (let i = 1; i < keys.length; i++) {
    if (sourceTime < keys[i].at) {
      const a = keys[i - 1],
        b = keys[i];
      const progress = (sourceTime - a.at) / (b.at - a.at);
      return a.gain + (b.gain - a.gain) * progress;
    }
  }
  return keys[keys.length - 1].gain;
}

function fadeDurations(clip: TimelineClip) {
  const duration = Math.max(0, clip.duration);
  return {
    fadeIn: bounded(clip.fadeIn, 0, 0, duration),
    fadeOut: bounded(clip.fadeOut, 0, 0, duration),
  };
}

/** Full audible gain. Keys stay on the source clock through trims/splits/speed edits. */
export function audioMixAt(
  clip: TimelineClip,
  timelineTime: number,
  trackGain = 1
) {
  return audioMixFrame(
    clip,
    timelineTime,
    trackGain,
    normalizeAudioMix(clip.audioMix)
  );
}

function audioMixFrame(
  clip: TimelineClip,
  timelineTime: number,
  trackGain: number,
  mix: ClipAudioMix
) {
  const elapsed = timelineTime - clip.start;
  const sourceTime = clip.inPoint + elapsed * (clip.speed ?? 1);
  const envelope = audioEnvelopeAt(mix, sourceTime);
  const { fadeIn, fadeOut } = fadeDurations(clip);
  const fade =
    (fadeIn ? bounded(elapsed / fadeIn, 0, 0, 1) : 1) *
    (fadeOut ? bounded((clip.duration - elapsed) / fadeOut, 0, 0, 1) : 1);
  return {
    sourceTime,
    envelope,
    pan: mix.pan,
    gain:
      clip.muted || elapsed < 0 || elapsed >= clip.duration
        ? 0
        : audioBaseVolume(clip) * bounded(trackGain, 1, 0, 2) * envelope * fade,
  };
}

/** Short AudioParam lookahead, with exact envelope/fade corners between samples. */
export function audioMixAutomation(
  clip: TimelineClip,
  timelineTime: number,
  trackGain = 1,
  horizon = 0.12
) {
  if (timelineTime >= clip.start + clip.duration || horizon <= 0) return [];
  const end = Math.min(clip.start + clip.duration, timelineTime + horizon);
  const mix = normalizeAudioMix(clip.audioMix);
  const moments = new Set<number>([timelineTime, end]);
  for (let i = 1; i < 24; i++)
    moments.add(timelineTime + ((end - timelineTime) * i) / 24);
  const { fadeIn, fadeOut } = fadeDurations(clip);
  for (const corner of [
    clip.start + fadeIn,
    clip.start + clip.duration - fadeOut,
    ...mix.gainKeys.map(
      key => clip.start + (key.at - clip.inPoint) / (clip.speed ?? 1)
    ),
  ])
    if (corner > timelineTime && corner < end) moments.add(corner);
  return [...moments]
    .sort((a, b) => a - b)
    .map(time => ({
      after: time - timelineTime,
      gain: audioMixFrame(
        clip,
        Math.min(time, clip.start + clip.duration - 1e-9),
        trackGain,
        mix
      ).gain,
    }));
}

/** W3C StereoPanner's mono/stereo equal-power law, also used by native tests. */
export function audioPanSample(
  left: number,
  right: number | undefined,
  pan: number
) {
  const p = bounded(pan, 0, -1, 1);
  if (right === undefined) {
    const angle = ((p + 1) * Math.PI) / 4;
    return [left * Math.cos(angle), left * Math.sin(angle)] as const;
  }
  const angle = ((p <= 0 ? p + 1 : p) * Math.PI) / 2;
  return p <= 0
    ? ([left + right * Math.cos(angle), right * Math.sin(angle)] as const)
    : ([left * Math.cos(angle), right + left * Math.sin(angle)] as const);
}

const number = (n: number) => String(Number(n.toFixed(9)));

/**
 * Place after atrim, asetpts and atempo, before adelay. `t` is then clip-local
 * output seconds; every gain sample evaluates the same original-source clock.
 * aeval's mono/stereo branch matches Web Audio without treating mono as stereo.
 */
export function audioMixFilter(clip: TimelineClip, trackGain = 1) {
  const mix = normalizeAudioMix(clip.audioMix);
  const source = `(${number(clip.inPoint)}+t*${number(clip.speed ?? 1)})`;
  let envelope = "1";
  if (mix.gainKeys.length) {
    const allKeys = mix.gainKeys;
    const firstIn = allKeys.findIndex(key => key.at >= clip.inPoint);
    const afterOut = allKeys.findIndex(
      key => key.at > clip.inPoint + clip.duration * (clip.speed ?? 1)
    );
    // Keep interpolation neighbours; off-trim keys remain saved on the clip.
    const keys = allKeys.slice(
      firstIn < 0 ? allKeys.length - 1 : Math.max(0, firstIn - 1),
      afterOut < 0 ? undefined : afterOut + 1
    );
    envelope = number(keys[keys.length - 1].gain);
    for (let i = keys.length - 1; i > 0; i--) {
      const a = keys[i - 1],
        b = keys[i];
      const lerp = `${number(a.gain)}+(${number(b.gain - a.gain)})*clip((${source}-${number(a.at)})/${number(b.at - a.at)},0,1)`;
      envelope = `if(lt(${source},${number(b.at)}),${lerp},${envelope})`;
    }
  }
  const { fadeIn, fadeOut } = fadeDurations(clip);
  const base = clip.muted
    ? 0
    : audioBaseVolume(clip) * bounded(trackGain, 1, 0, 2);
  const gain = [
    number(base),
    `(${envelope})`,
    ...(fadeIn ? [`clip(t/${number(fadeIn)},0,1)`] : []),
    ...(fadeOut
      ? [`clip((${number(clip.duration)}-t)/${number(fadeOut)},0,1)`]
      : []),
  ].join("*");
  const monoAngle = ((mix.pan + 1) * Math.PI) / 4;
  const angle = ((mix.pan <= 0 ? mix.pan + 1 : mix.pan) * Math.PI) / 2;
  const stereoLeft =
    mix.pan <= 0
      ? `val(0)+val(1)*${number(Math.cos(angle))}`
      : `val(0)*${number(Math.cos(angle))}`;
  const stereoRight =
    mix.pan <= 0
      ? `val(1)*${number(Math.sin(angle))}`
      : `val(1)+val(0)*${number(Math.sin(angle))}`;
  const left = `if(eq(nb_in_channels,1),val(0)*${number(Math.cos(monoAngle))},${stereoLeft})*(${gain})`;
  const right = `if(eq(nb_in_channels,1),val(0)*${number(Math.sin(monoAngle))},${stereoRight})*(${gain})`;
  return `aformat=channel_layouts=mono|stereo,aeval='${left}|${right}':c=stereo`;
}
