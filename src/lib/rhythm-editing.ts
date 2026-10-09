import type { EditProject, TimelineClip } from "@contracts/workspace";
import {
  normalizeVisual,
  visualPose,
  type VisualKeyframe,
} from "@contracts/clip-visual";
import { normalizeTranscriptWords } from "@contracts/transcript-timing";
import { captionOwner } from "@contracts/caption-ownership";
import { expandLinkedSelection } from "@contracts/clip-groups";
import { assertNoShotTransition } from "@contracts/adjacent-transition";
import { clipLaneKind } from "./timeline-lanes";
import { splitClipGroup, replaceTimelineClip } from "./editor-manual";
import type { TimelineWaveform } from "./timeline-media";

export interface MeasuredBeat {
  sourceTime: number;
  strength: number;
}

/** Percussive onset measurement, not an invented tempo grid or downbeat guess.
 * The waveform retains either channel, including opposite-phase stereo. */
export function measuredAudioBeats(
  waveform: TimelineWaveform,
  sensitivity = 1
): MeasuredBeat[] {
  const { peaks, duration } = waveform;
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > 300 ||
    peaks.length > 18000 ||
    !Number.isFinite(sensitivity) ||
    sensitivity < 0.5 ||
    sensitivity > 2
  )
    throw new Error(
      "Beat measurement needs bounded, decoded audio and valid sensitivity."
    );
  if (peaks.length < 3) return [];
  const dt = duration / peaks.length;
  const energy = Array.from(peaks, p =>
    Number.isFinite(p) ? Math.min(1, Math.max(0, p)) ** 2 : 0
  );
  const novelty = energy.map((p, i) => Math.max(0, p - (energy[i - 1] ?? p)));
  const radius = Math.max(2, Math.round(0.35 / dt));
  const candidates: MeasuredBeat[] = [];
  for (let i = 1; i < novelty.length - 1; i++) {
    const p = novelty[i];
    if (p < 0.0001 || p < novelty[i - 1] || p <= novelty[i + 1]) continue;
    const neighborhood = novelty.slice(
      Math.max(0, i - radius),
      Math.min(novelty.length, i + radius + 1)
    );
    const mean = neighborhood.reduce((a, b) => a + b, 0) / neighborhood.length;
    const threshold = Math.max(0.0001, (mean * 2.5) / sensitivity);
    if (p <= threshold) continue;
    const beat = {
      sourceTime: i * dt,
      strength: Math.min(1, (p - threshold) / Math.max(p, 1e-9)),
    };
    const previous = candidates[candidates.length - 1];
    if (previous && beat.sourceTime - previous.sourceTime < 0.16) {
      if (beat.strength > previous.strength)
        candidates[candidates.length - 1] = beat;
    } else candidates.push(beat);
  }
  return candidates.slice(0, 1800);
}

export function timelineBeatCuts(
  beats: MeasuredBeat[],
  source: TimelineClip,
  projectDuration: number,
  every = 1,
  minimumGap = 0.4
) {
  if (
    !Number.isInteger(every) ||
    every < 1 ||
    every > 8 ||
    !Number.isFinite(minimumGap) ||
    minimumGap < 0.2 ||
    minimumGap > 10
  )
    throw new Error("Choose valid beat spacing.");
  if (
    ![
      source.start,
      source.inPoint,
      source.outPoint,
      source.speed ?? 1,
      projectDuration,
    ].every(Number.isFinite) ||
    (source.speed ?? 1) < 0.25 ||
    (source.speed ?? 1) > 4
  )
    throw new Error("The beat source has invalid timing.");
  const audible = beats
    .filter(
      b =>
        Number.isFinite(b.sourceTime) &&
        b.sourceTime >= source.inPoint &&
        b.sourceTime < source.outPoint
    )
    .sort((a, b) => a.sourceTime - b.sourceTime);
  const times: number[] = [];
  audible.forEach((b, i) => {
    if (i % every) return;
    const t =
      source.start + (b.sourceTime - source.inPoint) / (source.speed ?? 1);
    if (
      t > 0 &&
      t < projectDuration &&
      (!times.length || t - times[times.length - 1] >= minimumGap)
    )
      times.push(t);
  });
  return times;
}

/** A measured result must never overwrite edits made while decoding. */
export const rhythmProjectIdentity = (project: EditProject) =>
  JSON.stringify({
    id: project.id,
    duration: project.duration,
    clips: project.clips,
    transcript: project.transcript,
  });

/** Explicit picture targets; linked AV is listed and split at identical source clocks.
 * All validation occurs before returning a project; an error changes no state. */
