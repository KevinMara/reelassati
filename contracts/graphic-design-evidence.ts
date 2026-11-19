import { graphicFrame, type MotionGraphic } from "./motion-graphics";
import { nativeGraphicTemplate } from "./native-graphics";

const TEXT_KINDS = new Set(["text", "callout", "spatial-title"]);

export class PresetContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PresetContentError";
  }
}

/** Structural design evidence, never a saved source's copy or measured values.
 * Pose samples use the renderer's clock and easing. They aid selection; the
 * original full curve remains authoritative when the preset is instantiated.
 */
export function graphicDesignEvidence(g: MotionGraphic, duration: number) {
  const numeric = g.kind === "counter";
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return {
    ...(g.native
      ? {
          template: {
            id: g.native.id,
            description: nativeGraphicTemplate(g.native.id)?.description,
            design: nativeGraphicTemplate(g.native.id)?.design,
            platform: nativeGraphicTemplate(g.native.id)?.platform,
            sizeUnit: "size × 10% of canvas width",
            authoredBounds: nativeGraphicTemplate(g.native.id)?.bounds,
            enter: g.native.enter,
            exit: g.native.exit,
            values: g.native.values,
          },
        }
      : {}),
    kind: g.kind,
    composition: g.composition ?? "plain",
    layout: {
      x: g.x,
      y: g.y,
      size: g.size,
      ...(g.width !== undefined ? { width: g.width } : {}),
      ...(g.height !== undefined ? { height: g.height } : {}),
      ...(g.rotation ? { rotation: g.rotation } : {}),
      ...(g.padding !== undefined ? { padding: g.padding } : {}),
      ...(g.cornerRadius !== undefined ? { cornerRadius: g.cornerRadius } : {}),
      ...(g.strokeWidth !== undefined ? { strokeWidth: g.strokeWidth } : {}),
    },
    palette: {
      color: g.color,
      background: g.background,
      ...(g.accent ? { accent: g.accent } : {}),
    },
    animation: g.animation,
    ...(g.motion?.length
      ? {
          motion: {
            keyframeCount: g.motion.length,
            easing: [
              ...new Set(
                g.motion.slice(0, -1).map(point => point.easing ?? "linear")
              ),
            ],
            // Fixed-size samples prevent a 120-keyframe personal preset from
            // expanding the planner input by its entire source animation.
            poseColumns: ["progress", "x", "y", "scale", "rotation", "opacity"],
            poses: [0, 0.18, 0.5, 0.82, 1].map(progress => {
              const pose = graphicFrame(
                g,
                progress * Math.max(1 / 30, duration - 1 / 30),
                duration,
                false
              );
              return [
                progress,
                pose.x,
                pose.y,
                pose.scale,
                pose.rotation,
                pose.opacity,
              ].map(round);
            }),
          },
        }
      : {}),
    ...(g.spatial ? { spatial: g.spatial } : {}),
    content: {
      ...(TEXT_KINDS.has(g.kind) ? { text: "supply" } : {}),
      ...(g.secondaryText
        ? { secondaryText: g.native ? "supply second line" : "optional" }
        : {}),
      ...(numeric
        ? { from: "supply measured value", to: "supply measured value" }
        : {}),
      ...(g.kind === "countdown"
        ? { countdown: "counts clip duration in seconds" }
        : {}),
    },
  };
}

/** A reusable design supplies appearance, not facts or sample copy. */
export function instantiateGraphicPreset(
  g: MotionGraphic,
  overrides: Record<string, unknown>
) {
  const result = {
    ...g,
    text: "",
    secondaryText: "",
    prefix: "",
    suffix: "",
    ...overrides,
  };
  if (g.native) {
    const supplied =
      overrides.native && typeof overrides.native === "object"
        ? (overrides.native as Record<string, unknown>)
        : {};
    result.native = {
      ...g.native,
      ...supplied,
      id: g.native.id,
      values: {
        ...g.native.values,
        ...(supplied.values && typeof supplied.values === "object"
          ? supplied.values
          : {}),
      },
    };
  }
  const kind = typeof overrides.kind === "string" ? overrides.kind : g.kind;
  if (
    TEXT_KINDS.has(kind) &&
    (typeof overrides.text !== "string" || !overrides.text.trim())
  )
    throw new PresetContentError(
      "Supply the actual text for this graphic preset."
    );
  if (
    g.native &&
    nativeGraphicTemplate(g.native.id)?.controls.some(
      c => c.type === "text" && c.textSlot === 1
    ) &&
    (typeof overrides.secondaryText !== "string" ||
      !overrides.secondaryText.trim())
  )
    throw new PresetContentError(
      "Supply both text lines for this graphic preset."
    );
  if (
    kind === "counter" &&
    (typeof overrides.from !== "number" ||
      !Number.isFinite(overrides.from) ||
      typeof overrides.to !== "number" ||
      !Number.isFinite(overrides.to))
  )
    throw new PresetContentError(
      "Supply the measured start and end values for this graphic preset."
    );
  return result;
}
