import {
  normalizeGraphic,
  choreographGraphic,
  MOTION_CHOREOGRAPHIES,
  type MotionGraphic,
} from "./motion-graphics";
import fontMetrics from "./caption-font-metrics.json";

export const CAPTION_ANIMATIONS = [
  "none",
  "active-word",
  "word-reveal",
  "word-only",
  "word-pulse",
  "word-pop",
  "word-slide",
  "word-fade",
  "word-type",
] as const;
export type CaptionAnimation = (typeof CAPTION_ANIMATIONS)[number];
export interface CaptionPreset {
  animation: CaptionAnimation;
  activeColor: string;
  id: string;
  name: string;
  description: string;
  color: string;
  outlineColor: string;
  background?: string;
  size: number;
  bold: boolean;
  uppercase: boolean;
  outline: number;
  position: "bottom" | "top";
  margin: number;
  maxCharacters: number;
}

const caption = (
  id: string,
  name: string,
  description: string,
  settings: Partial<CaptionPreset> = {}
): CaptionPreset => ({
  id,
  name,
  description,
  animation: "none",
  activeColor: "#FFE34A",
  color: "#FFFFFF",
  outlineColor: "#101010",
  size: 4.5,
  bold: true,
  uppercase: false,
  outline: 0.28,
  position: "bottom",
  margin: 14,
  maxCharacters: 32,
  ...settings,
});

/** Original presets; fonts are bundled locally and no asset subscription is required. */
const BASE_CAPTION_PRESETS: readonly CaptionPreset[] = [
  caption("word-pop", "Word pop", "Each measured word settles into place.", {
    animation: "word-pop",
    size: 7,
    maxCharacters: 24,
  }),
  caption(
    "word-slide",
    "Word rise",
    "Each spoken word rises gently into place.",
    { animation: "word-slide", size: 6, activeColor: "#7AF5CF" }
  ),
  caption(
    "word-fade",
    "Word fade",
    "A soft entrance for each measured spoken word.",
    { animation: "word-fade", size: 6 }
  ),
  caption(
    "word-type",
    "Word type",
    "Letters reveal within each measured word's speech interval.",
    { animation: "word-type", size: 6, uppercase: true }
  ),
  caption(
    "reveal",
    "Spoken reveal",
    "Words appear as spoken, preserving the phrase layout.",
    { animation: "word-reveal", size: 5.2, maxCharacters: 24, outline: 0.4 }
  ),
  caption(
    "spotlight",
    "Word spotlight",
    "One measured word at a time, with pauses left clear.",
    { animation: "word-only", size: 7.5, uppercase: true, outline: 0.45 }
  ),
  caption(
    "pulse",
    "Speech pulse",
    "A restrained phrase pulse follows each measured word onset.",
    {
      animation: "word-pulse",
      size: 5.2,
      activeColor: "#7AF5CF",
      outline: 0.4,
      maxCharacters: 26,
    }
  ),
  caption(
    "kinetic",
    "Word focus",
    "Highlight each spoken word using measured speech timing.",
    { animation: "active-word", size: 5, maxCharacters: 26, outline: 0.45 }
  ),
  caption(
    "word-mint",
    "Mint rhythm",
    "Clean white type with a mint highlight on the active word.",
    {
      animation: "active-word",
      activeColor: "#7AF5CF",
      size: 4.6,
      maxCharacters: 30,
    }
  ),
  caption(
    "word-punch",
    "Word punch",
    "Bold uppercase captions with a bright active-word accent.",
    {
      animation: "active-word",
      activeColor: "#FF8B64",
      uppercase: true,
      size: 5.6,
      maxCharacters: 22,
      outline: 0.5,
    }
  ),
  caption("classic", "Classic", "Clear white subtitles with a dark outline."),
  caption(
    "bold",
    "Bold statement",
    "Large uppercase text for short, punchy phrases.",
    { size: 5.6, uppercase: true, outline: 0.5, maxCharacters: 24 }
  ),
  caption(
    "yellow",
    "Yellow focus",
    "High-contrast yellow for talking-head videos.",
    { color: "#FFE34A", size: 5, outline: 0.45, maxCharacters: 28 }
  ),
  caption(
    "editorial",
    "Editorial",
    "Smaller, sentence-case subtitles with a light outline.",
    { size: 3.7, bold: false, outline: 0.2, maxCharacters: 40 }
  ),
  caption(
    "minimal",
    "Minimal",
    "Quiet white subtitles with generous safe margins.",
    { size: 3.4, bold: false, outline: 0.15, margin: 12, maxCharacters: 42 }
  ),
  caption("black-box", "Black label", "White text on a solid dark label.", {
    background: "#141414",
    outline: 1.1,
    maxCharacters: 28,
  }),
  caption("white-box", "White label", "Black text on a clean white label.", {
    color: "#141414",
    background: "#FFFFFF",
    outline: 1.1,
    maxCharacters: 28,
  }),
  caption("violet-box", "Violet label", "White text on a vivid violet label.", {
    background: "#6551C9",
    outline: 1.1,
    maxCharacters: 28,
  }),
  caption("red-box", "Red label", "A compact red label for emphasis.", {
    background: "#B82739",
    outline: 1.1,
    size: 4.4,
    maxCharacters: 28,
  }),
  caption("cyan", "Cyan focus", "Bright cyan with a strong dark outline.", {
    color: "#62E9EF",
    outline: 0.45,
    size: 4.8,
    maxCharacters: 28,
  }),
  caption(
    "top-line",
    "Top line",
    "Upper captions that leave the lower frame clear.",
    { position: "top", margin: 12, size: 4.2, maxCharacters: 34 }
  ),
  caption(
    "warm",
    "Warm editorial",
    "Soft cream subtitles for a restrained look.",
    { color: "#FFF1D8", size: 4, bold: false, outline: 0.25, maxCharacters: 36 }
  ),
];

