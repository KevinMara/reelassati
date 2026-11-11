import type { Asset, EditOperation, EditProject } from "./workspace";
import {
  catalogColorLutCandidates,
  resolveCatalogColorLut,
  CATALOG_COLOR_LUT_GUIDANCE,
} from "./catalog-color-lut";
import {
  sharedCatalogPlanningAssets,
  type SharedMediaCatalogItem,
} from "./shared-media-catalog";
import { buildEditorialSpeechEvidence } from "./editorial-evidence";
import { editPlanningMedia } from "./edit-planning-media";
import { sourceReviewFacts } from "./source-review";
import { effectiveTimelineClips } from "./timeline-mixer";
import { normalizeClipGroups } from "./clip-groups";
import {
  EditPlanValidationError,
  type EditPlanValidationReason,
} from "./edit-plan-validation";
import {
  editorAudioCatalog,
  type EditorAudioCatalogEntry,
} from "./editor-audio-catalog";

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const round = (value: number) => Math.round(value * 1e6) / 1e6;

/** Waveform bins are measured amplitude samples, not detected musical beats. */
export function catalogSoundPeakSeconds(entry: EditorAudioCatalogEntry) {
  const peak = Math.max(...entry.waveform);
  const index = entry.waveform.indexOf(peak);
  return entry.waveform.length > 1 && peak > 0
    ? round((index / (entry.waveform.length - 1)) * entry.duration)
    : 0;
}

/** All clocks here are explicit. Scenes partition actual footage/observation
 * boundaries; they are not generated story claims or a fixed shot-duration grid.
 * A speech ID names one timeline occurrence, including its trim and speed. */
