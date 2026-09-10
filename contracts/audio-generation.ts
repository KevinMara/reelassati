import { DELIVERY_COST_USD_PER_CREDIT } from "./billing";

export type GeneratedAudioKind = "music" | "sfx";
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
