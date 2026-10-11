import {
  choreographGraphic,
  normalizeGraphic,
  type MotionGraphic,
} from "./motion-graphics";
import { normalizeVisual } from "./clip-visual";
import type { Asset, TimelineClip } from "./workspace";

/** Original native compositions, with no Adobe files, subscriptions or provider calls. */
export const MOTION_KITS = [
  {
    id: "brand-reveal",
    name: "Brand reveal",
    detail: "Logo or wordmark, tagline and a rising accent.",
    title: "YOUR BRAND",
    subtitle: "A story worth telling",
    seconds: 4,
  },
  {
    id: "speaker",
    name: "Speaker introduction",
    detail: "Name and role with a coordinated accent rail.",
    title: "ALEX MORGAN",
    subtitle: "Creative director",
    seconds: 5,
  },
  {
    id: "chapter",
    name: "Chapter opener",
    detail: "Chapter heading, supporting line and an expanding rule.",
    title: "01 · THE IDEA",
    subtitle: "How it started",
    seconds: 4,
  },
  {
    id: "quote",
    name: "Editorial quote",
    detail: "A pull quote with attribution and a soft entrance.",
    title: "Make every second count.",
    subtitle: "Your attribution",
    seconds: 5,
  },
  {
    id: "statistic",
    name: "Result spotlight",
    detail: "Animated percentage with an explanation and accent.",
    title: "Your result",
    subtitle: "Based on your measured data",
    seconds: 4,
  },
  {
    id: "end-card",
    name: "Call to action",
    detail: "Closing message, destination and a settling accent.",
    title: "START YOUR NEXT STORY",
    subtitle: "yourwebsite.com",
    seconds: 4,
  },
] as const;
export type MotionKitId = (typeof MOTION_KITS)[number]["id"];
export interface MotionKitDraft {
  kit: MotionKitId;
  title: string;
  subtitle: string;
  accent: string;
  seconds: number;
  value?: number;
  logoAssetId?: string;
}
export function isMotionKitLogo(asset: Asset) {
  return (
    asset.kind === "image" &&
    asset.status === "ready" &&
    ["image/png", "image/jpeg", "image/webp"].includes(asset.contentType)
  );
}

/** Instantiate fresh editable layers. Relative clocks survive later trimming/splitting. */
export function motionKitClips(
  draft: MotionKitDraft,
  assets: readonly Asset[],
  start: number,
  identity: string
): TimelineClip[] {
  if (!MOTION_KITS.some(kit => kit.id === draft.kit))
    throw new Error("Choose a motion kit.");
  if (
    !Number.isFinite(start) ||
    start < 0 ||
    !Number.isFinite(draft.seconds) ||
    draft.seconds < 1 ||
    draft.seconds > 30
  )
    throw new Error(
      "Use a duration from 1 to 30 seconds and a valid insertion time."
    );
  if (
    !draft.title.trim() ||
    draft.title.length > 80 ||
    draft.subtitle.length > 120 ||
    !/^#[a-f\d]{6}$/i.test(draft.accent)
  )
    throw new Error(
      "Add a title of up to 80 characters, supporting text of up to 120, and an accent color."
    );
  if (
    draft.kit === "statistic" &&
    (!Number.isFinite(draft.value) || draft.value! < 0 || draft.value! > 100)
  )
    throw new Error("Use a measured percentage from 0 to 100.");
  const logo = draft.logoAssetId
    ? assets.find(asset => asset.id === draft.logoAssetId)
    : undefined;
  if (
    draft.logoAssetId &&
    (draft.kit !== "brand-reveal" || !logo || !isMotionKitLogo(logo))
  )
    throw new Error("Choose a ready PNG, JPEG or WebP logo from your Library.");
  const groupId = `${identity}-group`;
  const base = {
    track: "overlay" as const,
    groupId,
    start,
    duration: draft.seconds,
    inPoint: 0,
    outPoint: draft.seconds,
    locked: false,
    color: draft.accent,
  };
  const layers: TimelineClip[] = [];
  const add = (
    name: string,
    settings: Partial<MotionGraphic>,
    motion: Parameters<typeof choreographGraphic>[1]
  ) => {
    const graphic = choreographGraphic(
      normalizeGraphic({
        kind: "text",
        text: draft.title.trim(),
        secondaryText: draft.subtitle.trim(),
        color: "#FFFFFF",
        background: "#141B24",
        accent: draft.accent,
        x: 50,
        y: 45,
        size: 5.5,
        ...settings,
      })!,
      motion
    );
    layers.push({
      ...base,
      id: `${identity}-${layers.length}`,
      label: name,
      graphic,
      graphicDuration: draft.seconds,
    });
  };
  if (logo)
    layers.push({
      ...base,
      id: `${identity}-logo`,
      label: "Brand logo",
      assetId: logo.id,
      muted: true,
      fit: "contain",
      primaryFootage: false,
      visualStart: 0,
      visualDuration: draft.seconds,
      visual: normalizeVisual({
        scale: 0.18,
        y: -22,
        entrance: {
          kind: "dissolve",
          duration: Math.min(0.6, draft.seconds / 3),
        },
        exit: { kind: "dissolve", duration: Math.min(0.4, draft.seconds / 3) },
      }),
    });
  if (draft.kit === "speaker")
    add(
      "Name and role",
      {
        kind: "callout",
        composition: "lower-third",
        size: 4,
        y: 72,
        padding: 2,
        cornerRadius: 0.5,
      },
      "slide"
    );
  else if (draft.kit === "quote")
    add(
      "Quote and attribution",
      { composition: "quote", size: 4.5, y: 42 },
      "fade"
    );
  else if (draft.kit === "statistic") {
    add(
      "Measured result",
      {
        kind: "counter",
        from: 0,
        to: draft.value,
        suffix: "%",
        size: 10,
        y: 40,
        secondaryText: draft.title.trim(),
      },
      "focus"
    );
    if (draft.subtitle.trim())
      add(
        "Result context",
        { text: draft.subtitle.trim(), secondaryText: "", size: 3, y: 68 },
        "fade"
      );
  } else
    add(
      "Heading and supporting text",
      { y: logo ? 60 : 45, size: draft.kit === "chapter" ? 5 : 5.5 },
      draft.kit === "chapter" ? "slide" : "rise"
    );
  if (draft.kit !== "speaker" && draft.kit !== "quote")
    add(
      "Accent rule",
      {
        kind: "line",
        text: "",
        secondaryText: "",
        color: draft.accent,
        width: draft.kit === "chapter" ? 44 : 26,
        strokeWidth: 0.5,
        y: logo ? 47 : draft.kit === "statistic" ? 20 : 30,
      },
      "focus"
    );
  return layers;
}
