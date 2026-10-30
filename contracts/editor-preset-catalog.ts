import {
  GRAPHIC_PRESETS,
  CLIP_LOOK_PRESETS,
  CAPTION_PRESETS,
} from "./editor-presets";
import {
  normalizeEditorSavedStyles,
  type EditorSavedStyle,
} from "./editor-style-library";
import {
  TRANSITION_PRESETS,
  normalizeTransitionPresets,
  type TransitionPreset,
} from "./transition-presets";
import { MOTION_KITS, motionKitClips } from "./motion-kits";

export const EDITOR_PRESET_GUIDANCE = `For graphic or style edits, parameters.presetId may select a free presetCatalog graphics/looks ID or matching personal style ID. Override only requested fields in parameters.graphic or style parameters. Motion kits are coordinated native layers: use every layer's presetId from one presetCatalog.motionKits entry as separate graphic operations with the same start/end (1–30 seconds). Supply the same parameters.kitTitle, kitSubtitle, kitAccent (#RRGGBB), and, for a statistic, kitValue (a supplied measured percentage) to each layer. Each layer remains editable. Do not invent measured values. Personal caption settings are in presetCatalog.personal. Use catalog transitions only at valid adjacent cuts with source handles. These presets require no media generation.`;

export function editorPresetCatalog(
  styles: EditorSavedStyle[] = [],
  personalTransitions: TransitionPreset[] = []
) {
  return {
    graphics: GRAPHIC_PRESETS.map(p => ({
      id: p.id,
      name: p.name,
      duration: p.duration,
    })),
    looks: CLIP_LOOK_PRESETS.map(p => ({ id: p.id, name: p.name })),
    captions: CAPTION_PRESETS.map(p => ({ id: p.id, name: p.name })),
    transitions: TRANSITION_PRESETS,
    personalTransitions: normalizeTransitionPresets(personalTransitions),
    motionKits: MOTION_KITS.map(kit => ({
      id: kit.id,
      name: kit.name,
      detail: kit.detail,
      duration: kit.seconds,
      layers: motionKitClips(
        {
          kit: kit.id,
          title: kit.title,
          subtitle: kit.subtitle,
          accent: "#8B7CF8",
          seconds: kit.seconds,
          value: 50,
        },
        [],
        0,
        "catalog"
      ).map((layer, index) => ({
        presetId: `motion:${kit.id}:${index}`,
        name: layer.label,
      })),
    })),
    personal: normalizeEditorSavedStyles(styles).map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      ...(s.type === "captions"
        ? {
            captionStyle: s.captionStyle,
            captionAppearance: s.captionAppearance,
          }
        : {}),
    })),
  };
}
export function resolveEditorPresetOperation(
  raw: unknown,
  styles: EditorSavedStyle[] = []
) {
  if (!raw || typeof raw !== "object") return raw;
  const operation = raw as Record<string, unknown>;
  const params = operation.parameters as Record<string, unknown> | undefined;
  if (!params || typeof params.presetId !== "string") return raw;
  const overrides = { ...params };
  delete overrides.presetId;
  const personal = normalizeEditorSavedStyles(styles).find(
    s => s.id === params.presetId
  );
  if (operation.type === "graphic") {
    const motionId = params.presetId.match(/^motion:([a-z-]+):(\d+)$/);
    const kit = motionId && MOTION_KITS.find(k => k.id === motionId[1]);
    if (motionId && !kit)
      throw new Error("The motion kit is no longer available.");
    const kitLayer =
      kit && motionId
        ? motionKitClips(
            {
              kit: kit.id,
              title:
                typeof params.kitTitle === "string"
                  ? params.kitTitle
                  : kit.title,
              subtitle:
                typeof params.kitSubtitle === "string"
                  ? params.kitSubtitle
                  : kit.subtitle,
              accent:
                typeof params.kitAccent === "string"
                  ? params.kitAccent
                  : "#8B7CF8",
              seconds: Number(operation.end) - Number(operation.start),
              value:
                typeof params.kitValue === "number"
                  ? params.kitValue
                  : undefined,
            },
            [],
            0,
            "resolved"
          )[Number(motionId[2])]?.graphic
        : undefined;
    const graphic = kit
      ? kitLayer
      : personal?.type === "graphic"
        ? personal.graphic
        : GRAPHIC_PRESETS.find(p => p.id === params.presetId)?.graphic;
    if (!graphic) throw new Error("The graphic preset is no longer available.");
    for (const key of ["kitTitle", "kitSubtitle", "kitAccent", "kitValue"])
      delete overrides[key];
    return {
      ...operation,
      parameters: {
        ...overrides,
        graphic: {
          ...graphic,
          ...(params.graphic && typeof params.graphic === "object"
            ? params.graphic
            : {}),
        },
      },
    };
  }
  if (operation.type === "style") {
    const settings =
      personal?.type === "look"
        ? personal.settings
        : CLIP_LOOK_PRESETS.find(p => p.id === params.presetId)?.settings;
    if (!settings) throw new Error("The look preset is no longer available.");
    return { ...operation, parameters: { ...settings, ...overrides } };
  }
  throw new Error("This operation does not support that preset.");
}
