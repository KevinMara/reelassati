import {
  choreographGraphic,
  normalizeGraphic,
  type MotionGraphic,
} from "./motion-graphics";
import { GRAPHIC_PRESETS } from "./editor-presets";
import { normalizeVisual } from "./clip-visual";
import type { Asset, TimelineClip } from "./workspace";

const extraKit = <T extends string>(
  id: T,
  presetId: string,
  title: string,
  subtitle: string
) => {
  const preset = GRAPHIC_PRESETS.find(p => p.id === presetId)!;
  return {
    id,
    name: preset.name,
    detail: preset.description,
    title,
    subtitle,
    seconds: 5,
  };
};

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
  extraKit(
    "feature-pointer",
    "feature-callout",
    "THE DETAIL",
    "Describe what makes it different"
  ),
  extraKit(
    "benefit-stack",
    "benefit-label",
    "MADE FOR YOU",
    "Explain the benefit"
  ),
  extraKit(
    "focus-ring",
    "highlight",
    "TAKE A CLOSER LOOK",
    "Point out what matters"
  ),
  extraKit(
    "floating-card",
    "floating-label",
    "A NEW PERSPECTIVE",
    "Give the idea some room"
  ),
  extraKit(
    "chapter-frame",
    "chapter-card",
    "02 · THE PROCESS",
    "Show the next step"
  ),
  extraKit("title-orbit", "spatial-orbit", "YOUR NEXT IDEA", "A new dimension"),
  extraKit("countdown-card", "countdown", "COMING NEXT", "Stay for the reveal"),
  extraKit(
    "clean-frame",
    "clean-title",
    "LESS, BUT BETTER",
    "A simple idea with space to breathe"
  ),
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
  const shape = (
    kind: MotionGraphic["kind"],
    x: number,
    y: number,
    width: number,
    height: number,
    motion: Parameters<typeof choreographGraphic>[1] = "focus"
  ) =>
    add(
      kind,
      {
        kind,
        text: "",
        secondaryText: "",
        x,
        y,
        width,
        height,
        size: 8,
        color: draft.accent,
        strokeWidth: 0.45,
      },
      motion
    );
  if (draft.kit === "feature-pointer") {
    shape("highlight", 47, 39, 30, 18);
    shape("arrow", 68, 53, 15, 8, "slide");
    add(
      draft.title,
      {
        kind: "callout",
        composition: "lower-third",
        y: 73,
        size: 4,
        padding: 2,
      },
      "rise"
    );
    return layers;
  }
  if (draft.kit === "benefit-stack") {
    shape("line", 25, 39, 32, 1, "slide");
    add(draft.title, { composition: "chapter", y: 49, size: 5 }, "rise");
    shape("ellipse", 75, 65, 4, 4, "focus");
    return layers;
  }
  if (draft.kit === "focus-ring") {
    shape("highlight", 50, 38, 40, 23, "focus");
    shape("line", 50, 57, 1, 12, "slide");
    add(draft.title, { composition: "lower-third", y: 72, size: 3.8 }, "fade");
    return layers;
  }
  if (draft.kit === "floating-card") {
    shape("ellipse", 25, 28, 5, 5, "drift");
    add(
      draft.title,
      {
        kind: "callout",
        composition: "lower-third",
        y: 47,
        size: 4.5,
        padding: 3,
        cornerRadius: 1,
      },
      "drift"
    );
    shape("line", 72, 68, 16, 1, "slide");
    return layers;
  }
  if (draft.kit === "chapter-frame") {
    shape("highlight", 50, 45, 80, 40, "focus");
    add(
      draft.title,
      {
        composition: "chapter",
        y: 45,
        size: 5,
        background: "#141B24",
        padding: 2,
      },
      "slide"
    );
    return layers;
  }
  if (draft.kit === "title-orbit") {
    add(
      draft.title,
      {
        kind: "spatial-orbit",
        text: "",
        secondaryText: "",
        size: 13,
        y: 30,
        color: draft.accent,
        spatial: {
          pitch: -25,
          yaw: -15,
          depth: 0.15,
          turns: 0.6,
          perspective: 5,
        },
      },
      "focus"
    );
    add(draft.title, { y: 60, size: 5 }, "rise");
    return layers;
  }
  if (draft.kit === "countdown-card") {
    shape("highlight", 50, 38, 34, 20, "focus");
    add(
      draft.title,
      { kind: "countdown", secondaryText: "", y: 38, size: 10 },
      "fade"
    );
    add(draft.title, { y: 67, size: 4 }, "rise");
    return layers;
  }
  if (draft.kit === "clean-frame") {
    shape("line", 50, 29, 26, 1, "slide");
    shape("line", 50, 68, 26, 1, "slide");
    add(draft.title, { y: 47, size: 5 }, "fade");
    return layers;
  }
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
