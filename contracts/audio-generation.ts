import { DELIVERY_COST_USD_PER_CREDIT } from "./billing";

export type GeneratedAudioKind = "music" | "sfx";

export const SOUND_EFFECT_MODEL = "bytedance-seed/seed-audio-1-0";
export const SOUND_EFFECT_USD_PER_SECOND = 0.15 / 60;
export const SOUND_EFFECT_MAX_PROVIDER_SECONDS = 120;
export const SOUND_EFFECT_PROMPT_LIMIT = 2700;
const AUDIO_DELIVERY_ALLOWANCE = 1.5;

/** Bill the complete provider output, including any tail removed for the editor. */
export function soundEffectCredits(providerSeconds: number): number {
  if (
    !Number.isFinite(providerSeconds) ||
    providerSeconds <= 0 ||
    providerSeconds > SOUND_EFFECT_MAX_PROVIDER_SECONDS
  )
    throw new Error("Invalid generated sound-effect duration.");
  return Math.max(
    1,
    Math.ceil(
      (providerSeconds *
        SOUND_EFFECT_USD_PER_SECOND *
        AUDIO_DELIVERY_ALLOWANCE) /
        DELIVERY_COST_USD_PER_CREDIT
    )
  );
}

/** Seed has a documented 120-second cap, but no hard requested-duration option. */
export function soundEffectQuote(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0.5 || seconds > 30)
    throw new Error("Choose a duration between 0.5 and 30 seconds.");
  return soundEffectCredits(SOUND_EFFECT_MAX_PROVIDER_SECONDS);
}

export function soundEffectPrompt(text: string, seconds: number): string {
  soundEffectQuote(seconds);
  if (!text.trim() || text.length > SOUND_EFFECT_PROMPT_LIMIT)
    throw new Error("Sound-effect prompts are limited to 2,700 characters.");
  return `Create one original sound effect lasting approximately ${seconds} seconds. No speech, narration, vocals or background music. End naturally without a long silence. Sound description: ${text.trim()}`;
}
export function audioGenerationQuote(
  kind: GeneratedAudioKind,
  seconds: number,
  usdPerSecond: number
) {
  const minimum = kind === "music" ? 3 : 0.5;
  const maximum = kind === "music" ? 60 : 30;
  if (!Number.isFinite(seconds) || seconds < minimum || seconds > maximum)
    throw new Error(
      `Choose a duration between ${minimum} and ${maximum} seconds.`
    );
  if (!Number.isFinite(usdPerSecond) || usdPerSecond <= 0)
    throw new Error("AI audio generation is not available yet.");
  // Configured rate must include the provider's minimum billing and delivery allowance.
  return Math.max(
    1,
    Math.ceil((seconds * usdPerSecond) / DELIVERY_COST_USD_PER_CREDIT)
  );
}
