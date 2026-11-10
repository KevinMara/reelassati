import {
  normalizeCaptionMotion,
  type CaptionMotionSettings,
} from "@contracts/editor-presets";
import { StyleRange, StyleSelect } from "@/components/styles/StyleFields";
import { useUiText } from "@/lib/i18n/ui";

/** Shared by the timeline inspector and reusable style editor. */
export function CaptionMotionFields({
  value,
  onChange,
}: {
  value?: Partial<CaptionMotionSettings>;
  onChange(value: CaptionMotionSettings): void;
}) {
  const ui = useUiText();
  const motion = normalizeCaptionMotion(value);
  const patch = (next: Partial<CaptionMotionSettings>) =>
    onChange({ ...motion, ...next });
  return (
    <details open className="rounded-lg border border-border">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium">
        {ui("Motion controls")}
      </summary>
      <div className="space-y-3 border-t border-border p-3">
        <div className="grid grid-cols-2 gap-3">
          <StyleSelect
            label={ui("Motion recipe")}
            value={motion.recipe}
            onChange={recipe =>
              patch({
                ...normalizeCaptionMotion({
                  recipe: recipe as CaptionMotionSettings["recipe"],
                }),
                anchor: motion.anchor,
                verticalAnchor: motion.verticalAnchor,
              })
            }
            options={[
              { value: "rise", label: "Rise" },
              { value: "pop", label: "Pop" },
              { value: "drift", label: "Drift" },
              { value: "focus", label: "Soft focus" },
              { value: "bounce", label: "Bounce" },
              { value: "sweep", label: "Light sweep" },
            ]}
          />
          <StyleSelect
            label={ui("Animate by")}
            value={motion.unit}
            onChange={unit =>
              patch({ unit: unit as CaptionMotionSettings["unit"] })
            }
            options={[
              { value: "letter", label: "Letter" },
              { value: "word", label: "Word" },
              { value: "line", label: "Line" },
            ]}
          />
          {["rise", "drift", "bounce"].includes(motion.recipe) && (
            <StyleSelect
              label={ui("Direction")}
              value={motion.direction}
              onChange={direction =>
                patch({
                  direction: direction as CaptionMotionSettings["direction"],
                })
              }
              options={[
                { value: "up", label: "Up" },
                { value: "down", label: "Down" },
                { value: "left", label: "Left" },
                { value: "right", label: "Right" },
              ]}
            />
          )}
          <StyleSelect
            label={ui("Easing")}
            value={motion.easing}
            onChange={easing =>
              patch({ easing: easing as CaptionMotionSettings["easing"] })
            }
            options={[
              { value: "smooth", label: "Smooth" },
              { value: "snappy", label: "Snappy" },
              { value: "bounce", label: "Bounce" },
              { value: "linear", label: "Linear" },
            ]}
          />
          <StyleSelect
            label={ui("Text anchor")}
            value={motion.anchor}
            onChange={anchor =>
              patch({ anchor: anchor as CaptionMotionSettings["anchor"] })
            }
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ]}
          />
          <StyleSelect
            label={ui("Vertical anchor")}
            value={motion.verticalAnchor}
            onChange={verticalAnchor =>
              patch({
                verticalAnchor:
                  verticalAnchor as CaptionMotionSettings["verticalAnchor"],
              })
            }
            options={[
              { value: "auto", label: "Follow caption position" },
              { value: "top", label: "Top" },
              { value: "center", label: "Center" },
              { value: "bottom", label: "Bottom" },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StyleRange
            label={ui("Motion amount")}
            value={motion.amount}
            min={0}
            max={2}
            step={0.05}
            onChange={amount => patch({ amount })}
          />
          <StyleRange
            label={ui("Duration")}
            value={motion.duration}
            min={0.08}
            max={1.5}
            step={0.01}
            unit="s"
            onChange={duration => patch({ duration })}
          />
          <StyleRange
            label={ui("Entrance delay")}
            value={motion.delay}
            min={0}
            max={0.5}
            step={0.01}
            unit="s"
            onChange={delay => patch({ delay })}
          />
          {motion.unit === "letter" && (
            <StyleRange
              label={ui("Letter stagger")}
              value={motion.stagger}
              min={0}
              max={0.12}
              step={0.005}
              unit="s"
              onChange={stagger => patch({ stagger })}
            />
          )}
          <StyleRange
            label={ui("Entrance blur")}
            value={motion.blur}
            min={0}
            max={1.2}
            step={0.05}
            onChange={blur => patch({ blur })}
          />
          <StyleRange
            label={ui("Glow")}
            value={motion.glow}
            min={0}
            max={1.2}
            step={0.05}
            onChange={glow => patch({ glow })}
          />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {ui(
            "Entrances fit the measured speech. Faster words shorten duration, delay and letter stagger. Text remains readable after it settles."
          )}
        </p>
      </div>
    </details>
  );
}
