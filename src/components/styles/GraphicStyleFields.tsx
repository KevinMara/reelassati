import { useState } from "react";
import type { EditorSavedStyle } from "@contracts/editor-style-library";
import {
  GRAPHIC_KINDS,
  normalizeGraphic,
  type MotionGraphic,
} from "@contracts/motion-graphics";
import { MotionGraphicLayer } from "@/components/studio/MotionGraphicLayer";
import { GraphicMotionEditor } from "@/components/studio/GraphicMotionEditor";
import { useUiText } from "@/lib/i18n/ui";
import {
  StyleColor,
  StyleRange,
  StyleSection,
  StyleSelect,
} from "./StyleFields";

type GraphicStyle = Extract<EditorSavedStyle, { type: "graphic" }>;
const kindNames = [
  "Text",
  "Callout",
  "Counter",
  "Countdown",
  "Arrow",
  "Highlight",
  "Rectangle",
  "Ellipse",
  "Star",
  "Line",
  "3D title",
  "3D cube",
  "3D orbit",
];

export function GraphicStyleFields({
  value,
  onChange,
}: {
  value: GraphicStyle;
  onChange(value: GraphicStyle): void;
}) {
  const ui = useUiText();
  const [position, setPosition] = useState(0.5);
  const graphic = value.graphic;
  const patch = (patch: Partial<MotionGraphic>) =>
    onChange({
      ...value,
      graphic: normalizeGraphic({ ...graphic, ...patch })!,
    });
  return (
    <div className="space-y-4">
      <div
        className="relative aspect-video overflow-hidden rounded-lg bg-[#252A32]"
        style={{ containerType: "inline-size" }}
        aria-label={ui("Graphic preview")}
      >
        <MotionGraphicLayer
          clip={{
            id: "style-preview",
            label: value.name,
            track: "overlay",
            start: 0,
            inPoint: 0,
            outPoint: value.graphicDuration,
            duration: value.graphicDuration,
            graphicDuration: value.graphicDuration,
            locked: false,
            color: graphic.background,
            graphic,
          }}
          time={position * Math.max(0, value.graphicDuration - 1 / 30)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <StyleSelect
          label={ui("Graphic type")}
          value={graphic.kind}
          options={GRAPHIC_KINDS.map((kind, index) => ({
            value: kind,
            label: kindNames[index],
          }))}
          onChange={kind => patch({ kind: kind as MotionGraphic["kind"] })}
        />
        <StyleSelect
          label={ui("Graphic composition")}
          value={graphic.composition ?? "plain"}
          options={[
            { value: "plain", label: "Plain title / label" },
            { value: "lower-third", label: "Lower third" },
            { value: "chapter", label: "Chapter marker" },
            { value: "quote", label: "Quote" },
            { value: "statistic", label: "Statistic + explanation" },
            { value: "progress", label: "Progress" },
          ]}
          onChange={composition =>
            patch({ composition: composition as MotionGraphic["composition"] })
          }
        />
      </div>
      <label>
        {ui("Text")}
        <input
          value={graphic.text}
          maxLength={180}
          onChange={event => patch({ text: event.target.value })}
        />
      </label>
      <label>
        {ui("Supporting text")}
        <input
          value={graphic.secondaryText ?? ""}
          maxLength={120}
          onChange={event => patch({ secondaryText: event.target.value })}
        />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <StyleColor
          label={ui("Text color")}
          value={graphic.color}
          onChange={color => patch({ color })}
        />
        <StyleColor
          label={ui("Background color")}
          value={graphic.background}
          onChange={background => patch({ background })}
        />
        <StyleColor
          label={ui("Accent color")}
          value={graphic.accent ?? "#7AF5CF"}
          onChange={accent => patch({ accent })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <StyleRange
          label={ui("Text size")}
          value={graphic.size}
          min={2}
          max={16}
          step={0.1}
          onChange={size => patch({ size })}
        />
        <StyleRange
          label={ui("Graphic duration")}
          value={value.graphicDuration}
          min={1}
          max={180}
          step={0.5}
          unit="s"
          onChange={graphicDuration => onChange({ ...value, graphicDuration })}
        />
      </div>
      <StyleSection title={ui("Layout")}>
        <div className="grid grid-cols-2 gap-4">
          {(
            [
              ["x", "Horizontal position", 10, 90, 50],
              ["y", "Vertical position", 10, 90, 30],
              ["rotation", "Rotation", -720, 720, 0],
              ["width", "Shape width %", 1, 90, 30],
              ["height", "Shape height % of width", 0.2, 60, 12],
              ["padding", "Card padding", 0, 6, 1.5],
              ["cornerRadius", "Corner radius", 0, 6, 0],
              ["strokeWidth", "Stroke width %", 0, 4, 0],
            ] as const
          ).map(([key, label, min, max, fallback]) => (
            <StyleRange
              key={key}
              label={ui(label)}
              value={graphic[key] ?? fallback}
              min={min}
              max={max}
              step={0.1}
              onChange={number => patch({ [key]: number })}
            />
          ))}
        </div>
      </StyleSection>
      {["counter", "countdown"].includes(graphic.kind) && (
        <StyleSection title={ui("Numbers")} open>
          <div className="grid grid-cols-2 gap-4">
            {(["from", "to"] as const).map(key => (
              <label key={key}>
                {ui(key === "from" ? "From" : "To")}
                <input
                  type="number"
                  value={graphic[key]}
                  min={-1e9}
                  max={1e9}
                  onChange={event =>
                    patch({ [key]: Number(event.target.value) })
                  }
                />
              </label>
            ))}
            {(["prefix", "suffix"] as const).map(key => (
              <label key={key}>
                {ui(key === "prefix" ? "Prefix" : "Suffix")}
                <input
                  maxLength={12}
                  value={graphic[key]}
                  onChange={event => patch({ [key]: event.target.value })}
                />
              </label>
            ))}
          </div>
        </StyleSection>
      )}
      {graphic.spatial && (
        <StyleSection title={ui("3D")}>
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                ["pitch", "Pitch", -70, 70, 1],
                ["yaw", "Yaw", -70, 70, 1],
                ["depth", "Depth", 0.02, 0.65, 0.01],
                ["turns", "Turns", -3, 3, 0.1],
                ["perspective", "Perspective", 3, 12, 0.1],
              ] as const
            ).map(([key, label, min, max, step]) => (
              <StyleRange
                key={key}
                label={ui(label)}
                value={graphic.spatial![key]}
                min={min}
                max={max}
                step={step}
                onChange={number =>
                  patch({ spatial: { ...graphic.spatial!, [key]: number } })
                }
              />
            ))}
          </div>
        </StyleSection>
      )}
      <StyleSelect
        label={ui("Graphic animation")}
        value={graphic.animation}
        options={[
          { value: "none", label: "None" },
          { value: "fade", label: "Fade" },
          { value: "pop", label: "Pop" },
          { value: "slide", label: "Slide" },
        ]}
        onChange={animation =>
          patch({ animation: animation as MotionGraphic["animation"] })
        }
      />
      <StyleSection title={ui("Motion path")}>
        <GraphicMotionEditor
          graphic={graphic}
          duration={value.graphicDuration}
          position={position}
          onPosition={setPosition}
          onChange={graphic => onChange({ ...value, graphic })}
        />
      </StyleSection>
    </div>
  );
}
