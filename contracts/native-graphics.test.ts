import { describe, it, expect } from "vitest";
import { normalizeGraphic } from "./motion-graphics";
import {
  NATIVE_GRAPHIC_TEMPLATES,
  nativeGraphicSourceTime,
  nativeTextValue,
} from "./native-graphics";
import { GRAPHIC_PRESETS } from "./editor-presets";
import { instantiateGraphicPreset } from "./graphic-design-evidence";
import { normalizeEditorChatState } from "./editor-chat-state";
import { graphicReadabilityProblems } from "./graphic-readability";
import type { TimelineClip } from "./workspace";

const template = NATIVE_GRAPHIC_TEMPLATES.find(
  t => t.name === "Stacked outline"
)!;
describe("editable native graphic contract", () => {
  it("requires real copy for each displayed field and preserves it through save and reload", () => {
    const card = NATIVE_GRAPHIC_TEMPLATES.find(
      t =>
        t.category === "notification" && t.controls.some(c => c.textSlot === 2)
    )!;
    const preset = GRAPHIC_PRESETS.find(p => p.id === card.id)!;
    const fields = card.controls.filter(
      c => c.type === "text" && (c.textSlot ?? 0) >= 2
    );
    const copy = { text: "Your request", secondaryText: "Confirmed" };
    expect(() => instantiateGraphicPreset(preset.graphic, copy)).toThrow(
      "every text field"
    );
    const values = Object.fromEntries(
      fields.map(c => [c.key, "Tuesday\n18:00"])
    );
    const saved = instantiateGraphicPreset(preset.graphic, {
      ...copy,
      native: { values },
    });
    const reopened = normalizeGraphic(JSON.parse(JSON.stringify(saved)))!;
    expect(fields.map(c => nativeTextValue(c, reopened))).toEqual(
      fields.map(() => "Tuesday\n18:00")
    );
  });
  it("keeps executable templates restricted to the reviewed catalog", () => {
    expect(
      normalizeGraphic({
        kind: "text",
        native: { id: "https://example.com/project" },
      })
    ).toBeUndefined();
    expect(
      normalizeGraphic({ kind: "rectangle", native: { id: template.id } })
    ).toBeUndefined();
    const result = normalizeGraphic({
      kind: "text",
      text: "REEL",
      native: {
        id: template.id,
        values: { expression: "fetch(secret)", unknown: 200 },
        enter: -4,
        exit: Infinity,
      },
    })!;
    expect(result.native).toEqual({
      id: template.id,
      values: {},
      enter: 0.1,
      exit: 0.45,
    });
  });
  it("retains authored entrance, hold and exit clocks for a short title and split source time", () => {
    const settings = { id: template.id, values: {}, enter: 0.6, exit: 0.4 };
    expect(nativeGraphicSourceTime(template, settings, 0, 4)).toBe(0);
    expect(nativeGraphicSourceTime(template, settings, 0.6, 4)).toBeCloseTo(
      template.entranceEnd
    );
    expect(nativeGraphicSourceTime(template, settings, 3.6, 4)).toBeCloseTo(
      template.staticHold ? template.entranceEnd : template.exitStart
    );
    expect(nativeGraphicSourceTime(template, settings, 4, 4)).toBeCloseTo(
      template.duration
    );
    const clocks = Array.from({ length: 121 }, (_, i) =>
      nativeGraphicSourceTime(template, settings, i / 30, 4)
    );
    expect(clocks.every((t, i) => !i || t >= clocks[i - 1])).toBe(true);
  });
  it("splits editable two-part words without retaining demonstration copy", () => {
    const paired = NATIVE_GRAPHIC_TEMPLATES.find(t =>
      t.controls.some(c => c.part)
    )!;
    const parts = paired.controls.filter(c => c.type === "text");
    expect(
      parts.map(c =>
        nativeTextValue(c, { text: "REELS", secondaryText: "WORK" })
      )
    ).toEqual(["REE", "LS", "WO", "RK"]);
    const preset = GRAPHIC_PRESETS.find(p => p.id === paired.id)!;
    expect(() =>
      instantiateGraphicPreset(preset.graphic, { text: "REELS" })
    ).toThrow("both text lines");
    const instantiated = instantiateGraphicPreset(preset.graphic, {
      text: "REELS",
      secondaryText: "WORK",
    });
    expect(instantiated).toMatchObject({
      text: "REELS",
      secondaryText: "WORK",
      native: { id: paired.id },
    });
  });
  it("preserves native controls through the real chat-plan save normalizer", () => {
    const graphic = normalizeGraphic({
      kind: "text",
      text: "REEL",
      native: { id: template.id, values: {}, enter: 0.4, exit: 0.6 },
    })!;
    const action = {
      id: "edit-title",
      kind: "edit",
      label: "Title",
      scope: "requested",
      status: "pending",
      credits: 0,
      reason: "Requested",
      dependsOn: [],
      operation: {
        id: "op",
        type: "graphic",
        start: 0,
        end: 4,
        targetClipIds: [],
        parameters: { graphic },
      },
    };
    const saved = normalizeEditorChatState(
      JSON.parse(
        JSON.stringify({
          mode: "ask",
          maxCredits: 0,
          messages: [
            {
              id: "reply",
              role: "assistant",
              text: "Adding the requested title",
              createdAt: "2026-11-19T00:00:00Z",
              plan: {
                requestId: "native-request-1234",
                projectId: "edit",
                actions: [action],
              },
            },
          ],
        })
      )
    )!;
    expect(saved.messages[0].plan!.actions[0]).toMatchObject(action);
  });
  it("keeps the chosen template when only its entry timing is overridden", () => {
    const preset = GRAPHIC_PRESETS.find(p => p.id === template.id)!;
    const result = normalizeGraphic(
      instantiateGraphicPreset(preset.graphic, {
        text: "REEL",
        native: { enter: 0.3 },
      })
    )!;
    expect(result.native).toMatchObject({
      id: template.id,
      enter: 0.3,
      exit: 0.45,
    });
  });
  it("rejects rotated off-frame text and trims that remove its reading hold", () => {
    const graphic = normalizeGraphic({
      kind: "text",
      text: "REEL",
      x: 50,
      y: 50,
      size: 7,
      animation: "none",
      native: { id: template.id },
    })!;
    const clip: TimelineClip = {
      id: "title",
      track: "overlay",
      label: "Title",
      locked: false,
      color: "#FFFFFF",
      start: 0,
      duration: 4,
      inPoint: 0,
      outPoint: 4,
      graphicDuration: 4,
      graphic,
    };
    expect(graphicReadabilityProblems(clip)).toEqual([]);
    expect(
      graphicReadabilityProblems({
        ...clip,
        graphic: { ...graphic, x: 2, rotation: 45 },
      }).some(p => p.includes("inside the frame"))
    ).toBe(true);
    expect(
      graphicReadabilityProblems({ ...clip, inPoint: 3.5, duration: 0.5 }).some(
        p => p.includes("reading time")
      )
    ).toBe(true);
  });
});
