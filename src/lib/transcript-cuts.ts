import { captionOwner } from "@contracts/caption-ownership";
import { assertNoShotTransition } from "@contracts/adjacent-transition";
import { audioBaseVolume, audioMixAt } from "@contracts/audio-mix";
import {
  effectiveTimelineClips,
  timelineTrackGain,
} from "@contracts/timeline-mixer";
import {
  mapTranscriptTime,
  normalizeTranscriptWords,
} from "@contracts/transcript-timing";
import {
  buildStoryBeatEvidence,
  storyBeatsAreCurrent,
} from "@contracts/story-beats";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import { rippleRemove } from "./edit-timeline";

export interface TranscriptWordSelection {
  segmentId: string;
  wordIndex: number;
}
export interface TranscriptCutWord extends TranscriptWordSelection {
  text: string;
  start: number;
  end: number;
  sourceClipId: string;
  sourceStart: number;
  sourceEnd: number;
}
export interface TranscriptCutPlan {
  words: TranscriptCutWord[];
  intervals: Array<{ start: number; end: number }>;
  wordCount: number;
  removedDuration: number;
}

const EPSILON = 0.000001;
export const transcriptWordSelectionKey = (
  selection: TranscriptWordSelection
) => JSON.stringify([selection.segmentId, selection.wordIndex]);

function validSourceClip(clip: TimelineClip | undefined, assets: Asset[]) {
  if (
    !clip ||
    clip.graphic ||
    clip.transitionHandle ||
    !clip.assetId ||
    !["video", "audio", "overlay"].includes(clip.track) ||
    ![
      clip.start,
      clip.duration,
      clip.inPoint,
      clip.outPoint,
      clip.speed ?? 1,
    ].every(Number.isFinite) ||
    clip.start < 0 ||
    clip.duration <= 0 ||
    clip.inPoint < 0 ||
    (clip.speed ?? 1) <= 0 ||
    clip.outPoint <= clip.inPoint ||
    Math.abs(clip.inPoint + clip.duration * (clip.speed ?? 1) - clip.outPoint) >
      EPSILON
  )
    return false;
  const asset = assets.find(asset => asset.id === clip.assetId);
  return Boolean(
    asset &&
    (["video", "audio"].includes(asset.kind) ||
      (asset.kind === "export" &&
        asset.contentType.toLowerCase().startsWith("video/"))) &&
    asset.status === "ready" &&
    asset.url &&
    Number.isFinite(asset.duration) &&
    asset.duration! > 0 &&
    clip.outPoint <= asset.duration! + EPSILON
  );
}

function intervalIsAudible(
  project: EditProject,
  clip: TimelineClip,
  start: number,
  end: number
) {
  if (clip.muted || !audioBaseVolume(clip) || !timelineTrackGain(project, clip))
    return false;
  const corners =
    clip.audioMix?.gainKeys
      ?.map(key => clip.start + (key.at - clip.inPoint) / (clip.speed ?? 1))
      .filter(time => time > start && time < end) ?? [];
  return [
    start,
    (start + end) / 2,
    end - Math.min(EPSILON, (end - start) / 4),
    ...corners,
  ].some(
    time => audioMixAt(clip, time, timelineTrackGain(project, clip)).gain > 0
  );
}

/** List only complete measured words attached to real, audible source media.
 * Missing/mismatched word timing stays unavailable; cue duration is never divided
 * into guessed word spans. Legacy cues can use captionOwner's primary-source rule. */
export function getTranscriptCutWords(
  project: EditProject,
  assets: Asset[]
): TranscriptCutWord[] {
  if (!Number.isFinite(project.duration) || project.duration <= 0) return [];
  const effective = new Map(
    effectiveTimelineClips(project).map(clip => [clip.id, clip])
  );
  const duplicateCueIds = new Set(
    project.transcript
      .filter(
        (cue, index, all) =>
          all.findIndex(other => other.id === cue.id) !== index
      )
      .map(cue => cue.id)
  );
  const duplicateClipIds = new Set(
    project.clips
      .filter(
        (clip, index, all) =>
          all.findIndex(other => other.id === clip.id) !== index
      )
      .map(clip => clip.id)
  );
  return project.transcript.flatMap(segment => {
    if (
      duplicateCueIds.has(segment.id) ||
      ![segment.start, segment.end].every(Number.isFinite) ||
      segment.start < 0 ||
      segment.end <= segment.start ||
      segment.end > project.duration + EPSILON
    )
      return [];
    const owner = captionOwner(project, segment);
    const audibleOwner = owner && effective.get(owner.id);
    if (
      !owner ||
      !audibleOwner ||
      duplicateClipIds.has(owner.id) ||
      !validSourceClip(owner, assets) ||
      segment.start < owner.start - EPSILON ||
      segment.end > owner.start + owner.duration + EPSILON
    )
      return [];
    const words = normalizeTranscriptWords(segment.text, segment.words);
    if (!words) return [];
    return words.flatMap((word, wordIndex) => {
      if (
        word.start < segment.start - EPSILON ||
        word.end > segment.end + EPSILON ||
        word.start < owner.start ||
        word.end > owner.start + owner.duration ||
        !intervalIsAudible(project, audibleOwner, word.start, word.end)
      )
        return [];
      const sourceStart =
        owner.inPoint + (word.start - owner.start) * (owner.speed ?? 1);
      const sourceEnd =
        owner.inPoint + (word.end - owner.start) * (owner.speed ?? 1);
      if (
        sourceStart < owner.inPoint - EPSILON ||
        sourceEnd > owner.outPoint + EPSILON
      )
        return [];
      return [
        {
          segmentId: segment.id,
          wordIndex,
          text: word.text,
          start: word.start,
          end: word.end,
          sourceClipId: owner.id,
          sourceStart,
          sourceEnd,
        },
      ];
    });
  });
}

