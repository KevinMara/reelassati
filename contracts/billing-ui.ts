/** Known interface labels; ledger notes and user-entered descriptions remain content. */
export const BILLING_OPERATION_LABELS: Record<string, string> = {
  subscription: "Plan credits",
  topup: "Credit top-up",
  referral: "Referral reward",
  script: "Script",
  "edit-plan": "Edit plan",
  analysis: "Video analysis",
  transcription: "Transcription",
  speech: "Voice",
  audio: "Music & sound effects",
  image: "Image",
  video: "Video",
  "trend-research": "Trend research",
  migration: "Balance migration",
};

/** Exact descriptions emitted by these application operations, never arbitrary notes. */
export const BILLING_LEDGER_UI_DESCRIPTIONS = [
  { category: "trend-research", description: "Custom trend research" },
  { category: "analysis", description: "Video analysis" },
  { category: "transcription", description: "Media transcription" },
  { category: "speech", description: "Voice generation" },
  { category: "audio", description: "AI sfx generation" },
  { category: "audio", description: "AI music generation" },
  { category: "edit-plan", description: "Reel editing chat" },
] as const;

export function isBillingInterfaceDescription(
  category: string,
  description: string
) {
  return BILLING_LEDGER_UI_DESCRIPTIONS.some(
    item => item.category === category && item.description === description
  );
}
