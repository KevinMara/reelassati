import { describe, expect, it } from "vitest";
import {
  applyNativeAdjacentTransition,
  nativeTransitionInput,
  nativeTransitionRecipes,
} from "@contracts/native-transitions";
import {
  applyAdjacentTransition,
  removeAdjacentTransition,
} from "@contracts/adjacent-transition";
import { materializeNativeTransition } from "@contracts/native-transition-materialize";
import { normalizeVisual, visualFrame } from "@contracts/clip-visual";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import { buildRenderPlan } from "./render-plan";
import { effectiveTimelineClips } from "@contracts/timeline-mixer";
import {
  buildAutonomousTransitionContext,
  normalizeAutonomousTransition,
} from "@contracts/autonomous-transition";
import { normalizeTransitionPresets } from "@contracts/transition-presets";
import {
  normalizeEditorChatPlan,
  type EditorChatContext,
} from "../../sites/editor-chat";
import { applyChatAction } from "./editor-chat-execution";
import { normalizeEditorChatState } from "@contracts/editor-chat-state";
import { automaticGraphicProblems } from "@contracts/automatic-graphic-protection";
import { normalizeGraphic } from "@contracts/motion-graphics";

const shot = (id: string, start: number): TimelineClip => ({
  id,
  assetId: id,
  track: "video",
  lane: 1,
  label: id,
  start,
  duration: 2,
  inPoint: 1,
  outPoint: 3,
  locked: false,
  color: "#ffffff",
  volume: 0.8,
});
const assets = ["a", "b"].map(
  id => ({ id, name: id, kind: "video", status: "ready", duration: 6 }) as Asset
);
const source = (): EditProject => ({
  id: "native-test",
  title: "Native",
  status: "editing",
  template: "blank",
  platform: "instagram",
  aspectRatio: "16:9",
  duration: 4,
  frameRate: 30,
  playhead: 0,
  createdAt: "now",
  updatedAt: "now",
  revisions: [],
  qualitySignals: [],
  proposedChanges: [],
  clips: [shot("a", 0), shot("b", 2)],
  transcript: [{ id: "cue", start: 1.5, end: 2.5, text: "Original speech" }],
});
const apply = (p = source()) =>
  applyNativeAdjacentTransition(p, assets, "a", "b", "native-stretch", 0.4);