/** Named layout variants use the same typography metrics in preview and export. */
export const CAPTION_PRESETS: readonly CaptionPreset[] = [
  ...BASE_CAPTION_PRESETS,
  ...BASE_CAPTION_PRESETS.flatMap(p => [
    {
      ...p,
      id: `${p.id}-compact`,
      name: `${p.name} · Compact`,
      size: Math.min(4.2, p.size),
      maxCharacters: 44,
      margin: 10,
      outline: Math.min(0.22, p.outline),
    },
    {
      ...p,
      id: `${p.id}-top`,
      name: `${p.name} · Top`,
      position: "top" as const,
      margin: 12,
      size: Math.min(5.5, p.size),
      maxCharacters: 28,
    },
  ]),
];

export type CaptionAppearance = Partial<
  Pick<
    CaptionPreset,
    | "color"
    | "outlineColor"
    | "size"
    | "bold"
    | "uppercase"
    | "outline"
    | "position"
    | "margin"
    | "maxCharacters"
    | "animation"
    | "activeColor"
  >
> & { background?: string | null };

export function getCaptionPreset(
  id?: string,
  appearance?: CaptionAppearance
): CaptionPreset {
  const base =
    CAPTION_PRESETS.find(p => p.id === id) ??
    CAPTION_PRESETS.find(p => p.id === "classic")!;
  if (!appearance || typeof appearance !== "object") return base;
  const result = { ...base };
  for (const key of ["color", "outlineColor", "activeColor"] as const)
    if (
      typeof appearance[key] === "string" &&
      /^#[a-f\d]{6}$/i.test(appearance[key]!)
    )
      result[key] = appearance[key]!;
  if (appearance.background === null) result.background = undefined;
  else if (
    typeof appearance.background === "string" &&
    /^#[a-f\d]{6}$/i.test(appearance.background)
  )
    result.background = appearance.background;
  for (const [key, min, max] of [
    ["size", 2, 12],
    ["outline", 0, 2],
    ["margin", 2, 40],
    ["maxCharacters", 12, 64],
  ] as const) {
    const value = appearance[key];
    if (typeof value === "number" && Number.isFinite(value))
      result[key] = Math.max(min, Math.min(max, value));
  }
  for (const key of ["bold", "uppercase"] as const)
    if (typeof appearance[key] === "boolean") result[key] = appearance[key]!;
  if (appearance.position === "top" || appearance.position === "bottom")
    result.position = appearance.position;
  if (CAPTION_ANIMATIONS.includes(appearance.animation as CaptionAnimation))
    result.animation = appearance.animation!;
  return result;
}