export function buildEditPlanningContext(
  project: EditProject,
  assets: Asset[],
  projects: Pick<EditProject, "sourceReviews">[] = [],
  sharedCatalog: SharedMediaCatalogItem[] = []
) {
  const speechEvidence = buildEditorialSpeechEvidence(project).map(
    (speech, index) => ({ ...speech, id: `speech:${index}` })
  );
  const byAsset = new Map(assets.map(asset => [asset.id, asset]));
  const footage = effectiveTimelineClips(project).filter(
    clip =>
      !clip.hidden &&
      !clip.graphic &&
      !clip.transitionHandle &&
      clip.track !== "audio" &&
      clip.track !== "captions" &&
      clip.assetId &&
      ["video", "image", "export"].includes(
        byAsset.get(clip.assetId)?.kind ?? ""
      ) &&
      [clip.start, clip.duration, clip.inPoint, clip.outPoint].every(finite) &&
      clip.duration > 0 &&
      finite(clip.speed ?? 1) &&
      (clip.speed ?? 1) > 0
  );
  const observations = footage.flatMap(clip => {
    const review = project.sourceReviews
      ?.filter(review => review.assetId === clip.assetId)
      .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))[0];
    const speed = clip.speed ?? 1;
    return (
      review ? (sourceReviewFacts(review).observations ?? []) : []
    ).flatMap(observation => {
      const sourceStart = Math.max(clip.inPoint, observation.start);
      const sourceEnd = Math.min(
        clip.outPoint,
        clip.inPoint + clip.duration * speed,
        observation.end
      );
      const start = Math.max(
        0,
        clip.start + (sourceStart - clip.inPoint) / speed
      );
      const end = Math.min(
        project.duration,
        clip.start + (sourceEnd - clip.inPoint) / speed
      );
      return start < end && sourceStart < sourceEnd
        ? [
            {
              ...observation,
              clipId: clip.id,
              sourceStart,
              sourceEnd,
              start,
              end,
            },
          ]
        : [];
    });
  });
  const boundaries = [
    ...new Set(
      [
        0,
        project.duration,
        ...footage.flatMap(clip => [clip.start, clip.start + clip.duration]),
        ...observations.flatMap(row => [row.start, row.end]),
      ].filter(time => finite(time) && time >= 0 && time <= project.duration)
    ),
  ].sort((a, b) => a - b);
  const scenes = boundaries.slice(0, -1).flatMap((start, index) => {
    const end = boundaries[index + 1];
    if (end - start < 0.000001) return [];
    const visible = footage.filter(
      clip => clip.start < end && clip.start + clip.duration > start
    );
    return [
      {
        id: `scene:${index}`,
        start,
        end,
        // This is presence of a picture track, not proof it is unobstructed.
        pictureAvailable: visible.length > 0,
        sources: visible.map(clip => ({
          clipId: clip.id,
          assetId: clip.assetId!,
          locked: clip.locked,
          sourceStart: round(
            clip.inPoint + (start - clip.start) * (clip.speed ?? 1)
          ),
          sourceEnd: round(
            clip.inPoint + (end - clip.start) * (clip.speed ?? 1)
          ),
          speed: clip.speed ?? 1,
        })),
        speechIds: speechEvidence
          .filter(speech => speech.start < end && speech.end > start)
          .map(speech => speech.id),
        observations: observations.filter(
          row => row.start < end && row.end > start
        ),
      },
    ];
  });
  const libraryMedia = editPlanningMedia(
    [...assets, ...sharedCatalogPlanningAssets(sharedCatalog)],
    [...projects, project]
  );
  const mediaExcerpts = libraryMedia.flatMap(asset => {
    if (!["video", "export"].includes(asset.kind) || !finite(asset.duration))
      return [];
    return (asset.evidence?.observations ?? []).flatMap(
      (observation, index) => {
        const sourceIn = Math.max(0, observation.start);
        const sourceOut = Math.min(asset.duration!, observation.end);
        return sourceOut > sourceIn && observation.visualEvidence
          ? [
              {
                id: `excerpt:${asset.assetId}:${index}`,
                assetId: asset.assetId,
                sourceIn,
                sourceOut,
                duration: round(sourceOut - sourceIn),
                visualEvidence: observation.visualEvidence,
                confidence: observation.confidence,
              },
            ]
          : [];
      }
    );
  });
  return {
    clock: "current-timeline-seconds" as const,
    clipTargets: effectiveTimelineClips(normalizeClipGroups(project)).map(
      clip => ({
        id: clip.id,
        assetId: clip.assetId,
        catalogAssetId: byAsset
          .get(clip.assetId ?? "")
          ?.variantGroupId?.startsWith("builtin-audio:")
          ? `catalog:${byAsset.get(clip.assetId ?? "")!.variantGroupId!.slice("builtin-audio:".length)}`
          : undefined,
        track: clip.track,
        linkId: clip.linkId,
        locked: clip.locked,
        start: clip.start,
        end: clip.start + clip.duration,
        colorLut: clip.colorLut,
        picture:
          clip.track !== "audio" &&
          clip.track !== "captions" &&
          !clip.hidden &&
          !clip.graphic &&
          !clip.transitionHandle,
      })
    ),
    speechEvidence,
    scenes,
    libraryMedia,
    mediaExcerpts,
    catalogColorLooks: catalogColorLutCandidates(sharedCatalog),
    sharedCatalog: sharedCatalog
      .filter(item => item.kind !== "lut")
      .map(
        ({
          id,
          name,
          kind,
          group,
          variant,
          tags,
          duration,
          width,
          height,
          blendMode,
        }) => ({
          assetId: `shared:${id}`,
          name,
          kind,
          group,
          variant,
          tags,
          duration,
          width,
          height,
          blendMode,
        })
      ),
    freeSounds: [
      ...editorAudioCatalog.map(entry => ({
        assetId: `catalog:${entry.id}`,
        name: entry.name,
        category: entry.category,
        duration: entry.duration,
        tags: entry.tags,
        type: entry.type,
        peakSeconds: catalogSoundPeakSeconds(entry),
      })),
      ...sharedCatalog
        .filter(item => item.kind === "audio")
        .map(item => ({
          assetId: `shared:${item.id}`,
          name: item.name,
          category: item.group,
          duration: item.duration,
          tags: item.tags,
          type: "sfx" as const,
          peakSeconds: item.waveform
            ? round(
                (item.waveform.indexOf(Math.max(...item.waveform)) / 63) *
                  item.duration
              )
            : 0,
        })),
    ],
  };
}

export type EditPlanningContext = ReturnType<typeof buildEditPlanningContext>;

