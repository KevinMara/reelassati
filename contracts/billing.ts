import {
  DEFAULT_VOICE_ID,
  speechModelForVoice,
  ELEVENLABS_SPEECH_MODEL,
} from "./voices";
import { PUBLIC_PLAN_PRICING, type PublicPlanName } from "./pricing";

export type PlanId = "creator" | "pro" | "studio";
export type BillingCycle = "monthly" | "annual";

export const PLAN_IDS: PlanId[] = ["creator", "pro", "studio"];

export const PLAN_NAME_BY_ID: Record<PlanId, PublicPlanName> = {
  creator: "Creator",
  pro: "Pro",
  studio: "Studio",
};

export const CREDIT_TOP_UPS = {
  boost: { id: "boost", credits: 1_000, price: 9 },
  momentum: { id: "momentum", credits: 2_000, price: 17 },
  scale: { id: "scale", credits: 5_000, price: 39 },
} as const;

export type CreditTopUpId = keyof typeof CREDIT_TOP_UPS;

/** Maximum modeled provider-delivery budget represented by one customer credit. */
export const DELIVERY_COST_USD_PER_CREDIT = 0.003;

export function deliveryBudgetUsd(credits: number): number {
  return Math.max(0, credits) * DELIVERY_COST_USD_PER_CREDIT;
}

/** Subscriber-only packs: lower unit prices than every monthly or annual plan. */
export function topUpPriceCents(id: CreditTopUpId): number {
  return CREDIT_TOP_UPS[id].price * 100;
}

/** Customer-facing credit tariffs. Provider and model costs remain private. */
export const AI_CREDIT_COSTS = {
  script: 5,
  editPlan: 5,
  videoAnalysisPerMinute: 10,
  // Regular Scribe price ($0.000061111/second) plus the existing 50% delivery allowance.
  transcriptionPerMinute: 2,
  // Regular Flash price ($40/M characters), with the existing 50% delivery allowance.
  speechPerThousandCharacters: 20,
  legacySpeechPerThousandCharacters: 30,
  image1K: 20,
  image2K: 40,
  video720pPerSecond: 40,
  video720pWithAudioPerSecond: 60,
  video1080pPerSecond: 90,
  video1080pWithAudioPerSecond: 120,
  continuation720p15Seconds: 700,
  continuation1080p15Seconds: 1_500,
} as const;

export function planEntitlements(planId: PlanId) {
  return PUBLIC_PLAN_PRICING[PLAN_NAME_BY_ID[planId]];
}

export function isPlanId(value: string): value is PlanId {
  return PLAN_IDS.includes(value as PlanId);
}

export function isBillingCycle(value: string): value is BillingCycle {
  return value === "monthly" || value === "annual";
}

export function isCreditTopUpId(value: string): value is CreditTopUpId {
  return Object.prototype.hasOwnProperty.call(CREDIT_TOP_UPS, value);
}

export function imageCreditCost(resolution: string): number {
  return resolution === "2K"
    ? AI_CREDIT_COSTS.image2K
    : AI_CREDIT_COSTS.image1K;
}

/** OpenRouter bills Unicode code points, including inline delivery tags. */
export function speechCharacterCount(text: string): number {
  return Array.from(text).length;
}
export function speechCreditCost(
  characterCount: number,
  voice = DEFAULT_VOICE_ID
): number {
  const rate =
    speechModelForVoice(voice) === ELEVENLABS_SPEECH_MODEL
      ? AI_CREDIT_COSTS.speechPerThousandCharacters
      : AI_CREDIT_COSTS.legacySpeechPerThousandCharacters;
  return Math.max(1, Math.ceil(Math.max(0, characterCount) / 1_000)) * rate;
}

export function timedCreditCost(
  durationSeconds: number | undefined,
  ratePerMinute: number
): number {
  return (
    Math.max(1, Math.ceil(Math.max(0, durationSeconds || 0) / 60)) *
    ratePerMinute
  );
}

export function videoCreditCost(input: {
  duration: number;
  resolution: string;
  generateAudio: boolean;
  continuation: boolean;
}): number {
  const duration = Math.max(3, Math.min(15, Math.round(input.duration)));
  if (input.continuation) {
    return Math.ceil(
      (duration *
        (input.resolution === "1080p"
          ? AI_CREDIT_COSTS.continuation1080p15Seconds
          : AI_CREDIT_COSTS.continuation720p15Seconds)) /
        15
    );
  }
  if (input.resolution === "1080p") {
    return (
      duration *
      (input.generateAudio
        ? AI_CREDIT_COSTS.video1080pWithAudioPerSecond
        : AI_CREDIT_COSTS.video1080pPerSecond)
    );
  }
  return (
    duration *
    (input.generateAudio
      ? AI_CREDIT_COSTS.video720pWithAudioPerSecond
      : AI_CREDIT_COSTS.video720pPerSecond)
  );
}

export interface BillingActivityItem {
  id: string;
  amount: number;
  category: string;
  description: string;
  status: "reserved" | "settled" | "released";
  createdAt: string;
}

export interface StripeReadiness {
  ready: boolean;
  checkedAt: string;
  checks: Array<{ id: string; ready: boolean; message: string }>;
}

export interface BillingSummary {
  configured: boolean;
  availableCredits: number;
  includedCredits: number;
  topUpCredits: number;
  adjustmentDebt?: number;
  canUseCredits: boolean;
  creditAccess?: "subscription" | "operator" | "none";
  canManageBilling?: boolean;
  plan: null | {
    id: PlanId;
    name: PublicPlanName;
    billingCycle: BillingCycle;
    status: string;
    monthlyCredits: number;
    workspaces: number;
    socialAccounts: number;
    currentPeriodEnd: string | null;
    nextCreditRenewalAt: string | null;
    cancelAtPeriodEnd: boolean;
  };
  topUps: Array<{
    id: CreditTopUpId;
    credits: number;
    price: number;
    available: boolean;
  }>;
  usage?: {
    through: string;
    daily: Array<{ date: string; category: string; credits: number }>;
  };
  recentActivity: BillingActivityItem[];
}
