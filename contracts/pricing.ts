export const ANNUAL_BILLED_MONTHS = 10;

export const CUSTOM_TREND_RESEARCH_CREDITS = {
  singlePlatform: 8,
  tiktokAndInstagram: 15,
} as const;

export function customTrendResearchCreditCost(platform: string): number {
  return platform === "all"
    ? CUSTOM_TREND_RESEARCH_CREDITS.tiktokAndInstagram
    : CUSTOM_TREND_RESEARCH_CREDITS.singlePlatform;
}

export const PUBLIC_PLAN_PRICING = {
  Creator: {
    monthlyPrice: 19,
    annualTotal: 190,
    monthlyCredits: 1_000,
    workspaces: 1,
    socialAccounts: 2,
  },
  Pro: {
    monthlyPrice: 59,
    annualTotal: 590,
    monthlyCredits: 4_000,
    workspaces: 3,
    socialAccounts: 6,
  },
  Studio: {
    monthlyPrice: 149,
    annualTotal: 1_490,
    monthlyCredits: 12_000,
    workspaces: 10,
    socialAccounts: 12,
  },
} as const;

export type PublicPlanName = keyof typeof PUBLIC_PLAN_PRICING;

export function annualMonthlyEquivalent(plan: PublicPlanName): number {
  return PUBLIC_PLAN_PRICING[plan].annualTotal / 12;
}
