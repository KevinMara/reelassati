import { describe, expect, it } from "vitest";
import {
  captureEditBlueprint,
  normalizeEditBlueprint,
  blueprintDesign,
  resolveBlueprintOperations,
} from "./edit-template-blueprint";
import {
  captureEditStyle,
  normalizeEditStyleTemplate,
  editTemplateDirection,
} from "./edit-style-template";
import type { EditProject } from "./workspace";
const project = {
  aspectRatio: "9:16",
  duration: 10,
  frameRate: 30,
  captionStyle: "clean",
  captionAppearance: { color: "#AACCEE", size: 7 },
  clips: [
    {
      id: "footage",
      assetId: "private-source",
      label: "Private name",
      track: "video",
      start: 0,
      duration: 10,
      inPoint: 3,
      outPoint: 13,
      locked: false,
      color: "#AA00BB",
      exposure: 0.23,
      visual: {
        x: 0,
        y: 0,
        scale: 1.2,
        rotation: 3,
        opacity: 0.9,
        keyframes: [{ at: 0.3, scale: 1.5 }],
        entrance: { kind: "wipe-left", duration: 0.45 },
      },
    },
    {
      id: "graphic",
      track: "overlay",
      label: "SOURCE CLAIM",
      start: 2,
      duration: 4,
      inPoint: 0,
      outPoint: 4,
      locked: false,
      color: "#123456",
      graphic: {
        kind: "callout",
        text: "SOURCE CLAIM",
        secondaryText: "PRIVATE 99",
        size: 6,
        x: 29,
        y: 43,
        color: "#FEDCBA",
        background: "#123456",
        accent: "#ABCDEF",
        animation: "slide",
        width: 34,
        cornerRadius: 1.2,
        motion: [{ at: 0.5, scale: 1.2, x: 30, y: 40, opacity: 0.8 }],
      },
    },
  ],
  transcript: [{ id: "s", start: 0, end: 2, text: "PRIVATE WORDS" }],
  trackSettings: [{ track: "video", lane: 1, volume: 0.8 }],
  storyBeats: [{ id: "hook", title: "PRIVATE TITLE", start: 0, end: 2 }],
} as unknown as EditProject;
describe("exact editing template archive", () => {
  it("round-trips every native edit detail independently of later project edits", () => {
    const blueprint = captureEditBlueprint(project);
    const template = normalizeEditStyleTemplate({
      id: "saved",
      name: "Exact design",
      source: "edit",
      profile: captureEditStyle(project),
      blueprint,
      referenceAssetId: "rendered-video",
    })!;
    expect(template.blueprint).toEqual(blueprint);
    expect(template.referenceAssetId).toBe("rendered-video");
    blueprint.clips[0].exposure = 1;
    expect(template.blueprint!.clips[0].exposure).toBe(0.23);
    expect(template.blueprint!.transcript).toEqual(project.transcript);
    expect(template.blueprint!.trackSettings).toEqual(project.trackSettings);
  });
  it("shares exact design with the planner without copying source words or assets", () => {
    const design = JSON.stringify(
      blueprintDesign(captureEditBlueprint(project))
    );
    for (const privateText of [
      "PRIVATE",
      "SOURCE CLAIM",
      "private-source",
      "Private name",
    ])
      expect(design).not.toContain(privateText);
    expect(design).toContain('"cornerRadius":1.2');
    expect(design).toContain('"templateClipId":"layer-1"');
    const direction = editTemplateDirection({
      id: "t",
      name: "t",
      source: "edit",
      profile: captureEditStyle(project),
      blueprint: captureEditBlueprint(project),
    });
    expect(direction).toContain("exact design values");
  });
  it("resolves graphic layers exactly while accepting only new content", () => {
    const result = resolveBlueprintOperations(
      [
        {
          type: "graphic",
          start: 7,
          end: 9,
          parameters: {
            templateClipId: "layer-1",
            graphic: {
              text: "NEW WORDS",
              secondaryText: "New evidence",
              color: "#000000",
              x: 77,
            },
          },
        },
      ],
      captureEditBlueprint(project)
    ) as Array<{
      start: number;
      parameters: { graphic: Record<string, unknown> };
    }>;
    expect(result[0].start).toBe(7);
    expect(result[0].parameters.graphic).toMatchObject({
      text: "NEW WORDS",
      secondaryText: "New evidence",
      color: "#FEDCBA",
      x: 29,
      cornerRadius: 1.2,
      motion: project.clips[1].graphic!.motion,
    });
    expect(JSON.stringify(result)).not.toContain("SOURCE CLAIM");
  });
  it("keeps the look and motion while allowing new-subject framing", () => {
    const result = resolveBlueprintOperations(
      [
        {
          type: "style",
          parameters: {
            templateClipId: "layer-0",
            exposure: 0.8,
            visual: { x: 8, scale: 1.4, rotation: 50 },
          },
        },
      ],
      captureEditBlueprint(project)
    ) as Array<{ parameters: Record<string, unknown> }>;
    expect(result[0].parameters).toMatchObject({
      exposure: 0.23,
      visual: {
        x: 8,
        scale: 1.4,
        rotation: 3,
        keyframes: project.clips[0].visual!.keyframes,
      },
    });
  });
  it("rejects malformed archives instead of silently claiming a full save", () => {
    expect(
      normalizeEditBlueprint({
        ...captureEditBlueprint(project),
        frameRate: "30",
      })
    ).toBeUndefined();
    expect(
      normalizeEditBlueprint({
        ...captureEditBlueprint(project),
        captionStyle: { unexpected: true },
      })
    ).toBeUndefined();
    expect(
      normalizeEditBlueprint({
        ...captureEditBlueprint(project),
        duration: Infinity,
      })
    ).toBeUndefined();
    expect(
      normalizeEditStyleTemplate({
        id: "bad",
        name: "bad",
        source: "edit",
        profile: captureEditStyle(project),
        blueprint: { version: 99 },
      })
    ).toBeUndefined();
  });
});
