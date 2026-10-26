import { useId } from "react";
import type { EditStyleProfile } from "@contracts/edit-style-template";
import type { EditorSavedStyle } from "@contracts/editor-style-library";
import { colorGradeMatrix, colorToneTable } from "@/lib/color-grade";
import { useUiText } from "@/lib/i18n/ui";
import {
  StyleRange,
  StyleSection,
  StyleSelect,
  StyleToggle,
} from "./StyleFields";

type Grade = NonNullable<EditStyleProfile["grade"]>;
type Look = Extract<EditorSavedStyle, { type: "look" }>["settings"];
const fields = [
  ["exposure", "Exposure", -2, 2, 0],
  ["temperature", "Temperature", -1, 1, 0],
  ["tint", "Tint", -1, 1, 0],
  ["brightness", "Brightness", -0.5, 0.5, 0],
  ["contrast", "Contrast", 0.5, 2, 1],
  ["saturation", "Saturation", 0, 3, 1],
  ["highlights", "Highlights", -1, 1, 0],
  ["shadows", "Shadows", -1, 1, 0],
  ["whites", "Whites", -1, 1, 0],
  ["blacks", "Blacks", -1, 1, 0],
] as const;

export function GradeStyleFields({
  value,
  onChange,
}: {
  value: Grade;
  onChange(value: Grade): void;
}) {
  const ui = useUiText();
  const filterId = useId().replace(/:/g, "");
  const tone = colorToneTable(value).join(" ");
  return (
    <div className="space-y-4">
      <svg aria-hidden="true" className="absolute h-0 w-0">
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values={colorGradeMatrix(value).join(" ")}
            />
            <feComponentTransfer>
              <feFuncR type="table" tableValues={tone} />
              <feFuncG type="table" tableValues={tone} />
              <feFuncB type="table" tableValues={tone} />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>
      <div className="overflow-hidden rounded-lg border border-border">
        <div
          className="grid h-28 grid-cols-6"
          style={{ filter: `url(#${filterId})` }}
        >
          {[
            "#334852",
            "#83A4A7",
            "#D8C19E",
            "#B87559",
            "#54734C",
            "#EFE4CF",
          ].map(color => (
            <div key={color} style={{ background: color }} />
          ))}
        </div>
        <p className="bg-background p-2 text-center text-[11px] text-muted-foreground">
          {ui("Color preview")}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        {fields.map(([key, label, min, max, fallback]) => (
          <StyleRange
            key={key}
            label={ui(label)}
            value={value[key] ?? fallback}
            min={min}
            max={max}
            step={0.01}
            onChange={number => onChange({ ...value, [key]: number })}
          />
        ))}
      </div>
    </div>
  );
}

export function LookStyleFields({
  value,
  onChange,
}: {
  value: Look;
  onChange(value: Look): void;
}) {
  const ui = useUiText();
  const patchVisual = (patch: Partial<Look["visual"]>) =>
    onChange({ ...value, visual: { ...value.visual, ...patch } });
  return (
    <div className="space-y-4">
      <GradeStyleFields
        value={value}
        onChange={grade => onChange({ ...value, ...grade })}
      />
      <StyleSection title={ui("Framing")}>
        <StyleSelect
          label={ui("Fit")}
          value={value.fit}
          options={[
            { value: "contain", label: "Contain" },
            { value: "cover", label: "Cover" },
          ]}
          onChange={fit => onChange({ ...value, fit: fit as Look["fit"] })}
        />
        <div className="grid grid-cols-2 gap-4">
          {(
            [
              ["x", "Horizontal position", -100, 100, 1],
              ["y", "Vertical position", -100, 100, 1],
              ["scale", "Scale", 0.1, 4, 0.01],
              ["rotation", "Rotation", -720, 720, 1],
              ["opacity", "Opacity", 0, 1, 0.01],
            ] as const
          ).map(([key, label, min, max, step]) => (
            <StyleRange
              key={key}
              label={ui(label)}
              value={value.visual[key]}
              min={min}
              max={max}
              step={step}
              onChange={number => patchVisual({ [key]: number })}
            />
          ))}
        </div>
        <div className="flex gap-4">
          <StyleToggle
            label={ui("Flip horizontally")}
            checked={value.visual.flipX}
            onChange={flipX => patchVisual({ flipX })}
          />
          <StyleToggle
            label={ui("Flip vertically")}
            checked={value.visual.flipY}
            onChange={flipY => patchVisual({ flipY })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {(["top", "right", "bottom", "left"] as const).map(side => (
            <StyleRange
              key={side}
              label={ui(`Crop ${side}`)}
              value={value.visual.crop[side]}
              min={0}
              max={45}
              step={1}
              unit="%"
              onChange={number =>
                patchVisual({ crop: { ...value.visual.crop, [side]: number } })
              }
            />
          ))}
        </div>
      </StyleSection>
    </div>
  );
}