const operationTypes = new Set([
  "trim",
  "split",
  "move",
  "delete",
  "caption",
  "silence",
  "pacing",
  "broll",
  "audio",
  "style",
  "graphic",
  "sound",
]);
const cueTypes = new Set(["graphic", "style", "sound", "broll"]);

/** Resolve model-selected evidence references into ordinary editable operations
 * BEFORE provenance is signed. No model retry, invented speech, replacement
 * media or source-clock mutation is involved. Legacy numeric plans still work. */
export function resolveEditPlanningReferences(
  value: unknown,
  context: EditPlanningContext,
  duration: number,
  selectedClipIds: string[] = []
): unknown[] {
  if (!Array.isArray(value))
    throw new EditPlanValidationError(
      "changes_not_array",
      "The edit plan did not contain an executable changes list."
    );
  return value.map((candidate, index) => {
    const original = record(candidate);
    if (!original || !operationTypes.has(String(original.type)))
      throw new EditPlanValidationError(
        "unsupported_operation",
        `Edit ${index + 1} uses an unsupported operation.`,
        index
      );
    const operation = { ...original };
    const invalid: (
      reason: EditPlanValidationReason,
      message: string
    ) => never = (reason, message) => {
      throw new EditPlanValidationError(
        reason,
        message,
        index,
        operation.type as EditOperation["type"]
      );
    };
    // K3's JSON-only response has no required non-null optional annotations.
    // Null means no annotation; non-null malformed references still reject.
    for (const key of ["cue", "mediaExcerptId", "targetClipIds"])
      if (operation[key] === null) delete operation[key];
    const parameters = Object.fromEntries(
      Object.entries(record(operation.parameters) ?? {}).filter(
        ([key, value]) => value !== null || key === "colorLut"
      )
    );
    if (Object.hasOwn(parameters, "colorLut")) {
      if (operation.type !== "style")
        invalid(
          "reference_conflict",
          `Edit ${index + 1} applies a color look outside a style operation.`
        );
      try {
        parameters.colorLut = resolveCatalogColorLut(
          parameters.colorLut,
          context.catalogColorLooks
        );
      } catch {
        invalid(
          "reference_unavailable",
          `Edit ${index + 1} selects an unavailable color look or invalid intensity.`
        );
      }
    }
    if (
      typeof parameters.assetId === "string" &&
      parameters.assetId.startsWith("shared:")
    ) {
      const item = context.sharedCatalog.find(
        item => item.assetId === parameters.assetId
      );
      if (
        !item ||
        item.kind === "lut" ||
        !["sound", "audio", "broll"].includes(String(operation.type))
      )
        invalid(
          "reference_unavailable",
          `Edit ${index + 1} selects unavailable shared media.`
        );
      if (
        (item.kind === "audio" && operation.type === "broll") ||
        (item.kind !== "audio" && operation.type !== "broll")
      )
        invalid(
          "reference_conflict",
          `Edit ${index + 1} uses the wrong shared media kind.`
        );
      if (item.kind !== "audio") {
        parameters.visual = {
          ...record(parameters.visual),
          blendMode: item.blendMode,
        };
        parameters.fit = "contain";
        parameters.mediaKind = item.kind;
      }
    }
    if (operation.type === "audio" && parameters.assetId !== undefined) {
      // Existing-clip mixing and insertion are different executor operations.
      // An explicit new audio source must never be ignored while ducking voice.
      const sound =
        context.freeSounds.find(row => row.assetId === parameters.assetId) ??
        context.libraryMedia.find(
          row => row.assetId === parameters.assetId && row.kind === "audio"
        );
      if (!sound)
        invalid(
          "reference_unavailable",
          `Edit ${index + 1} selects an unavailable audio asset.`
        );
      const mixTargets =
        Array.isArray(operation.targetClipIds) && operation.targetClipIds.length
          ? operation.targetClipIds
          : selectedClipIds;
      if (
        context.clipTargets.some(
          clip =>
            mixTargets.includes(clip.id) &&
            (clip.assetId === parameters.assetId ||
              clip.catalogAssetId === parameters.assetId)
        )
      )
        invalid(
          "reference_conflict",
          `Edit ${index + 1} must distinguish an existing audio mix from a new sound insertion.`
        );
      if (!finite(sound.duration) || sound.duration <= 0)
        invalid(
          "duration_invalid",
          `Edit ${index + 1} needs a measured audio source duration.`
        );
      if (
        parameters.sourceIn !== undefined &&
        (!finite(parameters.sourceIn) ||
          parameters.sourceIn < 0 ||
          parameters.sourceIn >= sound.duration)
      )
        invalid(
          "source_offset_conflict",
          `Edit ${index + 1} starts outside the selected audio source.`
        );
      operation.type = "sound";
    }
    if (operation.targetClipIds !== undefined) {
      if (
        !Array.isArray(operation.targetClipIds) ||
        operation.targetClipIds.some(
          id =>
            typeof id !== "string" ||
            !context.clipTargets.some(
              clip =>
                clip.id === id && (!clip.locked || operation.type === "sound")
            )
        )
      )
        invalid(
          "target_invalid",
          `Edit ${index + 1} references an unavailable or locked target.`
        );
    }
    const excerptId = operation.mediaExcerptId;
    if (excerptId !== undefined) {
      const excerpt = context.mediaExcerpts.find(row => row.id === excerptId);
      if (operation.type !== "broll" || !excerpt)
        invalid(
          "reference_unavailable",
          `Edit ${index + 1} references an unavailable media excerpt.`
        );
      if (
        (parameters.assetId !== undefined &&
          parameters.assetId !== excerpt.assetId) ||
        (parameters.sourceIn !== undefined &&
          parameters.sourceIn !== excerpt.sourceIn) ||
        parameters.prompt !== undefined
      )
        invalid(
          "reference_conflict",
          `Edit ${index + 1} conflicts with its selected media excerpt.`
        );
      parameters.assetId = excerpt.assetId;
      parameters.sourceIn = excerpt.sourceIn;
      delete operation.mediaExcerptId;
    }
    if (operation.cue !== undefined) {
      const rawCue = record(operation.cue);
      const cue = rawCue
        ? Object.fromEntries(
            Object.entries(rawCue).filter(([, value]) => value !== null)
          )
        : null;
      if (!cue || !cueTypes.has(String(operation.type)))
        invalid(
          "cue_unsupported",
          `Edit ${index + 1} cannot use an evidence cue.`
        );
      if (
        Number(typeof cue.speechId === "string") +
          Number(typeof cue.sceneId === "string") !==
          1 ||
        (cue.edge !== undefined && cue.edge !== "start" && cue.edge !== "end")
      )
        invalid(
          "cue_invalid",
          `Edit ${index + 1} needs one valid speech or scene cue.`
        );
      const speech = context.speechEvidence.find(
        row => row.id === cue.speechId
      );
      const scene = context.scenes.find(row => row.id === cue.sceneId);
      const word =
        speech && cue.wordIndex !== undefined && Number.isInteger(cue.wordIndex)
          ? speech.words[Number(cue.wordIndex)]
          : undefined;
      if (
        (!speech && !scene) ||
        (cue.wordIndex !== undefined && !word) ||
        (speech?.partial && !word)
      )
        invalid(
          "cue_timing_unavailable",
          `Edit ${index + 1} references missing or incomplete timing evidence.`
        );
      const anchor = word ?? speech ?? scene!;
      const time = cue.edge === "end" ? anchor.end : anchor.start;
      let start = time;
      let end: number;
      if (operation.type === "sound") {
        const sound = context.freeSounds.find(
          row => row.assetId === parameters.assetId
        );
        if (
          !sound ||
          (cue.align === "peak" && sound.type !== "sfx") ||
          (cue.align !== undefined &&
            cue.align !== "start" &&
            cue.align !== "peak")
        )
          invalid(
            "sound_cue_invalid",
            `Edit ${index + 1} needs an available catalog cue and sound alignment.`
          );
        if (parameters.sourceIn !== undefined && parameters.sourceIn !== 0)
          invalid(
            "source_offset_conflict",
            `Edit ${index + 1} cannot combine a sound cue with a source offset.`
          );
        start = time - (cue.align === "peak" ? sound.peakSeconds : 0);
        // Crop the unavailable lead-in at the opening, retaining peak alignment.
        parameters.sourceIn = round(Math.max(0, -start));
        end = Math.min(duration, start + sound.duration);
        start = Math.max(0, start);
      } else {
        if (cue.align !== undefined)
          invalid(
            "cue_invalid",
            `Edit ${index + 1}: waveform alignment is only supported for sound.`
          );
        if (!finite(cue.duration) || cue.duration <= 0)
          invalid(
            "duration_invalid",
            `Edit ${index + 1} needs a positive cue duration.`
          );
        end = start + cue.duration;
      }
      if (
        !finite(start) ||
        !finite(end) ||
        start < 0 ||
        end > duration + 0.000001 ||
        end <= start
      )
        invalid("range_invalid", `Edit ${index + 1} extends outside the edit.`);
      if (operation.type === "style" && scene && end > scene.end + 0.000001)
        invalid(
          "range_invalid",
          `Edit ${index + 1} extends beyond its observed scene.`
        );
      if (
        (finite(operation.start) &&
          Math.abs(operation.start - start) > 0.000001) ||
        (finite(operation.end) && Math.abs(operation.end - end) > 0.000001)
      )
        invalid(
          "timing_conflict",
          `Edit ${index + 1} conflicts with its selected timing cue.`
        );
      operation.start = round(start);
      operation.end = round(end);
      if (
        !Array.isArray(operation.targetClipIds) ||
        !operation.targetClipIds.length
      ) {
        if (
          operation.type === "style" &&
          speech &&
          !context.clipTargets.some(
            clip => clip.id === speech.clipId && clip.picture && !clip.locked
          )
        )
          invalid(
            "target_not_visual",
            `Edit ${index + 1} needs a visible footage target for its speech cue.`
          );
        operation.targetClipIds = speech
          ? [speech.clipId]
          : scene!.sources
              .filter(source => !source.locked || operation.type === "sound")
              .map(source => source.clipId);
      }
      delete operation.cue;
    }
    if (!finite(operation.start) || !finite(operation.end))
      invalid(
        "missing_timing",
        `Edit ${index + 1} has no measured timeline interval.`
      );
    // Make the executor's existing defaults explicit in the signed proposal.
    if (operation.type === "move" && parameters.destination === undefined)
      parameters.destination = operation.start;
    if (operation.type === "audio" && parameters.volume === undefined)
      parameters.volume = 0.25;
    let targets = Array.isArray(operation.targetClipIds)
      ? (operation.targetClipIds as string[])
      : [];
    if (
      targets.some(
        id => selectedClipIds.length && !selectedClipIds.includes(id)
      )
    )
      invalid(
        "selection_conflict",
        `Edit ${index + 1} conflicts with the selected clips.`
      );
    if (operation.type === "style") {
      if (!targets.length) {
        // An empty scene target must not later expand to hidden/audio/locked
        // layers in the generic operation mapper.
        if (original.cue != null)
          invalid(
            "target_not_visual",
            `Edit ${index + 1} has no visible footage target.`
          );
        targets = context.clipTargets
          .filter(
            clip =>
              clip.picture &&
              !clip.locked &&
              clip.start < (operation.end as number) &&
              clip.end > (operation.start as number) &&
              (!selectedClipIds.length || selectedClipIds.includes(clip.id))
          )
          .map(clip => clip.id);
      }
      const pictures = context.clipTargets.filter(
        clip => targets.includes(clip.id) && clip.picture && !clip.locked
      );
      if (
        !pictures.length ||
        targets.some(
          id =>
            !context.clipTargets.some(
              clip =>
                clip.id === id &&
                !clip.locked &&
                (clip.picture ||
                  (clip.track === "audio" &&
                    clip.linkId &&
                    pictures.some(picture => picture.linkId === clip.linkId)))
            )
        )
      )
        invalid(
          "target_not_visual",
          `Edit ${index + 1} needs visible footage targets for its visual controls.`
        );
      operation.targetClipIds = targets;
    }
    if (excerptId !== undefined) {
      const excerpt = context.mediaExcerpts.find(row => row.id === excerptId)!;
      if (
        !finite(operation.start) ||
        !finite(operation.end) ||
        operation.end <= operation.start ||
        operation.end - operation.start > excerpt.duration + 0.000001
      )
        invalid(
          "range_invalid",
          `Edit ${index + 1} extends beyond the observed media excerpt.`
        );
    }
    operation.parameters = parameters;
    return operation;
  });
}