export function cutSelectedOnBeats(
  project: EditProject,
  ids: string[],
  times: number[],
  makeId: () => string
): EditProject {
  if (
    !ids.length ||
    new Set(ids).size !== ids.length ||
    ids.some(
      id =>
        !project.clips.some(
          c => c.id === id && clipLaneKind(c) === "video" && !c.graphic
        )
    )
  )
    throw new Error("Select the picture clips to cut.");
  if (
    !times.length ||
    times.length > 48 ||
    times.some(t => !Number.isFinite(t) || t <= 0 || t >= project.duration)
  )
    throw new Error(
      "Choose between one and 48 measured cut points inside the project."
    );
  const targets = expandLinkedSelection(project, ids, {
    groups: false,
    links: true,
  });
  if (project.clips.some(c => targets.includes(c.id) && c.locked))
    throw new Error(
      "Unlock the selected picture clips and their linked audio before cutting."
    );
  assertNoShotTransition(project, targets);
  if (project.clips.length + times.length * targets.length > 500)
    throw new Error(
      "This beat cut would exceed 500 timeline clips. Use fewer beats or targets."
    );
  let next = project;
  let made = false;
  for (const time of [...new Set(times)].sort((a, b) => b - a)) {
    const crossing = targets.filter(id =>
      next.clips.some(
        c =>
          c.id === id &&
          time > c.start + 0.001 &&
          time < c.start + c.duration - 0.001
      )
    );
    if (!crossing.length) continue;
    next = splitClipGroup(next, crossing, time, makeId).project;
    made = true;
  }
  if (!made)
    throw new Error(
      "No measured beats fall inside the selected picture clips."
    );
  return next;
}

/** Alternating restrained punch-ins follow measured phrase starts; no face/camera tracking is implied. */
export function speechAutoZoom(
  project: EditProject,
  ids: string[],
  amount = 1.12,
  replacePath = false
): EditProject {
  if (
    !Number.isFinite(amount) ||
    amount < 1.02 ||
    amount > 1.4 ||
    !ids.length ||
    new Set(ids).size !== ids.length
  )
    throw new Error("Choose picture clips and a zoom between 1.02 and 1.4.");
  assertNoShotTransition(project, ids);
  const replacements = ids.map(id => {
    const clip = project.clips.find(c => c.id === id);
    if (!clip || clip.locked || clipLaneKind(clip) !== "video" || clip.graphic)
      throw new Error("Select unlocked picture clips for speech zoom.");
    const visual = normalizeVisual(clip.visual);
    if (visual.keyframes.length && !replacePath)
      throw new Error(
        "This selection already has motion. Enable Replace existing motion to use speech zoom."
      );
    const words = project.transcript
      .filter(s => {
        const owner = captionOwner(project, s);
        return (
          owner?.id === id ||
          Boolean(clip.linkId && owner?.linkId === clip.linkId)
        );
      })
      .flatMap(s => normalizeTranscriptWords(s.text, s.words) ?? [])
      .filter(w => w.start >= clip.start && w.end <= clip.start + clip.duration)
      .sort((a, b) => a.start - b.start);
    if (!words.length)
      throw new Error(
        "Speech zoom requires measured words belonging to each selected picture clip. Transcribe first."
      );
    const boundaries: number[] = [];
    let phraseStart = words[0].start;
    for (let i = 1; i < words.length; i++) {
      if (
        (words[i].start - words[i - 1].end >= 0.28 ||
          words[i].start - phraseStart >= 4) &&
        words[i].start - phraseStart >= 1.2
      ) {
        boundaries.push(words[i].start);
        phraseStart = words[i].start;
      }
    }
    if (!boundaries.length)
      throw new Error(
        "This speech has no measured phrase changes. Use Slow push for a continuous zoom."
      );
    if (boundaries.length > 11)
      throw new Error(
        "Speech zoom supports up to 11 phrase changes per clip. Split this clip first."
      );
    const span = clip.outPoint - clip.inPoint;
    const pose = visualPose(visual, 0);
    if (!Number.isFinite(span) || span <= 0 || pose.scale * amount > 4)
      throw new Error(
        "The selected clip cannot fit this zoom within its source or scale bounds."
      );
    const keys: VisualKeyframe[] = [{ ...pose, at: 0, easing: "hold" }];
    let scale = pose.scale;
    boundaries.forEach((t, i) => {
      const local = (t - clip.start) / clip.duration;
      keys.push({
        ...pose,
        scale,
        at: Math.max(
          0,
          local - Math.min(0.18, (t - clip.start) / 2) / clip.duration
        ),
        easing: "ease-in-out",
      });
      scale = pose.scale * (i % 2 === 0 ? amount : 1);
      keys.push({ ...pose, scale, at: local, easing: "hold" });
    });
    keys.push({ ...pose, scale, at: 1, easing: "hold" });
    return {
      ...clip,
      visual: normalizeVisual({ ...visual, keyframes: keys }),
      visualStart: clip.inPoint,
      visualDuration: span,
    };
  });
  return replacements.reduce(
    (p, c) => replaceTimelineClip(p, c.id, c),
    project
  );
}