/** Advances extracted from our bundled DejaVu Sans; see public/fonts/DejaVuSans-LICENSE.txt. */
export function captionLineWidth(text: string, preset: CaptionPreset): number {
  const metrics = fontMetrics as Record<string, number>;
  return Array.from(text).reduce(
    (sum, point) => sum + (metrics[point] ?? 1) * preset.size,
    0
  );
}

/** Explicit line breaks are shared by CSS preview and ASS export. No timing is invented. */
export function captionLines(text: string, preset: CaptionPreset): string {
  const clean = text
    // Caption files may contain control bytes; strip them before either renderer.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/\r\n?/g, "\n");
  const formatted = preset.uppercase ? clean.toUpperCase() : clean;
  // Leave room for font weight, outlines and backgrounds inside the 84% safe width.
  const fits = (value: string) =>
    Array.from(value).length <= preset.maxCharacters &&
    captionLineWidth(value, preset) <= 76;
  return formatted
    .split("\n")
    .flatMap(paragraph => {
      const result: string[] = [];
      let line = "";
      for (const word of paragraph.trim().split(/\s+/u)) {
        if (!word) continue;
        if (line && !fits(`${line} ${word}`)) {
          result.push(line);
          line = "";
        }
        // Split long tokens by Unicode code point rather than breaking surrogate pairs.
        let part = "";
        for (const point of Array.from(word)) {
          if (part && !fits(part + point)) {
            if (line) {
              result.push(line);
              line = "";
            }
            result.push(part);
            part = "";
          }
          part += point;
        }
        if (part) line = line ? `${line} ${part}` : part;
      }
      if (line) result.push(line);
      return result;
    })
    .join("\n");
}

export interface GraphicPreset {
  id: string;
  name: string;
  description: string;
  duration: number;
  graphic: MotionGraphic;
}
const graphic = (
  id: string,
  name: string,
  description: string,
  settings: Partial<MotionGraphic>,
  duration = 3
): GraphicPreset => ({
  id,
  name,
  description,
  duration,
  graphic: normalizeGraphic({
    kind: "text",
    text: "Your message",
    x: 50,
    y: 30,
    size: 7,
    animation: "pop",
    ...settings,
  })!,
});

