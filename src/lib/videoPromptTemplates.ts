export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  preview: string;
  buildPrompt: (userPrompt: string, options?: TemplateOptions) => string;
  defaultRatio: "9:16" | "16:9" | "1:1";
  defaultDuration: number;
  category: "realistic" | "cinematic" | "product" | "social" | "educational";
  finishingNote?: string;
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

function optionalDirection(options?: TemplateOptions): string {
  if (!options) return "";
  const directions = [
    options.characterDesc
      ? `Subject continuity: ${options.characterDesc}.`
      : "",
    options.outfit ? `Wardrobe continuity: ${options.outfit}.` : "",
    options.location ? `Location: ${options.location}.` : "",
    options.cameraStyle ? `Camera preference: ${options.cameraStyle}.` : "",
    options.mood ? `Mood: ${options.mood}.` : "",
    options.dialogue ? `Dialogue: "${options.dialogue}".` : "",
    options.referenceImage
      ? "Use the supplied reference asset only for supported visual guidance."
      : "",
  ];
  return directions.filter(Boolean).join(" ");
}

function compilePrompt(
  userPrompt: string,
  styleDirection: string,
  options?: TemplateOptions
): string {
  return [userPrompt.trim(), optionalDirection(options), styleDirection]
    .filter(Boolean)
    .join(" ");
}

