import {
  EDIT_STYLE_TRAIT_CHOICES,
  type EditStyleProfile,
  type EditStyleTraits,
} from "@contracts/edit-style-template";
import { GRAPHIC_KINDS, type MotionGraphic } from "@contracts/motion-graphics";
import { editingTraitLabel } from "@/lib/i18n/locales/ui-edit-template-traits";
import { useUiText } from "@/lib/i18n/ui";
import { CaptionStyleFields } from "./CaptionStyleFields";
import { GradeStyleFields } from "./LookStyleFields";
import {
  StyleColor,
  StyleRange,
  StyleSection,
  StyleSelect,
  StyleToggle,
} from "./StyleFields";

export function EditingLanguageFields({
  value,
  onChange,
}: {
  value: EditStyleProfile;
  onChange(value: EditStyleProfile): void;
}) {
  const ui = useUiText();
  const patch = (patch: Partial<EditStyleProfile>) =>
    onChange({ ...value, ...patch });
  const graphic = value.graphicTreatment;
  const patchGraphic = (
    change: Partial<NonNullable<EditStyleProfile["graphicTreatment"]>>
  ) => graphic && patch({ graphicTreatment: { ...graphic, ...change } });
  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        {ui("Define the rhythm and visual language for your next edits.")}
      </p>
      <div className="grid grid-cols-2 gap-4">
        {(
          Object.keys(EDIT_STYLE_TRAIT_CHOICES) as Array<keyof EditStyleTraits>
        ).map(key => (
          <StyleSelect
            key={key}
            label={ui(editingTraitLabel(key))}
            value={value.traits[key]}
            options={EDIT_STYLE_TRAIT_CHOICES[key].map(option => ({
              value: option,
              label: editingTraitLabel(option),
            }))}
            onChange={next =>
              patch({ traits: { ...value.traits, [key]: next } })
            }
          />
        ))}
      </div>
      <StyleSection title={ui("Pacing")}>
        <StyleToggle
          label={ui("Set shot duration guidance")}
          checked={Boolean(value.shotSeconds)}
          onChange={enabled =>
            patch({
              shotSeconds: enabled ? { short: 1, typical: 3, long: 6 } : null,
            })
          }
        />
        {value.shotSeconds && (
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["short", "Short shot"],
                ["typical", "Typical shot"],
                ["long", "Long shot"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {ui(label)}
                <input
                  type="number"
                  min={0.1}
                  max={180}
                  step={0.1}
                  value={value.shotSeconds![key]}
                  onChange={event => {
                    const next = Math.min(
                      180,
                      Math.max(0.1, Number(event.target.value))
                    );
                    const shot = { ...value.shotSeconds!, [key]: next };
                    if (key === "short") {
                      shot.typical = Math.max(shot.typical, next);
                      shot.long = Math.max(shot.long, shot.typical);
                    }
                    if (key === "typical") {
                      shot.short = Math.min(shot.short, next);
                      shot.long = Math.max(shot.long, next);
                    }
                    if (key === "long") {
                      shot.typical = Math.min(shot.typical, next);
                      shot.short = Math.min(shot.short, shot.typical);
                    }
                    patch({ shotSeconds: shot });
                  }}
                />
              </label>
            ))}
          </div>
        )}
        <StyleToggle
          label={ui("Set graphics frequency")}
          checked={value.graphicsPerMinute !== null}
          onChange={enabled => patch({ graphicsPerMinute: enabled ? 4 : null })}
        />
        {value.graphicsPerMinute !== null && (
          <StyleRange
            label={ui("Graphics per minute")}
            value={value.graphicsPerMinute}
            min={0}
            max={120}
            onChange={graphicsPerMinute => patch({ graphicsPerMinute })}
          />
        )}
      </StyleSection>
      <StyleSection title={ui("Captions")}>
        <StyleToggle
          label={ui("Include caption treatment")}
          checked={Boolean(value.captionTreatment)}
          onChange={enabled =>
            patch({
              captionTreatment: enabled
                ? { preset: "classic", appearance: {} }
                : undefined,
            })
          }
        />
        {value.captionTreatment && (
          <CaptionStyleFields
            preset={value.captionTreatment.preset}
            appearance={value.captionTreatment.appearance}
            onChange={(preset, appearance) =>
              patch({ captionTreatment: { preset, appearance } })
            }
          />
        )}
      </StyleSection>
      <StyleSection title={ui("Graphics")}>
        <StyleToggle
          label={ui("Include graphic treatment")}
          checked={Boolean(graphic)}
          onChange={enabled =>
            patch({
              graphicTreatment: enabled
                ? {
                    kinds: ["text"],
                    palette: ["#FFFFFF", "#6F5AD8"],
                    animations: ["fade"],
                    compositions: ["plain"],
                    typicalSize: 7,
                  }
                : undefined,
            })
          }
        />
        {graphic && (
          <>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-xs text-muted-foreground">
                {ui("Graphic type")} · {graphic.kinds.length}/8
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {GRAPHIC_KINDS.map(kind => (
                  <StyleToggle
                    key={kind}
                    label={ui(
                      kind === "spatial-title"
                        ? "3D title"
                        : kind === "spatial-cube"
                          ? "3D cube"
                          : kind === "spatial-orbit"
                            ? "3D orbit"
                            : kind.charAt(0).toUpperCase() + kind.slice(1)
                    )}
                    checked={graphic.kinds.includes(kind)}
                    disabled={
                      graphic.kinds.length >= 8 && !graphic.kinds.includes(kind)
                    }
                    onChange={enabled =>
                      patchGraphic({
                        kinds: enabled
                          ? [...graphic.kinds, kind].slice(0, 8)
                          : graphic.kinds.filter(item => item !== kind),
                      })
                    }
                  />
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-3 gap-3">
              {graphic.palette.map((color, index) => (
                <div key={index} className="space-y-1">
                  <StyleColor
                    label={ui(
                      index === 0
                        ? "Text color"
                        : index === 1
                          ? "Background color"
                          : "Accent color"
                    )}
                    value={color}
                    onChange={value =>
                      patchGraphic({
                        palette: graphic.palette.map((item, at) =>
                          at === index ? value : item
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      patchGraphic({
                        palette: graphic.palette.filter(
                          (_, at) => at !== index
                        ),
                      })
                    }
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    {ui("Remove")}
                  </button>
                </div>
              ))}
            </div>
            {graphic.palette.length < 5 && (
              <button
                type="button"
                onClick={() =>
                  patchGraphic({ palette: [...graphic.palette, "#7AF5CF"] })
                }
                className="rounded-md border border-border px-3 py-2 text-xs"
              >
                {ui("Add color")}
              </button>
            )}
            <StyleRange
              label={ui("Text size")}
              value={graphic.typicalSize}
              min={2}
              max={16}
              step={0.1}
              onChange={typicalSize => patchGraphic({ typicalSize })}
            />
            <fieldset>
              <legend className="mb-2 text-xs text-muted-foreground">
                {ui("Graphic animation")}
              </legend>
              <div className="flex flex-wrap gap-4">
                {["none", "fade", "pop", "slide"].map(animation => (
                  <StyleToggle
                    key={animation}
                    label={ui(
                      animation.charAt(0).toUpperCase() + animation.slice(1)
                    )}
                    checked={graphic.animations.includes(animation)}
                    onChange={enabled =>
                      patchGraphic({
                        animations: enabled
                          ? [...graphic.animations, animation]
                          : graphic.animations.filter(
                              item => item !== animation
                            ),
                      })
                    }
                  />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-xs text-muted-foreground">
                {ui("Graphic composition")}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    "plain",
                    "lower-third",
                    "chapter",
                    "quote",
                    "statistic",
                    "progress",
                  ] as Array<NonNullable<MotionGraphic["composition"]>>
                ).map(composition => (
                  <StyleToggle
                    key={composition}
                    label={ui(
                      {
                        plain: "Plain title / label",
                        "lower-third": "Lower third",
                        chapter: "Chapter marker",
                        quote: "Quote",
                        statistic: "Statistic + explanation",
                        progress: "Progress",
                      }[composition]
                    )}
                    checked={Boolean(
                      graphic.compositions?.includes(composition)
                    )}
                    onChange={enabled =>
                      patchGraphic({
                        compositions: enabled
                          ? [...(graphic.compositions ?? []), composition]
                          : graphic.compositions?.filter(
                              item => item !== composition
                            ),
                      })
                    }
                  />
                ))}
              </div>
            </fieldset>
          </>
        )}
      </StyleSection>
      <StyleSection title={ui("Color / look")}>
        <StyleToggle
          label={ui("Include color treatment")}
          checked={Boolean(value.grade)}
          onChange={enabled =>
            patch({
              grade: enabled
                ? { brightness: 0, contrast: 1, saturation: 1 }
                : undefined,
            })
          }
        />
        {value.grade && (
          <GradeStyleFields
            value={value.grade}
            onChange={grade => patch({ grade })}
          />
        )}
      </StyleSection>
    </div>
  );
}