const BASE_GRAPHIC_PRESETS: readonly GraphicPreset[] = [
  graphic(
    "nameplate",
    "Accent nameplate",
    "A name and role card with a separate accent rail.",
    {
      kind: "callout",
      composition: "lower-third",
      text: "ALEX MORGAN",
      secondaryText: "Creative director",
      accent: "#7AF5CF",
      background: "#141B24",
      size: 4.2,
      y: 75,
      animation: "slide",
      padding: 2,
      cornerRadius: 0.6,
    },
    5
  ),
  graphic(
    "chapter-rule",
    "Chapter rule",
    "A compact chapter card with a colored rule and supporting heading.",
    {
      kind: "callout",
      composition: "chapter",
      text: "01 · THE IDEA",
      secondaryText: "How it started",
      accent: "#7AF5CF",
      background: "#171C28",
      size: 4.5,
      y: 25,
      animation: "fade",
      padding: 2,
    },
    4
  ),
  graphic(
    "stat-proof",
    "Proof statistic",
    "An animated statistic with its explanation on a second line.",
    {
      kind: "counter",
      composition: "statistic",
      from: 0,
      to: 42,
      suffix: "%",
      secondaryText: "Your measured result",
      accent: "#7AF5CF",
      size: 10,
      y: 42,
      animation: "pop",
    },
    4
  ),
  graphic(
    "quote-credit",
    "Attributed quote",
    "A pull quote with an accent rule and separate attribution.",
    {
      kind: "text",
      composition: "quote",
      text: "Make every second count.",
      secondaryText: "Your attribution",
      accent: "#EFC978",
      color: "#FFF1D8",
      size: 4.8,
      y: 40,
      animation: "fade",
    },
    5
  ),
  graphic(
    "progress-title",
    "Story progress",
    "A progress rail follows the graphic's source clock.",
    {
      kind: "text",
      composition: "progress",
      text: "THE PROCESS",
      size: 4,
      y: 20,
      width: 48,
      background: "#333C4C",
      accent: "#7AF5CF",
      animation: "fade",
    },
    6
  ),
  graphic(
    "shape-rect",
    "Rectangle",
    "Editable filled rectangle, rounded corners or frame.",
    {
      kind: "rectangle",
      width: 32,
      height: 16,
      cornerRadius: 1,
      color: "#6551C9",
      animation: "fade",
    }
  ),
  graphic(
    "shape-ellipse",
    "Ellipse",
    "Editable circular or elliptical accent.",
    {
      kind: "ellipse",
      width: 20,
      height: 20,
      color: "#7AF5CF",
      animation: "pop",
    }
  ),
  graphic(
    "shape-star",
    "Star",
    "A vector star with independent width and height.",
    {
      kind: "star",
      width: 20,
      height: 20,
      color: "#EFC978",
      animation: "pop",
    }
  ),
  graphic(
    "shape-line",
    "Accent line",
    "A line with editable length, thickness, rotation and motion.",
    {
      kind: "line",
      width: 40,
      strokeWidth: 0.6,
      color: "#7AF5CF",
      animation: "slide",
    }
  ),
  graphic(
    "spatial-title",
    "Dimensional title",
    "Editable extruded lettering with perspective.",
    {
      kind: "spatial-title",
      text: "YOUR STORY",
      color: "#E6DEFF",
      background: "#5741A4",
      size: 9,
      y: 42,
      animation: "fade",
      spatial: { pitch: -12, yaw: -20, depth: 0.18, turns: 0, perspective: 6 },
    },
    4
  ),
  graphic(
    "spatial-cube",
    "Turning cube",
    "A perspective cube with editable color and rotation.",
    {
      kind: "spatial-cube",
      color: "#62E9EF",
      background: "#246981",
      size: 12,
      y: 45,
      animation: "fade",
      spatial: {
        pitch: -18,
        yaw: -25,
        depth: 0.3,
        turns: 0.35,
        perspective: 5,
      },
    },
    4
  ),
  graphic(
    "spatial-orbit",
    "Orbital accent",
    "A rotating geometric accent in perspective.",
    {
      kind: "spatial-orbit",
      color: "#FFE34A",
      background: "#C77B26",
      size: 12,
      y: 45,
      animation: "fade",
      spatial: {
        pitch: -25,
        yaw: -15,
        depth: 0.15,
        turns: 0.6,
        perspective: 5,
      },
    },
    4
  ),
  graphic("title-pop", "Title pop", "A bold opening headline.", {
    text: "YOUR BIG IDEA",
    size: 8,
  }),
  graphic(
    "clean-title",
    "Clean title",
    "A soft fade for an editorial headline.",
    { text: "A different perspective", animation: "fade", size: 5.5 }
  ),
  graphic(
    "lower-third",
    "Lower third",
    "An editable name or role label.",
    {
      kind: "callout",
      text: "Name · Your role",
      y: 76,
      size: 4,
      animation: "slide",
      background: "#151B28",
    },
    5
  ),
  graphic(
    "chapter-card",
    "Chapter marker",
    "A chapter number and short heading.",
    {
      kind: "callout",
      text: "01 · THE BEGINNING",
      y: 20,
      size: 4.3,
      background: "#2E5470",
      animation: "fade",
    }
  ),
  graphic(
    "feature-callout",
    "Feature label",
    "A bright product feature callout.",
    {
      kind: "callout",
      text: "The detail that matters",
      size: 4.6,
      background: "#6551C9",
    }
  ),
  graphic("benefit-label", "Benefit label", "A green benefit statement.", {
    kind: "callout",
    text: "Made for your everyday",
    y: 68,
    size: 4.3,
    background: "#187659",
    animation: "slide",
  }),
  graphic(
    "quote",
    "Quote",
    "An editorial pull quote.",
    {
      text: "“Make every second count.”",
      size: 5.5,
      y: 40,
      color: "#FFF1D8",
      animation: "fade",
    },
    4
  ),
  graphic(
    "cta",
    "Call to action",
    "A clear, editable ending label.",
    {
      kind: "callout",
      text: "Discover the full story",
      y: 70,
      size: 4.8,
      background: "#D04C39",
      animation: "slide",
    },
    4
  ),
  graphic(
    "count-up",
    "Count up",
    "An animated number with an editable target.",
    {
      kind: "counter",
      from: 0,
      to: 100,
      suffix: "%",
      size: 12,
      y: 40,
      color: "#62E9EF",
    }
  ),
  graphic(
    "price-reveal",
    "Price reveal",
    "An animated price you can customize.",
    {
      kind: "counter",
      from: 0,
      to: 49,
      prefix: "$",
      size: 12,
      y: 40,
      color: "#FFE34A",
    }
  ),
  graphic(
    "countdown",
    "Countdown",
    "Counts down using the clip's real duration.",
    { kind: "countdown", size: 14, y: 45, color: "#FFFFFF" },
    5
  ),
  graphic(
    "right-arrow",
    "Pointer",
    "Direct attention to a product or detail.",
    { kind: "arrow", color: "#FFE34A", y: 50, x: 60 }
  ),
  graphic(
    "diagonal-arrow",
    "Angled pointer",
    "A rotating pointer for a visual detail.",
    { kind: "arrow", color: "#62E9EF", x: 40, y: 45, rotation: -35 }
  ),
  graphic(
    "highlight",
    "Focus frame",
    "A clean outline around an important region.",
    { kind: "highlight", color: "#FFE34A", y: 50, animation: "fade" },
    4
  ),
  graphic(
    "floating-label",
    "Floating label",
    "A subtle, editable vertical motion path.",
    {
      kind: "callout",
      text: "A closer look",
      size: 4.4,
      y: 34,
      background: "#6551C9",
      motion: [
        { at: 0, x: 50, y: 36, scale: 1, rotation: 0 },
        { at: 0.5, x: 50, y: 32, scale: 1, rotation: 0 },
        { at: 1, x: 50, y: 36, scale: 1, rotation: 0 },
      ],
    },
    4
  ),
  graphic(
    "moving-pointer",
    "Moving pointer",
    "A pointer that follows an editable path.",
    {
      kind: "arrow",
      color: "#FFE34A",
      y: 45,
      motion: [
        { at: 0, x: 25, y: 45, scale: 0.85, rotation: -20 },
        { at: 1, x: 70, y: 45, scale: 1, rotation: 20 },
      ],
    },
    4
  ),
];