/** Normalization must not turn an unsupported effect into a paid no-op. This
 * checks actual executable controls, never an artificial operation quota. */
export function assertExecutableEditPlan(operations: EditOperation[]) {
  const styleNumbers = [
    "fadeIn",
    "fadeOut",
    "exposure",
    "temperature",
    "tint",
    "highlights",
    "shadows",
    "whites",
    "blacks",
    "brightness",
    "contrast",
    "saturation",
  ] as const;
  for (const [index, operation] of operations.entries()) {
    const parameters = operation.parameters ?? {};
    const fail = (
      detail: string,
      reason: EditPlanValidationReason = "missing_control"
    ): never => {
      throw new EditPlanValidationError(reason, detail, index, operation.type);
    };
    if (operation.type === "audio" && parameters.assetId != null)
      fail(
        "an audio asset requires a sound insertion, not an existing-clip volume adjustment.",
        "reference_conflict"
      );
    if (
      operation.type === "style" &&
      !(
        styleNumbers.some(key => finite(parameters[key])) ||
        parameters.fit ||
        parameters.colorLut !== undefined ||
        (parameters.visual && Object.keys(parameters.visual).length)
      )
    )
      fail("the proposed style has no supported visual control.");
    if (operation.type === "audio" && !finite(parameters.volume))
      fail("the proposed audio adjustment has no volume.");
    if (operation.type === "pacing" && !finite(parameters.speed))
      fail("the proposed pacing change has no playback speed.");
    if (operation.type === "move" && !finite(parameters.destination))
      fail("the proposed move has no destination.");
    if (operation.type === "caption" && !parameters.text?.trim())
      fail("the proposed caption has no supplied words.");
    if (operation.type === "graphic" && !parameters.graphic)
      fail("the proposed graphic has no supported editable design.");
    if (operation.type === "sound" && !parameters.assetId)
      fail(
        "the proposed sound has no available audio selection.",
        "missing_media"
      );
    if (
      operation.type === "broll" &&
      !(
        parameters.assetId ||
        (parameters.prompt?.trim() &&
          ["image", "video"].includes(parameters.mediaKind ?? ""))
      )
    )
      fail(
        "the proposed supporting media has no source or generation specification.",
        "missing_media"
      );
    if (
      !["caption", "graphic", "broll", "sound", "silence"].includes(
        operation.type
      ) &&
      !operation.targetClipIds.length
    )
      fail("the proposed change has no available target.", "missing_target");
  }
}

