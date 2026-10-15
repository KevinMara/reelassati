import {
  AI_COMPLIANCE_POLICY_VERSION,
  type DisclosureLanguage,
  type PublicationComplianceReview,
} from "./compliance";

/** Called on submission, in the user's browser timezone. */
export function publicationSchedule(
  date: string,
  time: string,
  hasMedia: boolean,
  now = Date.now()
): string {
  const chosen = new Date(`${date}T${time}`);
  if (
    !date ||
    !time ||
    !Number.isFinite(chosen.getTime()) ||
    chosen.getTime() <= now
  ) {
    throw new Error("Choose a valid future date and time.");
  }
  if (hasMedia && chosen.getTime() - now > 6 * 24 * 60 * 60 * 1000) {
    throw new Error(
      "Media posts can be scheduled up to 6 days ahead because delivery uploads are temporary."
    );
  }
  return chosen.toISOString();
}

/** Automatic origin labeling is not a factual declaration about realism,
 * consent, public interest or a completed human review. Unknown stays unknown. */
export function automaticPublicationReview(input: {
  language: DisclosureLanguage;
  aiText: boolean;
  aiMedia: boolean;
  hasMedia: boolean;
  includeLabel?: boolean;
  submittedAt: string;
}): PublicationComplianceReview {
  const labeled = input.aiText || input.aiMedia || input.includeLabel === true;
  const text =
    input.language === "it"
      ? "Contenuto creato o modificato con l’assistenza dell’IA."
      : "Content created or edited with AI assistance.";
  return {
    policyVersion: AI_COMPLIANCE_POLICY_VERSION,
    mode: "automatic-provenance",
    reviewedAt: input.submittedAt,
    disclosureLanguage: input.language,
    classificationAnswers: {
      aiGeneratedText: input.aiText ? "yes" : "unknown",
      realisticSyntheticMedia: input.hasMedia ? "unknown" : "not-applicable",
      depictsRealPersonOrVoice: input.hasMedia ? "unknown" : "not-applicable",
      creativeOrFictionalWork: input.hasMedia ? "unknown" : "not-applicable",
      publicInterestText: "unknown",
    },
    intendedUseConfirmed: false,
    rightsConfirmed: false,
    rightsBasis: "not-applicable",
    containsAiGeneratedText: input.aiText,
    containsRealisticSyntheticMedia: false,
    depictsRealPersonOrVoice: false,
    creativeOrFictionalWork: false,
    publicInterestText: false,
    substantiveHumanReview: false,
    materialAiEditsAfterReview: false,
    visibleDisclosure: {
      required: labeled,
      reason: labeled ? "ai-origin" : "not-required",
      method: labeled ? "caption" : "not-required",
      ...(labeled ? { text } : {}),
      language: input.language,
    },
  };
}