/** Curated motion paths: deliberate entrance, readable hold, and a short exit. */
export const GRAPHIC_PRESETS: readonly GraphicPreset[] = [
  ...BASE_GRAPHIC_PRESETS,
  ...BASE_GRAPHIC_PRESETS.flatMap(p =>
    (p.graphic.kind === "line" || p.graphic.kind === "arrow"
      ? (["slide", "fade"] as const)
      : p.graphic.kind.startsWith("spatial")
        ? (["focus", "drift"] as const)
        : (["rise", "focus"] as const)
    ).map(motion => ({
      ...p,
      id: `${p.id}-${motion}`,
      name: `${p.name} · ${MOTION_CHOREOGRAPHIES.find(m => m.id === motion)!.name}`,
      duration: Math.max(3.5, p.duration),
      graphic: choreographGraphic(p.graphic, motion),
    }))
  ),
];

export interface ClipLookPreset {
  id: string;
  name: string;
  description: string;
  settings: {
    brightness: number;
    contrast: number;
    saturation: number;
    exposure?: number;
    temperature?: number;
    tint?: number;
    highlights?: number;
    shadows?: number;
    whites?: number;
    blacks?: number;
  };
}
const BASE_CLIP_LOOK_PRESETS: readonly ClipLookPreset[] = [
  {
    id: "original",
    name: "Original",
    description: "Reset color adjustments.",
    settings: { brightness: 0, contrast: 1, saturation: 1 },
  },
  {
    id: "clean",
    name: "Clean",
    description: "A gentle lift with natural color.",
    settings: { brightness: 0.025, contrast: 1.04, saturation: 1.03 },
  },
  {
    id: "crisp",
    name: "Crisp",
    description: "Clearer contrast and color.",
    settings: { brightness: 0.01, contrast: 1.14, saturation: 1.08 },
  },
  {
    id: "soft",
    name: "Soft",
    description: "Lighter contrast and restrained color.",
    settings: { brightness: 0.03, contrast: 0.9, saturation: 0.88 },
  },
  {
    id: "muted",
    name: "Muted",
    description: "Lower saturation with editorial contrast.",
    settings: { brightness: 0, contrast: 1.09, saturation: 0.62 },
  },
  {
    id: "vivid",
    name: "Vivid",
    description: "Stronger color for product details.",
    settings: { brightness: 0, contrast: 1.08, saturation: 1.32 },
  },
  {
    id: "monochrome",
    name: "Monochrome",
    description: "Clean black and white.",
    settings: { brightness: 0, contrast: 1.12, saturation: 0 },
  },
  {
    id: "noir",
    name: "Noir",
    description: "Deep, high-contrast black and white.",
    settings: { brightness: -0.025, contrast: 1.35, saturation: 0 },
  },
];

