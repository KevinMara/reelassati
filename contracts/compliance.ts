/**
 * EU-AI-01 — Single, versioned compliance contract.
 *
 * Product code, persistence, publishing gates, tests, and the public
 * transparency surface all import this identifier. Changing it requires the
 * review described in docs/compliance/CHANGE_REVIEW_CHECKLIST.md.
 */
export const AI_COMPLIANCE_POLICY_VERSION = "eu-ai-act-2026-08-04.v1" as const;

export const AI_PROVENANCE_SCHEME = "reelassati-provenance-v1" as const;
export const AI_TEXT_MARKER_PREFIX = "\u{E0001}" as const;
export const AI_TEXT_MARKER_SUFFIX = "\u{E007F}" as const;
export const AI_BINARY_MARKER_PREFIX = "REELASSATI-AI:" as const;
const AI_TEXT_MARKER_LABEL = "REELASSATI-AI:";
const UNICODE_TAG_OFFSET = 0xe0000;

export type ContentOrigin =
  | "human"
  | "uploaded"
  | "ai-assisted"
  | "ai-generated"
  | "ai-manipulated"
  | "standard-edit";

export type AiOperation =
  | "script-generation"
  | "edit-planning"
  | "video-analysis"
  | "transcription"
  | "speech-synthesis"
  | "image-generation"
  | "video-generation"
  | "trend-research"
  | "support-assistance"
  | "publication-marking"
  | "timeline-render";

export type MarkingStatus = "not-required" | "pending" | "verified" | "failed";

export interface MachineMarking {
  scheme: typeof AI_PROVENANCE_SCHEME;
  method:
    | "signed-record+sha256-fingerprint"
    | "signed-record+sha256-fingerprint+text-token"
    | "signed-record+sha256-fingerprint+embedded-media-marker";
  status: MarkingStatus;
  publicToken?: string;
  detectPath?: string;
}

/**
 * A compact workspace projection of the server-owned provenance record.
 * The D1 record is authoritative and append-only; this projection exists so
 * provenance remains visible throughout the product instead of disappearing
 * when content moves into the Library or Publisher.
 */
export interface ContentProvenance {
  recordId: string;
  origin: ContentOrigin;
  operation: AiOperation;
  provider: string;
  model: string;
  generatedAt: string;
  policyVersion: string;
  marking: MachineMarking;
  humanReview?: {
    status: "not-reviewed" | "reviewed" | "approved" | "rejected";
    reviewedAt?: string;
  };
}

export type RightsBasis =
  "owned-or-licensed" | "documented-consent" | "not-applicable";

export type DisclosureReason =
  "realistic-synthetic-media" | "public-interest-text" | "not-required";

export type DisclosureLanguage = "en" | "it";

/**
 * EU-AI-07 — Immutable review snapshot bound to a publishing intent.
 * These are factual declarations by the authenticated deployer. The server
 * validates their internal consistency and the server-owned asset provenance;
 * it never treats a client boolean as proof of ownership or consent.
 */
export interface PublicationComplianceReview {
  policyVersion: typeof AI_COMPLIANCE_POLICY_VERSION;
  reviewedAt: string;
  /**
   * Language of the audience-facing disclosure for this specific release.
   * This is deliberately independent from the operator's Studio UI language.
   */
  disclosureLanguage: DisclosureLanguage;
  classificationAnswers: {
    aiGeneratedText: "yes" | "no";
    realisticSyntheticMedia: "yes" | "no" | "not-applicable";
    depictsRealPersonOrVoice: "yes" | "no" | "not-applicable";
    creativeOrFictionalWork: "yes" | "no" | "not-applicable";
    publicInterestText: "yes" | "no";
  };
  intendedUseConfirmed: boolean;
  rightsConfirmed: boolean;
  rightsBasis: RightsBasis;
  containsAiGeneratedText: boolean;
  containsRealisticSyntheticMedia: boolean;
  depictsRealPersonOrVoice: boolean;
  creativeOrFictionalWork: boolean;
  publicInterestText: boolean;
  substantiveHumanReview: boolean;
  materialAiEditsAfterReview: boolean;
  editorialResponsibilityName?: string;
  visibleDisclosure: {
    required: boolean;
    reason: DisclosureReason;
    reasons?: Array<Exclude<DisclosureReason, "not-required">>;
    method: "caption" | "not-required";
    text?: string;
    language: DisclosureLanguage;
  };
}

