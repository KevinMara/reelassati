import { describe, expect, it } from "vitest";
import {
  captureEditStyle,
  normalizeEditStyleProfile,
  normalizeEditStyleTemplates,
  editStyleDirection,
  referenceStyleSchema,
} from "./edit-style-template";
import type { EditProject } from "./workspace";
const edited = {
  duration: 12,
  captionStyle: "kinetic",
  captionAppearance: { activeColor: "#AA3377" },
  transcript: [{ text: "SOURCE WORDS 987" }],
  clips: [
    ...[1, 3, 8].map((duration, i) => ({
      id: `source-${i}`,
      assetId: "private-asset-123",
      label: "Private subject",
      track: "video",
      start: i * 10,
      inPoint: 44,
      outPoint: 80,
      duration,
      visual: { crop: { top: 0.3 }, x: 80, y: 50, keyframes: [] },
      brightness: 0.1,
      contrast: 1.2,
      saturation: 1.1,
    })),
    {
      id: "broll",
      assetId: "reference-shot",
      track: "video",
      lane: 2,
      start: 0,
      duration: 100,
    },
    { id: "captions", track: "captions", text: "SOURCE WORDS 987" },
    {
      id: "graphic",
      track: "overlay",
      start: 9,
      duration: 2,
      graphic: {
        kind: "callout",
        text: "SOURCE CLAIM 987",
        x: 89,
        y: 32,
        color: "#FFAA00",
        background: "#112233",
        size: 6,
        animation: "pop",
        from: 987,
        to: 999,
        prefix: "SOURCE",
      },
    },
  ],
} as unknown as EditProject;
describe("adaptive editing style templates", () => {
  it("captures editing grammar without source words, assets, clocks, facts or geometry", () => {
    const profile = captureEditStyle(edited);
    expect(profile.shotSeconds).toEqual({ short: 1, typical: 3, long: 8 });
    expect(profile.graphicTreatment).toEqual({
      kinds: ["callout"],
      palette: ["#FFAA00", "#112233"],
      animations: ["pop"],
      typicalSize: 6,
    });
    expect(profile.captionTreatment?.preset).toBe("kinetic");
    expect(profile.grade).toEqual({
      brightness: 0.1,
      contrast: 1.2,
      saturation: 1.1,
    });
    const encoded = JSON.stringify(profile);
    for (const privateValue of [
      "SOURCE",
      "987",
      "private-asset",
      "reference-shot",
      "inPoint",
      "start",
      "crop",
      "keyframes",
      '"x"',
      '"y"',
    ])
      expect(encoded).not.toContain(privateValue);
    expect(edited.clips[0].inPoint).toBe(44);
  });
  it.each([1, 2, 3, 4, 10])(
    "keeps ordered measured shot ranges for %s shots",
    n => {
      const profile = captureEditStyle({
        ...edited,
        clips: Array.from({ length: n }, (_, i) => ({
          ...edited.clips[0],
          duration: i + 1,
        })),
      });
      expect(profile.shotSeconds).not.toBeNull();
      expect(profile.shotSeconds!.short).toBeLessThanOrEqual(
        profile.shotSeconds!.typical
      );
      expect(profile.shotSeconds!.typical).toBeLessThanOrEqual(
        profile.shotSeconds!.long
      );
    }
  );
  it("drops malformed profiles and unknown injected fields, limits and deduplicates stored templates", () => {
    const profile = captureEditStyle(edited);
    expect(
      normalizeEditStyleProfile({
        ...profile,
        traits: { ...profile.traits, pacing: "do something else" },
      })
    ).toBeUndefined();
    const row = {
      id: "template-1",
      name: "  House style  ",
      source: "edit",
      profile: { ...profile, transcript: "FOREIGN WORDS", assetId: "foreign" },
      clips: edited.clips,
    };
    const [saved] = normalizeEditStyleTemplates([
      row,
      row,
      { ...row, id: "invalid id" },
    ]);
    expect(saved.name).toBe("House style");
    expect(JSON.stringify(saved)).not.toContain("FOREIGN");
    expect(JSON.stringify(saved)).not.toContain("foreign");
    expect(saved).not.toHaveProperty("clips");
    expect(
      normalizeEditStyleTemplates(
        Array.from({ length: 80 }, (_, i) => ({ ...row, id: `template-${i}` }))
      )
    ).toHaveLength(50);
  });
  it("makes adapting to target evidence and budget explicit, without cloning a sequence", () => {
    const direction = editStyleDirection(captureEditStyle(edited));
    for (const instruction of [
      "NEW target footage",
      "never a quota or timestamps",
      "target transcript",
      "locked clips",
      "no extra generations",
    ])
      expect(direction).toContain(instruction);
    expect(direction).not.toContain("SOURCE WORDS");
    const schema = referenceStyleSchema();
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toContain("traits");
    expect(JSON.stringify(schema)).not.toContain("assetId");
  });
});