describe("native transitions on real source handles", () => {
  it.each([
    "native-stretch",
    "native-slide",
    "native-zoom",
    "native-grid",
    "native-push-left",
    "native-push-right",
    "native-push-up",
    "native-push-down",
    "native-box-from-right",
    "native-box-from-left",
    "native-scale-exchange",
  ] as const)(
    "persists and executes the %s action through the actual chat-state boundary",
    transition => {
      const p = source(),
        context: EditorChatContext = {
          request: {
            requestId: "native-request",
            projectId: p.id,
            prompt: "Use elastic stretch between these shots",
            mode: "ask",
            maxCredits: 200,
          },
          project: p,
          assets,
          makeId: () => "native-action",
          normalizeOperations: () => [],
          quoteAudio: () => 0,
          capability: () => true,
        };
      const plan = normalizeEditorChatPlan(
        {
          actions: [
            {
              id: "n",
              kind: "adjacent-transition",
              label: "Elastic stretch",
              scope: "requested",
              requestExcerpt: "Use elastic stretch between these shots",
              dependsOn: [],
              outgoingId: "a",
              incomingId: "b",
              transition,
              duration: 0.4,
            },
          ],
        },
        context
      );
      expect(plan.blockedReasons).toEqual([]);
      expect(plan.actions).toHaveLength(1);
      const state = normalizeEditorChatState({
        messages: [
          {
            id: "native-message",
            role: "assistant",
            text: "Preparing the transition",
            createdAt: "2026-11-17T19:00:00.000Z",
            status: "running",
            plan,
          },
        ],
      })!;
      const persisted = normalizeEditorChatState(
        JSON.parse(JSON.stringify(state))
      )!;
      const retained = persisted.messages[0].plan!.actions;
      expect(retained).toHaveLength(1);
      expect(retained[0]).toMatchObject({
        kind: "adjacent-transition",
        transition,
        duration: 0.4,
        status: "pending",
        credits: 0,
      });
      const edited = applyChatAction(p, retained[0], assets);
      expect(nativeTransitionRecipes(edited)[0].reference).toMatchObject({
        id: transition.slice(7),
        duration: 0.4,
      });
    }
  );
  it("does not claim static free space for a new graphic over moving native picture", () => {
    const p = apply();
    const graphic: TimelineClip = {
      ...shot("graphic", 1.8),
      duration: 0.4,
      outPoint: 0.4,
      inPoint: 0,
      assetId: undefined,
      track: "overlay",
      graphic: normalizeGraphic({
        kind: "callout",
        text: "Test",
        x: 15,
        y: 15,
        size: 4,
      })!,
    };
    expect(
      automaticGraphicProblems(p, graphic, assets, "source-design")
    ).toContainEqual(
      expect.objectContaining({
        reason: "unknown-source-layout",
        detail: expect.stringContaining("shot transition"),
      })
    );
  });
  it("persists an editable recipe without changing original sound, captions or duration", () => {
    const original = source(),
      next = JSON.parse(JSON.stringify(apply(original))) as EditProject;
    expect(next.duration).toBe(4);
    expect(next.transcript).toMatchObject(original.transcript);
    for (const clip of original.clips)
      expect(next.clips.find(c => c.id === clip.id)).toMatchObject({
        start: clip.start,
        duration: clip.duration,
        inPoint: clip.inPoint,
        outPoint: clip.outPoint,
        volume: clip.volume,
      });
    expect(next.clips.filter(c => c.transitionHandle).every(c => c.muted)).toBe(
      true
    );
    const [recipe] = nativeTransitionRecipes(next);
    expect(recipe).toMatchObject({
      start: 1.8,
      duration: 0.4,
      reference: { id: "stretch", frameRate: 30, version: 1 },
    });
    expect(nativeTransitionInput(recipe, "outgoing")).toMatchObject({
      inPoint: 2.8,
      muted: true,
    });
    expect(nativeTransitionInput(recipe, "outgoing").outPoint).toBeCloseTo(
      3.2,
      12
    );
    expect(nativeTransitionInput(recipe, "incoming")).toMatchObject({
      inPoint: 0.8,
      muted: true,
    });
    expect(nativeTransitionInput(recipe, "incoming").outPoint).toBeCloseTo(
      1.2,
      12
    );
  });
  it("keeps animated visual poses on the source clock across every transition frame", () => {
    const original = source();
    original.clips[1].visual = normalizeVisual({
      keyframes: [
        { at: 0, x: 0, scale: 1 },
        { at: 1, x: 20, scale: 1.2 },
      ],
    });
    const next = apply(original),
      [recipe] = nativeTransitionRecipes(next),
      span = nativeTransitionInput(recipe, "incoming");
    for (let i = 0; i < 12; i++) {
      const time = i / 30;
      const actual = visualFrame(span, time),
        expected = visualFrame(original.clips[1], recipe.start + time);
      for (const field of ["x", "y", "scale", "rotation", "opacity"] as const)
        expect(actual[field]).toBeCloseTo(expected[field], 12);
    }
  });
  it("restores previous effects and clears the native recipe when replaced by an ordinary transition", () => {
    const original = source();
    original.clips[0].visual = normalizeVisual({
      exit: { kind: "wipe-left", duration: 0.2 },
    });
    original.clips[1].visual = normalizeVisual({
      entrance: { kind: "zoom", duration: 0.3 },
    });
    const native = apply(original),
      replacement = applyAdjacentTransition(
        native,
        assets,
        "a",
        "b",
        "dissolve",
        0.3
      );
    expect(nativeTransitionRecipes(replacement)).toEqual([]);
    const restored = removeAdjacentTransition(replacement, "a", "b");
    expect(restored.clips).toHaveLength(2);
    expect(restored.clips[0].visual?.exit).toEqual(
      original.clips[0].visual.exit
    );
    expect(restored.clips[1].visual?.entrance).toEqual(
      original.clips[1].visual.entrance
    );
  });
  it("rejects absent handles, conflicting fades and stale cuts instead of producing black or frozen substitutes", () => {
    const p = source();
    p.clips[1].inPoint = 0;
    p.clips[1].outPoint = 2;
    expect(() => apply(p)).toThrow(/unused source footage/);
    const fade = source();
    fade.clips[0].fadeIn = 1.9;
    expect(() => apply(fade)).toThrow(/source audio fades/);
    const stale = apply();
    stale.clips.find(c => c.id === "b")!.start = 2.3;
    expect(() => nativeTransitionRecipes(stale)).toThrow(/adjacent/);
  });
  it("materializes picture only and routes the extra source through the ordinary render plan", () => {
    const p = apply(),
      [recipe] = nativeTransitionRecipes(p),
      { project, asset } = materializeNativeTransition(p, recipe, {
        url: "blob:test",
        width: 1280,
        height: 720,
        duration: 0.4,
      });
    expect(p.clips).toHaveLength(4);
    expect(project.clips.find(c => c.id === recipe.key)).toMatchObject({
      muted: true,
      locked: true,
      start: 1.8,
      duration: 0.4,
      track: "overlay",
    });
    const plan = buildRenderPlan(
      project,
      [...assets, asset],
      new Set(["a", "b"])
    );
    expect(plan.inputs.map(a => a.id)).toContain(asset.id);
    expect(plan.duration).toBe(4);
    expect(plan.ass).toContain("Original speech");
    expect(() =>
      materializeNativeTransition(project, recipe, {
        url: "blob:duplicate",
        width: 1280,
        height: 720,
        duration: 0.4,
      })
    ).toThrow(/identity/);
  });
  it("advertises executable native controls to Reel and preserves saved custom presets", () => {
    const p = apply(),
      context = buildAutonomousTransitionContext(p, assets);
    expect(context.existingTransitions[0]).toMatchObject({
      kind: "native-stretch",
      duration: 0.4,
    });
    expect(
      context.transitionPresets.find(p => p.kind === "native-slide")
        ?.description
    ).toMatch(/intentional black/);
    expect(
      normalizeAutonomousTransition({
        outgoingId: "a",
        incomingId: "b",
        cutTime: 2,
        presetId: "native-stretch-0_45",
      })
    ).toMatchObject({ kind: "native-stretch", duration: 0.45 });
    expect(
      normalizeTransitionPresets([
        {
          id: "mine",
          name: "My stretch",
          kind: "native-stretch",
          duration: 0.4,
        },
      ])
    ).toHaveLength(1);
  });
  it("never reveals hidden shots and retains the rendered companion when both video lanes are soloed", () => {
    const p = apply();
    p.clips.find(c => c.id === "a")!.hidden = true;
    expect(nativeTransitionRecipes(p)).toEqual([]);
    p.clips.find(c => c.id === "a")!.hidden = false;
    p.trackSettings = [
      { kind: "video", number: 1, soloPicture: true },
      { kind: "video", number: 2, soloPicture: true },
    ];
    const [recipe] = nativeTransitionRecipes(p);
    const { project } = materializeNativeTransition(p, recipe, {
      url: "blob:test",
      width: 1280,
      height: 720,
      duration: 0.4,
    });
    expect(
      effectiveTimelineClips(project).find(c => c.id === recipe.key)?.hidden
    ).toBeFalsy();
    p.trackSettings = [{ kind: "video", number: 1, soloPicture: true }];
    expect(nativeTransitionRecipes(p)).toEqual([]);
  });
});
