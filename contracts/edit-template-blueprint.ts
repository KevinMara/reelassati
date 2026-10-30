import type { EditProject, TimelineClip } from "./workspace";

/** Immutable native edit archive. Asset IDs refer to the owner's Library, never URLs. */
export type EditTemplateBlueprint = Pick<
  EditProject,
  | "aspectRatio"
  | "frameRate"
  | "duration"
  | "clips"
  | "transcript"
  | "captionStyle"
  | "captionAppearance"
  | "trackSettings"
  | "storyBeats"
> & { version: 1 };
const fields = [
  "aspectRatio",
  "frameRate",
  "duration",
  "clips",
  "transcript",
  "captionStyle",
  "captionAppearance",
  "trackSettings",
  "storyBeats",
] as const;
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

export function captureEditBlueprint(
  project: EditProject
): EditTemplateBlueprint {
  const blueprint = normalizeEditBlueprint({
    version: 1,
    ...Object.fromEntries(fields.map(k => [k, project[k]])),
  });
  if (!blueprint) throw new Error("This edit cannot be saved as a template.");
  return blueprint;
}
export function normalizeEditBlueprint(
  value: unknown
): EditTemplateBlueprint | undefined {
  const row = object(value);
  if (
    row.version !== 1 ||
    !["9:16", "1:1", "16:9"].includes(String(row.aspectRatio)) ||
    (row.frameRate !== undefined &&
      ![24, 25, 30, 60].includes(row.frameRate as number)) ||
    (row.captionStyle !== undefined && typeof row.captionStyle !== "string") ||
    typeof row.duration !== "number" ||
    !Number.isFinite(row.duration) ||
    row.duration <= 0 ||
    !Array.isArray(row.clips) ||
    row.clips.length > 5000 ||
    !Array.isArray(row.transcript)
  )
    return;
  if (
    !row.clips.every(c => {
      const clip = object(c);
      return (
        typeof clip.id === "string" &&
        ["video", "audio", "overlay", "captions"].includes(
          String(clip.track)
        ) &&
        [clip.start, clip.duration, clip.inPoint, clip.outPoint].every(
          n => typeof n === "number" && Number.isFinite(n) && n >= 0
        )
      );
    })
  )
    return;
  try {
    let nodes = 0;
    const safe = (v: unknown, depth = 0): boolean => {
      if (++nodes > 150000 || depth > 24) return false;
      if (
        v === null ||
        v === undefined ||
        typeof v === "boolean" ||
        typeof v === "string"
      )
        return true;
      if (typeof v === "number") return Number.isFinite(v);
      if (Array.isArray(v)) return v.every(item => safe(item, depth + 1));
      if (typeof v !== "object") return false;
      return Object.entries(v).every(
        ([k, item]) =>
          !["__proto__", "constructor", "prototype"].includes(k) &&
          safe(item, depth + 1)
      );
    };
    const picked = {
      version: 1,
      ...Object.fromEntries(
        fields.filter(k => row[k] !== undefined).map(k => [k, row[k]])
      ),
    };
    if (!safe(picked)) return;
    const json = JSON.stringify(picked);
    if (json.length > 2_000_000) return;
    return JSON.parse(json) as EditTemplateBlueprint;
  } catch {
    return;
  }
}
const lookKeys = [
  "fit",
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
const contentKeys = ["text", "secondaryText", "from", "to", "prefix", "suffix"];
function graphicDesign(clip: TimelineClip) {
  return Object.fromEntries(
    Object.entries(clip.graphic ?? {}).filter(
      ([key]) => !contentKeys.includes(key)
    )
  );
}
/** Only design data enters the model. Source dialogue, facts, names and asset identifiers stay in the archive. */
export function blueprintDesign(blueprint: EditTemplateBlueprint) {
  return {
    aspectRatio: blueprint.aspectRatio,
    frameRate: blueprint.frameRate,
    duration: blueprint.duration,
    captionStyle: blueprint.captionStyle,
    captionAppearance: blueprint.captionAppearance,
    trackSettings: blueprint.trackSettings,
    layers: blueprint.clips.map((clip, i) => ({
      templateClipId: `layer-${i}`,
      track: clip.track,
      lane: clip.lane,
      start: clip.start,
      duration: clip.duration,
      speed: clip.speed,
      visual: clip.visual,
      graphicDuration: clip.graphicDuration,
      ...(clip.graphic ? { graphic: graphicDesign(clip) } : {}),
      audioMix: clip.audioMix,
      volume: clip.volume,
      ...Object.fromEntries(
        lookKeys.filter(k => clip[k] !== undefined).map(k => [k, clip[k]])
      ),
    })),
  };
}
/** Resolve the model's layer reference before normal operation validation. No source words/assets are copied. */
export function resolveBlueprintOperations(
  changes: unknown,
  blueprint?: EditTemplateBlueprint
): unknown {
  if (!blueprint || !Array.isArray(changes)) return changes;
  return changes.map(value => {
    const op = object(value),
      params = object(op.parameters);
    const match = /^layer-(\d+)$/.exec(String(params.templateClipId));
    const clip = match ? blueprint.clips[Number(match[1])] : undefined;
    if (!clip) return value;
    if (op.type === "graphic" && clip.graphic) {
      const content = object(params.graphic);
      return {
        ...op,
        parameters: {
          ...params,
          graphic: {
            ...graphicDesign(clip),
            ...Object.fromEntries(
              contentKeys
                .filter(k => content[k] !== undefined)
                .map(k => [k, content[k]])
            ),
          },
        },
      };
    }
    if (op.type === "style" && !clip.graphic) {
      const framing = object(params.visual);
      return {
        ...op,
        parameters: {
          ...params,
          ...Object.fromEntries(
            lookKeys.filter(k => clip[k] !== undefined).map(k => [k, clip[k]])
          ),
          ...(clip.visual
            ? {
                visual: {
                  ...clip.visual,
                  ...Object.fromEntries(
                    ["x", "y", "scale", "crop"]
                      .filter(k => framing[k] !== undefined)
                      .map(k => [k, framing[k]])
                  ),
                },
              }
            : {}),
        },
      };
    }
    return value;
  });
}