export interface ComplianceStatus {
  policyVersion: typeof AI_COMPLIANCE_POLICY_VERSION;
  intendedUse: "creative-marketing-only";
  operatorIdentityConfigured: boolean;
  operatorName?: string;
  operatorEntityType?: "individual" | "company" | "other";
  releaseStatus?: "public";
  firstEuAvailabilityDate?: string;
  creativeScopeConfirmed: boolean;
  aiLiteracyAcknowledgedAt?: string;
  markingAndDetectionReady: boolean;
  markingValidationVerified: boolean;
  providerEvidenceVerified: boolean;
  legalReviewRecorded: boolean;
  incidentOperationsVerified: boolean;
  provenanceLifecycleVerified: boolean;
  kimiTestModeDisabled: boolean;
  publicLaunchReady: boolean;
  blockers: string[];
}

export interface ProvenanceDetectionResult {
  matched: boolean;
  recordFound?: boolean;
  verification?:
    | "artifact-verified"
    | "record-authentic"
    | "artifact-mismatch"
    | "unmatched";
  method?: "text-token" | "sha256-fingerprint" | "embedded-media-marker";
  provenance?: {
    origin: ContentOrigin;
    operation: AiOperation;
    provider: string;
    model: string;
    generatedAt: string;
    policyVersion: string;
    markingStatus: MarkingStatus;
  };
}

export function appendTextProvenanceMarker(
  text: string,
  publicToken?: string
): string {
  if (!publicToken || extractTextProvenanceToken(text)) return text;
  const payload = `${AI_TEXT_MARKER_LABEL}${publicToken}`;
  const encoded = Array.from(payload, character =>
    String.fromCodePoint(UNICODE_TAG_OFFSET + character.codePointAt(0)!)
  ).join("");
  return `${text}${AI_TEXT_MARKER_PREFIX}${encoded}${AI_TEXT_MARKER_SUFFIX}`;
}

export function extractTextProvenanceToken(text: string): string | null {
  const start = text.indexOf(AI_TEXT_MARKER_PREFIX);
  if (start < 0) return null;
  const tokenStart = start + AI_TEXT_MARKER_PREFIX.length;
  const end = text.indexOf(AI_TEXT_MARKER_SUFFIX, tokenStart);
  const encoded =
    end < 0 ? text.slice(tokenStart) : text.slice(tokenStart, end);
  let payload = "";
  for (const character of encoded) {
    const codePoint = character.codePointAt(0)!;
    if (
      codePoint < UNICODE_TAG_OFFSET ||
      codePoint > UNICODE_TAG_OFFSET + 0x7f
    ) {
      return null;
    }
    payload += String.fromCodePoint(codePoint - UNICODE_TAG_OFFSET);
  }
  if (!payload.startsWith(AI_TEXT_MARKER_LABEL)) return null;
  const token = payload.slice(AI_TEXT_MARKER_LABEL.length).trim();
  return /^[A-Za-z0-9_-]{16,96}$/.test(token) ? token : null;
}

export function withoutTextProvenanceMarker(text: string): string {
  const start = text.indexOf(AI_TEXT_MARKER_PREFIX);
  if (start < 0) return text;
  const end = text.indexOf(
    AI_TEXT_MARKER_SUFFIX,
    start + AI_TEXT_MARKER_PREFIX.length
  );
  return `${text.slice(0, start)}${
    end < 0 ? "" : text.slice(end + AI_TEXT_MARKER_SUFFIX.length)
  }`;
}

export function requiredDisclosureText(
  review: Pick<
    PublicationComplianceReview,
    "containsRealisticSyntheticMedia" | "publicInterestText"
  >,
  language: "en" | "it" = "en"
): string | null {
  // The realistic-media fact does not establish whether the underlying
  // operation was generation or manipulation. Keep the public cue accurate to
  // either path instead of inferring one from real-person/voice presence.
  const mediaText = review.containsRealisticSyntheticMedia
    ? language === "it"
      ? "Contenuto multimediale generato o manipolato con l’IA."
      : "AI-generated or AI-manipulated media."
    : null;
  const publicInterestText = review.publicInterestText
    ? language === "it"
      ? "Testo di interesse pubblico creato o modificato in modo sostanziale con IA."
      : "Public-interest text created or materially edited with AI."
    : null;
  if (mediaText && publicInterestText) {
    return `${mediaText} ${publicInterestText}`;
  }
  if (mediaText) return mediaText;
  if (publicInterestText) return publicInterestText;
  return null;
}
