import {
  GRAPHIC_PRESETS,
  CLIP_LOOK_PRESETS,
  CAPTION_PRESETS,
} from "./editor-presets";
import { nativeGraphicTemplate } from "./native-graphics";
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
import {
  graphicDesignEvidence,
  instantiateGraphicPreset,
  PresetContentError,
} from "./graphic-design-evidence";

export const EDITOR_PRESET_GUIDANCE = `Native graphic templates have their own authored animation; animation:none does not mean static. Choose using template.design, including its layout, purpose and exclusions. Native size is 10% of the canvas width per unit (7 = 70%); its authored bounds describe the visible title aspect. Do not size it like ordinary font text. Supply each required text line, keep copy short and honor protected footage and caption space. Keep the native template ID and source animation; adjust text, color/accent, x/y/size and native.enter/native.exit if needed. Social templates require an actual supplied account handle for their specific platform. A legacy platform is appropriate only when explicitly requested. These templates need no generated media. For graphic or style edits, parameters.presetId may select a free presetCatalog graphics/looks ID or matching personal style ID. Choose using the actual design evidence: layout and palette, motion poses, composition, and editable settings, not names alone. Graphic layout x/y/size and dimensions are percentages; motion poses are sampled normalized progress, x, y, scale, rotation, opacity, not a complete curve or a visual inspection. Preserve the preset appearance unless the brief or source protection requires an override. For native presets, set parameters.presetId to the exact catalog ID and put ALL required text in the single parameters.graphic.native.values object. Its keys are the literal keys from template.textFields (including text-1 and text-2 when listed). For each field use the actual requested copy verbatim. Layers sharing one slot display the same text. Set every displayedNumbers key in that object to its actual supplied number. For ordinary graphic presets supply parameters.graphic.text and secondaryText where applicable. Never insert demo text or internal directions. Counter presets require explicit measured parameters.graphic.from/to and any prefix/suffix. Motion kits are coordinated native layers: use the required layer presetIds from one presetCatalog.motionKits entry as separate graphic operations with the same start/end (1–30 seconds); include optional layers only when their includeWhen condition is met. Supply the same explicit parameters.kitTitle, optional kitSubtitle (empty when absent), kitAccent (#RRGGBB), and, for a statistic, kitValue (a supplied measured percentage) to each layer. The catalog lists each layer's contentBindings. Each layer remains editable. Do not invent measured values or treat sample content as facts. Personal caption settings are in presetCatalog.personal. Use catalog transitions only at valid adjacent cuts with source handles. These presets require no media generation.`;