export const VIDEO_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "ugc_iphone",
    name: "UGC phone capture",
    description: "Natural phone footage with believable framing imperfections",
    preview: "Handheld phone camera, window light, authentic room tone",
    category: "social",
    defaultRatio: "9:16",
    defaultDuration: 5,
    buildPrompt: (prompt, options) =>
      compilePrompt(
        prompt,
        "Contemporary phone-camera capture. Subtle handheld movement, small framing corrections, natural autofocus behavior, window light with soft shadows, ordinary real-world background, slightly warm white balance, and believable room tone. Keep skin texture and material detail natural. Avoid beauty filters, plastic skin, floating objects, over-stabilization, studio polish, and cinematic lens flares.",
        options
      ),
  },
  {
    id: "dv_camcorder",
    name: "DV camcorder",
    description: "Early-digital camcorder texture with spontaneous movement",
    preview: "Faded color, chroma noise, autofocus hunting, candid motion",
    category: "realistic",
    defaultRatio: "9:16",
    defaultDuration: 5,
    buildPrompt: (prompt, options) =>
      compilePrompt(
        prompt,
        "Early-2000s consumer DV camcorder capture: imperfect handheld framing, occasional autofocus hunting, modest motion blur, faded color, low contrast, chroma noise, compression texture, and small exposure corrections as the camera moves. The moment feels candid rather than staged. Natural environmental audio only. Avoid modern color grades, artificial film burns, perfect stabilization, and professional camera moves.",
        options
      ),
  },
  {
    id: "studio_professional",
    name: "Controlled studio",
    description: "Clean studio image for demos, education, and product proof",
    preview: "Three-point light, neutral background, precise focus",
    category: "product",
    defaultRatio: "9:16",
    defaultDuration: 5,
    buildPrompt: (prompt, options) =>
      compilePrompt(
        prompt,
        "Controlled studio setup with a quiet neutral background, soft key light, restrained fill, subtle edge separation, accurate skin and product color, stable eye-level camera, and deliberate shallow depth of field. Preserve crisp material texture and realistic contact shadows. Avoid blown highlights, artificial reflections, warped packaging, illegible labels, and exaggerated commercial gloss.",
        options
      ),
  },
  {
    id: "cinematic_short",
    name: "Cinematic narrative",
    description:
      "Intentional blocking, motivated light, and restrained movement",
    preview: "Motivated camera move, atmospheric depth, filmic contrast",
    category: "cinematic",
    defaultRatio: "9:16",
    defaultDuration: 5,
    buildPrompt: (prompt, options) =>
      compilePrompt(
        prompt,
        "Cinematic short-form shot with motivated lighting, coherent blocking, controlled depth of field, natural motion blur, restrained film grain, and one purposeful camera move such as a slow push or lateral track. Maintain spatial and character continuity for the full shot. Avoid random cuts, excessive lens flare, teal-orange clichés, impossible camera motion, and changing facial or wardrobe details.",
        options
      ),
  },
  {
    id: "product_demo",
    name: "Product proof",
    description: "Macro material detail and a clear product action",
    preview: "Clean surface, tactile detail, realistic hand interaction",
    category: "product",
    defaultRatio: "9:16",
    defaultDuration: 5,
    buildPrompt: (prompt, options) =>
      compilePrompt(
        prompt,
        "Product demonstration with a simple neutral surface, soft directional light, realistic contact shadows, precise macro focus, controlled hand interaction, and one readable action that proves the benefit. Keep product proportions, packaging, label placement, and material finish consistent. Avoid floating products, morphing text, extra fingers, changing logos, and physically impossible movement.",
        options
      ),
  },
  {
    id: "talking_head",
    name: "Direct-to-camera",
    description: "Conversational delivery with natural facial and hand motion",
    preview:
      "Eye-level medium close-up, clean voice, gentle background falloff",
    category: "social",
    defaultRatio: "9:16",
    defaultDuration: 5,
    buildPrompt: (prompt, options) =>
      compilePrompt(
        prompt,
        "Eye-level medium close-up with comfortable headroom, believable eye contact, soft frontal light, gentle background separation, natural breathing and hand gestures, and clean voice-forward audio. Keep facial identity, teeth, hands, wardrobe, and gaze consistent. Avoid over-enunciation, frozen expressions, lip-sync drift, beauty smoothing, and exaggerated influencer gestures.",
        options
      ),
  },
  {
    id: "street_walking",
    name: "Walking vlog",
    description: "Forward motion with a readable environment and real cadence",
    preview: "Walking follow shot, environmental detail, gentle body cadence",
    category: "realistic",
    defaultRatio: "9:16",
    defaultDuration: 5,
    buildPrompt: (prompt, options) =>
      compilePrompt(
        prompt,
        "Walking vlog captured at a believable human pace with gentle vertical cadence, small framing corrections, shifting daylight, readable environmental depth, occasional natural glance toward camera, and location-appropriate ambience. Maintain subject position and direction of travel. Avoid impossible stabilization, sliding feet, duplicated pedestrians, teleporting background objects, and rapid cinematic orbits.",
        options
      ),
  },
  {
    id: "educational_whiteboard",
    name: "Educational clean plate",
    description: "A clear teaching shot with space for editable graphics",
    preview:
      "Clean desk or board, deliberate gestures, graphic-safe negative space",
    category: "educational",
    defaultRatio: "16:9",
    defaultDuration: 5,
    finishingNote:
      "Add exact labels, diagrams, and captions in the Studio so typography stays editable and correct.",
    buildPrompt: (prompt, options) =>
      compilePrompt(
        prompt,
        "Clear instructional setup with even light, deliberate hand or presenter movement, strong visual hierarchy, and generous clean negative space reserved for post-production labels. Show one concept or physical step at a time. Do not generate text, equations, UI labels, diagrams, subtitles, or logos inside the video; those elements will be rendered accurately afterward.",
        options
      ),
  },
  {
    id: "night_neon",
    name: "Night color contrast",
    description: "Reflective night texture without generic cyberpunk excess",
    preview: "Wet-surface reflections, practical lights, restrained atmosphere",
    category: "cinematic",
    defaultRatio: "9:16",
    defaultDuration: 5,
    buildPrompt: (prompt, options) =>
      compilePrompt(
        prompt,
        "Night exterior lit by motivated practical signs and street fixtures, with controlled colored reflections on damp surfaces, light atmospheric depth, preserved shadow detail, and one slow deliberate camera move. Keep signage abstract or out of focus. Avoid generated words, crushed blacks, excessive glow, rainbow lighting, duplicated traffic, and weightless rain.",
        options
      ),
  },
  {
    id: "minimal_text",
    name: "Motion-graphic plate",
    description: "Generate a clean visual bed; render exact type in Studio",
    preview:
      "High-contrast plate, graphic-safe space, rhythmic visual movement",
    category: "social",
    defaultRatio: "9:16",
    defaultDuration: 5,
    finishingNote:
      "Typography, counters, and CTA cards are added as deterministic Studio layers after generation.",
    buildPrompt: (prompt, options) =>
      compilePrompt(
        prompt,
        "Minimal high-contrast motion-design background with restrained geometric movement, clean color fields, smooth physical easing, and stable negative space for post-production typography. No words, letters, numbers, logos, captions, icons, watermarks, or faux interface elements should appear in the generated footage.",
        options
      ),
  },
];

export function getTemplateById(id: string): PromptTemplate | undefined {
  return VIDEO_PROMPT_TEMPLATES.find(template => template.id === id);
}

export function getTemplatesByCategory(category: string): PromptTemplate[] {
  return VIDEO_PROMPT_TEMPLATES.filter(
    template => template.category === category
  );
}