/** Keep this aligned with applyEditOperation, not the larger interactive chat
 * action vocabulary. Unsupported actions must not silently disappear. */
export const EDIT_PLANNING_CAPABILITIES = `
${CATALOG_COLOR_LUT_GUIDANCE}
The scene map partitions actual timeline footage and observed events. Its sourceStart/
sourceEnd values are source-media seconds; scene start/end and all operation intervals
are current timeline seconds. Scenes describe evidence, not a required number of edits.
Choose a purpose per relevant beat, keep the demonstrated action visible, and use the
available source speech, picture, compositions and sound together. Unknown picture
coverage is not a claim that an overlay is safe. Do not add a cue just to fill a scene.

Use supported footage motion through type=style, parameters.visual:{x/y:-100..100
(percent offset from canvas center),scale:0.1..4,rotation:-720..720,opacity:0..1,
flipX/flipY:boolean,crop:{top/right/bottom/left:0..45},blendMode:normal|multiply|screen|
overlay|darken|lighten|difference,mask:none|ellipse|rounded|polygon,
polygon:[{x/y:0..100}] (3..12 points),radius:0..50,
keyframes:[{at:0..1,x,y,scale,rotation,opacity,easing:linear|ease-in|ease-out|ease-in-out|hold}],
entrance/exit:{kind:none|dissolve|wipe-left|wipe-right|wipe-up|wipe-down|slide-left|
slide-right|zoom,duration:0.05..5}}. A local style operation isolates its actual range;
keyframe at is normalized progress, not seconds: on a 4.2-second local style,
at:0 is its start, at:0.5 is 2.1 seconds into it, and at:1 is its end.
preserve existing animation when not changing it. A subtle emphasis needs a settled
hold, not constant oscillation. Reframe only when known source detail remains visible.
An entrance/exit affects one clip's picture and leaves speech intact; it is not a
cross-dissolve between adjacent shots. This auto-edit operation format does NOT support
adjacent-transition, arbitrary plugins, tracking, time remapping or procedural 3D files.
Do not emit unsupported operations or disguise them as a style change.

For precisely timed local style, graphic, broll or sound operations, you may replace
start/end with cue:{speechId,wordIndex,edge:start|end,duration} or
cue:{sceneId,edge:start|end,duration}. IDs come from speechEvidence/scenes; wordIndex is
zero-based in that speech row's measured words. Omit wordIndex only for a complete
phrase. duration is timeline seconds and is required except for sound. These references
compile to normal editable operations, never alter speech speed and never invent a
word boundary. For a style anchored to separate audio, supply exact visible footage
targetClipIds; arbitrary audio is not a picture target. For a partial-range style on
explicitly linked video/audio, also include every exact linked peer ID so the source
pieces and speech remain synchronized. A local scene style must fit that
scene. Keep explicit numeric timing
for structural cuts/moves and when no suitable evidence cue exists.
Retained trims can accompany local treatments when the kept source samples stay at
their original timeline positions and each specifically timed treatment fits the
retained range. A whole-clip grade or mix follows the retained source. Moving a trim,
moving a clip or changing its playback speed cannot be combined with dependent cues
on the old clock: that needs a new plan after the structural edit. For ordinary
evidenced gap removal use silence ripple cuts; inserted pictures, graphics and sound
are projected through those cuts together with the source.
Audio mixing and audio insertion are distinct: type=audio changes only the volume
of existing targetClipIds and must not include assetId. To ADD music or an SFX use
type=sound with parameters.assetId, even for a full-length music bed. For example,
{type:"sound",start:0,end:12,targetClipIds:[],parameters:{assetId:"catalog:chill-lofi",volume:0.18}}
adds a quiet music lane and preserves source speech volume. To duck existing music,
target its actual audio clip with type=audio; never target the speaking video merely
because the new bed should be quiet. sourceIn selects the audio-file offset in seconds.
For a catalog sound cue, use cue:{speechId,wordIndex,edge:start,align:peak|start} or
cue:{sceneId,edge:start,align:peak|start}; omit duration/start/end and sourceIn. The
compiler aligns the measured waveform peak estimate or file onset, preserves natural
source length, and crops only at edit boundaries. Peak is amplitude evidence, not beat
detection; align:peak is only for SFX, while music uses align:start. Choose a matching
category/tags for the actual action, keep volume quiet,
and omit sounds when they compete with existing music or meaningful source audio.
For reviewed supporting video, mediaExcerptId selects one supplied mediaExcerpts entry
and compiles its real assetId/sourceIn; keep the insertion within that excerpt's
duration. Select it by its visualEvidence, not its name. This is original library
footage, not generated or licensed stock. Ordinary assetId/sourceIn also remain valid.
Optional planning annotations may be omitted or null. A numeric operation needs no
cue or mediaExcerptId. For a scene cue, omit speechId/wordIndex; for a speech cue, omit
sceneId. Non-null references must identify the supplied evidence exactly.
Measured speechEvidence is supplied source audio evidence even when no separate
audio attachment is present. Do not say audio or dialogue was absent when measured
source speech is available; unassessed music/noise remain unknown. Automatic graphic
copy must be an exact contiguous phrase of timed speech/captions or observedText
supporting its interval. Include every word's measured span in that interval; do not
borrow a phrase from another beat, extend a claim, or merely promise it in summary.
`.trim();
