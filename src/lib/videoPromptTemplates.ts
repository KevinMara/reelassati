// ═══════════════════════════════════════════════════════════════════════════════
// VIDEO PROMPT TEMPLATES — Pre-built styles for ultra-realistic generation
// ═══════════════════════════════════════════════════════════════════════════════
// Extracted from: Palmier Pro (style-locking), Vyra (chat editing),
// HyperFrames (animation presets), and the ultra-realistic prompt research
// ═══════════════════════════════════════════════════════════════════════════════

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  preview: string; // Short visual description
  buildPrompt: (userPrompt: string, options?: TemplateOptions) => string;
  defaultRatio: "9:16" | "16:9" | "1:1";
  defaultDuration: number;
  category: "realistic" | "cinematic" | "product" | "social" | "educational";
}

export interface TemplateOptions {
  characterDesc?: string;
  location?: string;
  cameraStyle?: string;
  dialogue?: string;
  mood?: string;
  outfit?: string;
  referenceImage?: string;
}

export const VIDEO_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "ugc_iphone",
    name: "UGC iPhone Style",
    description: "Raw, authentic phone footage feel — perfect for TikTok/Reels",
    preview: "Handheld phone camera, natural lighting, authentic feel",
    category: "social",
    defaultRatio: "9:16",
    defaultDuration: 5,
    buildPrompt: (userPrompt, opts) => {
      return `${userPrompt}. Shot on an iPhone 15 Pro in Cinematic Mode. Natural handheld shake, slight imperfection in framing, authentic bedroom/kitchen/living room background. Natural window lighting with soft shadows. No professional equipment visible. Casual, relatable atmosphere. Raw, unpolished feel like a real person filming themselves. 60fps motion, slightly warm color temperature. No filters, no color grading.`;
    },
  },
  {
    id: "dv_camcorder",
    name: "DV Camcorder Vintage",
    description: "Early-2000s digital camcorder aesthetic — nostalgic, raw",
    preview: "Heavy handheld shake, faded colors, chroma noise, authentic",
    category: "realistic",
    defaultRatio: "9:16",
    defaultDuration: 5,
    buildPrompt: (userPrompt, opts) => {
      const character = opts?.characterDesc || "a young adult";
      const location = opts?.location || "a casual indoor setting";
      return `${userPrompt}. ${character} in ${location}. Heavy handheld camera shake, constant recomposing, imperfect framing, hesitant autofocus hunting. Early-2000s DV camcorder aesthetic: faded colors, low contrast, washed-out image, authentic digital compression, chroma noise, soft detail, slight motion blur, imperfect exposure changes. No stabilization, no cinematic camera moves, no modern color grading. The recording feels accidental, spontaneous, and completely authentic. Natural ambient audio only: subtle background noise, environmental sounds. No background music.`;
    },
  },
  {
    id: "studio_professional",
    name: "Studio Professional",
    description: "Clean, well-lit studio setup — product demos, tutorials",
    preview: "Clean background, three-point lighting, sharp focus",
    category: "product",
    defaultRatio: "9:16",
    defaultDuration: 5,
    buildPrompt: (userPrompt, opts) => {
      return `${userPrompt}. Professional studio setup with clean, minimal background (solid color or soft gradient). Three-point lighting: key light from front-left, fill light from right, subtle backlight for separation. Sharp focus, shallow depth of field. Smooth, stable camera on tripod. High production value, crisp details. Neutral to slightly warm color grading. Professional but approachable atmosphere. Clear audio quality implied.`;
    },
  },
  {
    id: "cinematic_short",
    name: "Cinematic Short",
    description: "Movie-quality visuals — dramatic lighting, shallow depth",
    preview: "Anamorphic lens, golden hour, lens flares, shallow DOF",
    category: "cinematic",
    defaultRatio: "9:16",
    defaultDuration: 5,
    buildPrompt: (userPrompt, opts) => {
      return `${userPrompt}. Cinematic quality: anamorphic lens characteristics, subtle lens flares, shallow depth of field with creamy bokeh. Golden hour lighting or dramatic chiaroscuro. Smooth camera movement on gimbal: slow push-in or gentle tracking shot. Film grain texture, slightly desaturated color palette with rich shadows. Professional color grading: teal-orange contrast. Widescreen composition within vertical frame. Atmospheric haze or volumetric light if outdoors. Emotional, immersive mood.`;
    },
  },
  {
    id: "product_demo",
    name: "Product Demo",
    description: "Clean product showcase with rotating angles",
    preview: "360 rotation, clean surface, soft shadows, sharp details",
    category: "product",
    defaultRatio: "9:16",
    defaultDuration: 5,
    buildPrompt: (userPrompt, opts) => {
      return `${userPrompt}. Product photography style: clean white or neutral background, soft diffused lighting from above. Smooth 360-degree rotation or slow pan around the product. Sharp macro focus on details and textures. Subtle reflections on glossy surface. Soft shadows underneath for grounding. Professional e-commerce quality. Clean, minimalist aesthetic. Every detail visible and sharp.`;
    },
  },
  {
    id: "talking_head",
    name: "Talking Head",
    description: "Direct-to-camera speaking — reviews, advice, reactions",
    preview: "Eye-level camera, blurred background, natural eye contact",
    category: "social",
    defaultRatio: "9:16",
    defaultDuration: 5,
    buildPrompt: (userPrompt, opts) => {
      const dialogue = opts?.dialogue ? ` Speaking: "${opts.dialogue}"` : "";
      return `${userPrompt}${dialogue}. Eye-level camera angle, medium close-up framing (head and shoulders). Slightly blurred background (bokeh) with indoor setting visible. Natural, confident eye contact with camera. Soft, flattering lighting from front. Subtle head movements and natural hand gestures. Authentic, conversational delivery. Clean audio focus on voice. Approachable, trustworthy presence.`;
    },
  },
  {
    id: "street_walking",
    name: "Walking Vlog",
    description: "Dynamic walking footage — travel, lifestyle, explorations",
    preview: "Following shot, urban/nature backdrop, natural pace",
    category: "realistic",
    defaultRatio: "9:16",
    defaultDuration: 5,
    buildPrompt: (userPrompt, opts) => {
      const location = opts?.location || "an urban street";
      return `${userPrompt}. ${location}. Walking pace camera following the subject from slightly behind and to the side. Natural handheld movement with gentle bounce. Environmental details visible: pedestrians, storefronts, nature elements. Natural daylight, shifting light as they move. Occasional glances toward camera. Authentic ambient sounds implied. Dynamic, energetic mood. Real exploration feel.`;
    },
  },
  {
    id: "educational_whiteboard",
    name: "Educational / Explainer",
    description: "Clear educational content — whiteboard, screen, diagrams",
    preview: "Clear visuals, text overlays, step-by-step progression",
    category: "educational",
    defaultRatio: "16:9",
    defaultDuration: 5,
    buildPrompt: (userPrompt, opts) => {
      return `${userPrompt}. Educational video style: clean, well-lit environment. Clear visual hierarchy with text overlays and graphics. Step-by-step visual progression. Bold, readable typography. Bright, engaging colors. Smooth transitions between concepts. Screen recording style with cursor highlighting if digital. Whiteboard or clean desk setup if physical. Focus on clarity and understanding. Professional but accessible.`;
    },
  },
  {
    id: "night_neon",
    name: "Night / Neon",
    description: "Cyberpunk nighttime aesthetic — moody, colorful",
    preview: "Neon reflections, rain, city lights, moody atmosphere",
    category: "cinematic",
    defaultRatio: "9:16",
    defaultDuration: 5,
    buildPrompt: (userPrompt, opts) => {
      return `${userPrompt}. Nighttime urban setting: neon signs reflecting on wet pavement, street lights creating lens flares. Moody blue-purple color palette with pops of neon pink, green, and orange. Light rain creating atmospheric haze and reflections. Silhouettes against bright backgrounds. Slow, deliberate camera movement. Cinematic color grading with crushed blacks and lifted shadows. Cyberpunk atmosphere, intimate and moody.`;
    },
  },
  {
    id: "minimal_text",
    name: "Text + Motion Graphics",
    description: "Bold text animations, transitions, graphic overlays",
    preview: "Bold typography, smooth transitions, graphic elements",
    category: "social",
    defaultRatio: "9:16",
    defaultDuration: 5,
    buildPrompt: (userPrompt, opts) => {
      return `${userPrompt}. Bold motion graphics style: large typography animating in and out. Clean, solid color backgrounds transitioning smoothly. Graphic elements (shapes, lines, icons) supporting the message. Smooth easing on all animations. Modern, trendy design aesthetic. Fast-paced cuts synchronized to implied rhythm. High contrast colors. Professional motion design quality. TikTok/Reels native feel with text-first approach.`;
    },
  },
];

export function getTemplateById(id: string): PromptTemplate | undefined {
  return VIDEO_PROMPT_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: string): PromptTemplate[] {
  return VIDEO_PROMPT_TEMPLATES.filter((t) => t.category === category);
}