/** Validate every selected token against the current project before making one
 * change. Duplicated/overlapping selections remove their union, never the gaps. */
export function buildTranscriptCutPlan(
  project: EditProject,
  assets: Asset[],
  selections: TranscriptWordSelection[]
): TranscriptCutPlan {
  if (
    !Array.isArray(selections) ||
    !selections.length ||
    selections.length > 5000
  )
    throw new Error("Select between one and 5,000 measured words to cut.");
  const available = new Map(
    getTranscriptCutWords(project, assets).map(word => [
      transcriptWordSelectionKey(word),
      word,
    ])
  );
  const words = new Map<string, TranscriptCutWord>();
  for (const selection of selections) {
    if (
      !selection ||
      typeof selection.segmentId !== "string" ||
      !Number.isSafeInteger(selection.wordIndex) ||
      selection.wordIndex < 0
    )
      throw new Error(
        "Choose valid measured words from the current transcript."
      );
    const key = transcriptWordSelectionKey(selection);
    const word = available.get(key);
    if (!word)
      throw new Error(
        "A selected word no longer has valid, audible source timing. Select it again from the current transcript."
      );
    words.set(key, word);
  }
  const intervals: TranscriptCutPlan["intervals"] = [];
  for (const word of [...words.values()].sort(
    (a, b) => a.start - b.start || a.end - b.end
  )) {
    const last = intervals.at(-1);
    if (last && word.start <= last.end) last.end = Math.max(last.end, word.end);
    else intervals.push({ start: word.start, end: word.end });
  }
  const earliest = intervals[0].start;
  const affected = project.clips.filter(
    clip => clip.start + clip.duration > earliest
  );
  if (affected.some(clip => clip.locked))
    throw new Error(
      "Unlock clips after the first selected word before closing the gaps."
    );
  assertNoShotTransition(
    project,
    affected.map(clip => clip.id)
  );
  return {
    words: [...words.values()],
    intervals,
    wordCount: words.size,
    removedDuration: intervals.reduce(
      (sum, interval) => sum + interval.end - interval.start,
      0
    ),
  };
}

/** Real footage/audio cuts, using the same engine as timeline ripple delete.
 * The caller saves this result as one revision; restoration is that revision's
 * normal undo, not a separate collection of imaginary deleted tokens. */
export function cutTranscriptWords(
  project: EditProject,
  assets: Asset[],
  selections: TranscriptWordSelection[]
): EditProject {
  const plan = buildTranscriptCutPlan(project, assets, selections);
  const cut = [...plan.intervals]
    .reverse()
    .reduce(
      (current, interval) =>
        rippleRemove(current, interval.start, interval.end),
      project
    );
  // Overlapping provider words can retain an audible fragment at a cut boundary.
  // Keep its measured span inside its new cue/source piece.
  const transcript = cut.transcript.map(segment => {
    // The source-clock projection can introduce tiny floating-point changes in
    // untouched earlier cues. Preserve their exact measured clocks and evidence.
    const unchangedBefore = project.transcript.find(
      original =>
        original.id === segment.id &&
        original.end <= plan.intervals[0].start &&
        original.text === segment.text &&
        Math.abs(original.start - segment.start) < EPSILON &&
        Math.abs(original.end - segment.end) < EPSILON
    );
    const stable = unchangedBefore
      ? { ...unchangedBefore, sourceClipId: segment.sourceClipId }
      : segment;
    const bounded = mapTranscriptTime(stable, time => time, {
      start: stable.start,
      end: stable.end,
    });
    return {
      ...bounded,
      ...(bounded.words
        ? {
            words: bounded.words
              .map(word => ({
                ...word,
                start: Math.max(word.start, bounded.start),
                end: Math.min(word.end, bounded.end),
              }))
              .filter(word => word.end > word.start),
          }
        : {}),
    };
  });
  const next = { ...cut, transcript };
  const evidence = buildStoryBeatEvidence(next);
  return {
    ...next,
    storyBeats: next.storyBeats?.filter(beat =>
      storyBeatsAreCurrent([beat], evidence)
    ),
  };
}