export function editorPresetCatalog(
  styles: EditorSavedStyle[] = [],
  personalTransitions: TransitionPreset[] = [],
  direction?: string
) {
  const words = (s: string) => s.normalize("NFKC").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const normalized = " " + words(direction ?? "") + " ";
  // When the creator names a numbered template, the model needs its complete
  // bindings. The other variants in that family need only discovery entries.
  const requested = new Set<string>();
  const families = new Set<string>();
  const family = (name: string) => words(name).match(/^(.+) \d+$/)?.[1];
  const compact = new Set<string>();
  const siblings = new Set<string>();
  if (direction !== undefined) {
    for (const p of GRAPHIC_PRESETS) {
      const series = family(p.name);
      if (p.graphic.native && series && (normalized.includes(" " + words(p.name) + " ") ||
          normalized.includes(" " + words(p.id) + " "))) {
        requested.add(p.id);
        families.add(series);
      }
    }
    for (const p of GRAPHIC_PRESETS) {
      const t = nativeGraphicTemplate(p.graphic.native?.id);
      if (!t || requested.has(t.id)) continue;
      if (families.has(family(p.name) ?? "")) siblings.add(t.id);
      else if (t.platform && !normalized.includes(" " + t.platform.toLowerCase() + " ") &&
          !(t.platform === "X" && normalized.includes(" twitter ")) && !direction.includes(t.id))
        compact.add(t.id);
    }
  }
  return {
    // Every social design remains discoverable by exact ID. Expand the repeated
    // layout/placement evidence only for platforms actually named in the brief.
    ...(compact.size ? { otherSocialGraphics: {
      usage: "Only for a supplied account on the named platform. A profile also requires a supplied call to action. Place in clear space.",
      variants: GRAPHIC_PRESETS.filter(p => compact.has(p.id)).map(p => [p.id, p.name]),
    }} : {}),
    ...(siblings.size ? { otherNumberedVariants: GRAPHIC_PRESETS
      .filter(p => siblings.has(p.id)).map(p => [p.id, p.name]) } : {}),
    graphics: GRAPHIC_PRESETS.filter(p => !compact.has(p.id) && !siblings.has(p.id)).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      duration: p.duration,
      design: graphicDesignEvidence(p.graphic, p.duration),
    })),
    looks: CLIP_LOOK_PRESETS.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      settings: p.settings,
    })),
    captions: CAPTION_PRESETS.map(p => ({ ...p })),
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
          title: "Heading",
          subtitle: "Supporting line",
          accent: "#8B7CF8",
          seconds: kit.seconds,
          value: 50,
        },
        [],
        0,
        "catalog"
      ).map(layer => {
        const slot = Number(layer.id.slice("catalog-".length));
        const graphic = layer.graphic!;
        return {
          presetId: `motion:${kit.id}:${slot}`,
          ...(kit.id === "statistic" && slot === 1
            ? { includeWhen: "kitSubtitle is nonempty" }
            : {}),
          contentBindings: {
            ...(graphic.text === "Heading" ? { text: "kitTitle" } : {}),
            ...(graphic.text === "Supporting line"
              ? { text: "kitSubtitle" }
              : {}),
            ...(graphic.secondaryText === "Heading"
              ? { secondaryText: "kitTitle" }
              : {}),
            ...(graphic.secondaryText === "Supporting line"
              ? { secondaryText: "kitSubtitle" }
              : {}),
            ...(kit.id === "statistic" && slot === 0
              ? { to: "kitValue", suffix: "%" }
              : {}),
          },
          design: graphicDesignEvidence(graphic, kit.seconds),
        };
      }),
    })),
    personal: normalizeEditorSavedStyles(styles).map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      ...(s.type === "graphic"
        ? {
            duration: s.graphicDuration,
            design: graphicDesignEvidence(s.graphic, s.graphicDuration),
          }
        : {}),
      ...(s.type === "look" ? { settings: s.settings } : {}),
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
    if (kit && (typeof params.kitTitle !== "string" || !params.kitTitle.trim()))
      throw new PresetContentError(
        "Supply an actual title for this motion kit."
      );
    if (
      kit?.id === "statistic" &&
      (typeof params.kitValue !== "number" || !Number.isFinite(params.kitValue))
    )
      throw new PresetContentError(
        "Supply the measured percentage for this motion kit."
      );
    const kitLayer =
      kit && motionId
        ? motionKitClips(
            {
              kit: kit.id,
              title: typeof params.kitTitle === "string" ? params.kitTitle : "",
              subtitle:
                typeof params.kitSubtitle === "string"
                  ? params.kitSubtitle
                  : "",
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
          ).find(layer => layer.id === `resolved-${Number(motionId[2])}`)
            ?.graphic
        : undefined;
    const graphic = kit
      ? kitLayer
      : personal?.type === "graphic"
        ? personal.graphic
        : GRAPHIC_PRESETS.find(p => p.id === params.presetId)?.graphic;
    if (!graphic) {
      if (kit?.id === "statistic" && motionId?.[2] === "1")
        throw new PresetContentError(
          "The graphic preset layer needs its optional content."
        );
      throw new Error("The graphic preset is no longer available.");
    }
    for (const key of ["kitTitle", "kitSubtitle", "kitAccent", "kitValue"])
      delete overrides[key];
    return {
      ...operation,
      parameters: {
        ...overrides,
        graphic: kit
          ? {
              ...graphic,
              ...(params.graphic && typeof params.graphic === "object"
                ? params.graphic
                : {}),
            }
          : instantiateGraphicPreset(
              graphic,
              params.graphic &&
                typeof params.graphic === "object" &&
                !Array.isArray(params.graphic)
                ? (params.graphic as Record<string, unknown>)
                : {}
            ),
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
