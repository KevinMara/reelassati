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
  const template = nativeGraphicTemplate(g.native?.id);
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return {
    ...(g.native
      ? {
          template: {
            id: g.native.id,
            description: template?.description,
            design: template?.design,
            platform: template?.platform,
            sizeUnit: "size × 10% of canvas width",
            authoredBounds: template?.bounds,
            enter: g.native.enter,
            exit: g.native.exit,
            // Sample notification text is not evidence about this user's source.
            values: Object.fromEntries(
              Object.entries(g.native.values).filter(
                ([key]) => {
                  const c = template?.controls.find(c => c.key === key);
                  return c && c.type !== "text" && !c.displayedValue;
                }
              )
            ),
            textFields: template?.controls.filter(
                c => c.type === "text" && (c.textSlot ?? 0) >= 2
              )
              .map(c => ({
                key: c.key,
                label: c.displayLabel ?? c.label,
                value: "supply actual copy in native.values",
              })),
            displayedNumbers: template?.controls.filter(c => c.displayedValue)
              .map(c => ({
                key: c.key,
                label: c.label,
                min: c.min,
                max: c.max,
                options: c.options,
              })),
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
  const template = nativeGraphicTemplate(g.native?.id);
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
        ...Object.fromEntries(
          Object.entries(g.native.values).filter(([key]) => {
            const c = template?.controls.find(c => c.key === key);
            return c && c.type !== "text" && !c.displayedValue;
          })
        ),
        ...(supplied.values && typeof supplied.values === "object"
          ? supplied.values
          : {}),
      },
    };
    for (const c of template?.controls ?? []) {
      if (c.displayedValue) {
        const v =
          supplied.values && typeof supplied.values === "object"
            ? (supplied.values as Record<string, unknown>)[c.key]
            : undefined;
        if (
          typeof v !== "number" ||
          !Number.isInteger(v) ||
          v < c.min! ||
          v > c.max!
        )
          throw new PresetContentError(
            "Supply the actual date or count for this graphic preset."
          );
      }
      if (c.type !== "text" || (c.textSlot ?? 0) < 2) continue;
      const value = result.native.values[c.key];
      if (typeof value !== "string" || !value.trim())
        throw new PresetContentError(
          "Supply every text field for this graphic preset."
        );
    }
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
    template?.controls.some(
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
