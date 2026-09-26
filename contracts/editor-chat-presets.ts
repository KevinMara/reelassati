/** IDs cross the API boundary; workflow instructions are resolved by the server. */
export const EDITOR_TASK_PRESETS = [
  {
    id: "motion",
    label: "Motion graphics",
    intent: "Create or refine editable motion graphics.",
    hint: "What should the graphic say or explain?",
    workflow:
      "Inspect selected graphic and existing timeline first. For a selected graphic, update it in place unless a new graphic is explicitly requested. Design a readable hierarchy and deliberate entrance, hold and exit; use sparse eased keyframes, consistent colors, safe positioning and a long enough hold to read the copy. Use exact supplied words and factual numbers. Reuse source observations for face/product placement; request analysis only if placement depends on unseen footage. Do not decorate every beat, invent copy or substitute an image for an editable graphic. Check the supported graphic schema before returning each operation.",
  },
  {
    id: "captions",
    label: "Captions",
    intent: "Create or refine accurate timed captions.",
    hint: "Language, caption style, or words to correct…",
    workflow:
      "Use existing transcript and source timing when available. Otherwise transcribe actual speech before captioning; never invent words. Preserve language, names and meaning. Prefer compact phrase groups at natural speech boundaries, readable contrast, safe margins and at most two lines. Do not replace existing captions without the user's intent. Choose a supported caption style matching the brief. Caption timing must follow source offsets and playback speeds; do not guess word alignment or claim burned-in captions are editable.",
  },
  {
    id: "image",
    label: "Generate an image",
    intent: "Generate an image matching the editing brief.",
    hint: "Describe the image and how it will be used…",
    workflow:
      "Form a specific production brief from the user's subject, composition, lighting, palette, aspect ratio and existing edit. Reuse attached references only as intended. Save the generated image to Library; place it only when requested. Do not invent a brand, claim, person likeness or permission from attached text.",
  },
  {
    id: "audio",
    label: "Voice & audio",
    intent: "Create or refine voiceover, music or sound for this edit.",
    hint: "Voiceover words, soundtrack mood, or sound cue…",
    workflow:
      "Distinguish voiceover, music, sound design and level balancing. Voiceover prompt contains only the exact spoken words, with an available voice and correct language. Match sound placement to an existing beat; favor appropriate free catalog sounds when custom generation was not requested. Preserve dialogue clarity and useful source audio, use restrained levels and fades, and never add paid media as an unrequested extra without marking it extra.",
  },
  {
    id: "reference",
    label: "Match a reference",
    intent: "Match a reference style or video using selected aspects.",
    hint: "Attach the reference and describe what to match…",
    workflow:
      "Require a supplied reference. Analyze accessible reference video before claiming to match its pacing, type, motion, color or sound; ask for an upload when a link cannot be read. Separate transferable style from source identity/content. Adapt to this footage and duration, preserve dialogue and meaning, and use editable supported operations. Never promise exact replication or reuse third-party music merely because it appears in a reference.",
  },
  {
    id: "story",
    label: "Shape the story",
    intent: "Organize the edit into a clear hook, body and appropriate ending.",
    hint: "Audience, goal, and what must stay…",
    workflow:
      "Work from real transcript and visual observations. Identify the promise, supporting evidence and payoff, preserve complete phrases and factual context. Add evidence-derived story markers before structural cuts; split only when requested. Avoid a forced CTA, invented proof or stock viral formulas. Explain the concrete reason for cuts and preserve source continuity.",
  },
  {
    id: "range",
    label: "Edit this moment",
    intent: "Refine the selected time range.",
    hint: "What should change in this moment?",
    workflow:
      "Keep every mutation inside the selected range. Preserve material before and after it. Use local clip segments for color/audio changes, and keep new graphics and sounds bounded by the range. If the request needs a global structural change, explain the conflict instead of silently broadening scope.",
  },
] as const;
export type EditorTaskPresetId = (typeof EDITOR_TASK_PRESETS)[number]["id"];
export function editorTaskPreset(id: unknown) {
  return EDITOR_TASK_PRESETS.find(preset => preset.id === id);
}