/** Native grades remain independent controls, rather than opaque baked LUTs. */
export const CLIP_LOOK_PRESETS: readonly ClipLookPreset[] = [
  ...BASE_CLIP_LOOK_PRESETS,
  ...BASE_CLIP_LOOK_PRESETS.flatMap(p => [
    {
      ...p,
      id: `${p.id}-warm`,
      name: `${p.name} · Warm`,
      settings: {
        ...p.settings,
        temperature: 0.16,
        tint: 0.025,
        highlights: -0.15,
        shadows: 0.09,
      },
    },
    {
      ...p,
      id: `${p.id}-cool`,
      name: `${p.name} · Cool`,
      settings: {
        ...p.settings,
        temperature: -0.13,
        tint: 0.015,
        highlights: -0.1,
        blacks: -0.06,
      },
    },
    {
      ...p,
      id: `${p.id}-soft`,
      name: `${p.name} · Soft`,
      settings: {
        ...p.settings,
        contrast: Math.max(0.8, p.settings.contrast - 0.08),
        exposure: 0.08,
        highlights: -0.28,
        shadows: 0.18,
        blacks: 0.05,
      },
    },
  ]),
];

/** Localized variant names are composed from the already translated base and treatment. */
export const PRESET_NAME_PARTS = [
  ...CAPTION_PRESETS.filter(p => !BASE_CAPTION_PRESETS.includes(p)).map(p => ({
    name: p.name,
    parts: p.name.split(" · "),
  })),
  ...GRAPHIC_PRESETS.filter(p => !BASE_GRAPHIC_PRESETS.includes(p)).map(p => ({
    name: p.name,
    parts: p.name.split(" · "),
  })),
  ...CLIP_LOOK_PRESETS.filter(p => !BASE_CLIP_LOOK_PRESETS.includes(p)).map(
    p => ({ name: p.name, parts: p.name.split(" · ") })
  ),
];
export function translatePresetNames(catalog: Record<string, string>) {
  return Object.fromEntries(
    PRESET_NAME_PARTS.map(p => [
      p.name,
      p.parts.map(part => catalog[part] ?? part).join(" · "),
    ])
  );
}

export const FADE_PRESETS = [
  { id: "cut", name: "Cut", description: "No fade.", fadeIn: 0, fadeOut: 0 },
  {
    id: "quick",
    name: "Quick fade",
    description: "A short entrance and exit.",
    fadeIn: 0.15,
    fadeOut: 0.15,
  },
  {
    id: "smooth",
    name: "Smooth fade",
    description: "A gentle entrance and exit.",
    fadeIn: 0.4,
    fadeOut: 0.4,
  },
  {
    id: "opening",
    name: "Fade in",
    description: "Reveal the clip gradually.",
    fadeIn: 0.6,
    fadeOut: 0,
  },
  {
    id: "ending",
    name: "Fade out",
    description: "Ease into the ending.",
    fadeIn: 0,
    fadeOut: 0.6,
  },
] as const;
