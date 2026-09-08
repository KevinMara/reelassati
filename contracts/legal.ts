export const LEGAL_TERMS_VERSION = "2026-09-08" as const;
export const PRIVACY_NOTICE_VERSION = "2026-09-08" as const;
export const COOKIE_NOTICE_VERSION = "2026-09-08" as const;

export interface CheckoutLegalConsent {
  termsVersion: typeof LEGAL_TERMS_VERSION;
  termsAccepted: true;
  immediateAccessRequested: true;
  withdrawalInformationAcknowledged: true;
}
