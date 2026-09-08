import { COOKIE_NOTICE_VERSION } from "@contracts/legal";

export const PRIVACY_PREFERENCES_EVENT = "reelassati:privacy-preferences";
export const OPEN_PRIVACY_PREFERENCES_EVENT =
  "reelassati:open-privacy-preferences";
const STORAGE_KEY = "reelassati:privacy-preferences";

export interface PrivacyPreferences {
  version: typeof COOKIE_NOTICE_VERSION;
  analytics: boolean;
  externalMedia: boolean;
  decidedAt: string;
}

export function readPrivacyPreferences(): PrivacyPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) || "null"
    ) as Partial<PrivacyPreferences> | null;
    if (
      !value ||
      value.version !== COOKIE_NOTICE_VERSION ||
      typeof value.analytics !== "boolean" ||
      typeof value.externalMedia !== "boolean"
    ) {
      return null;
    }
    return value as PrivacyPreferences;
  } catch {
    return null;
  }
}

export function savePrivacyPreferences(
  selection: Pick<PrivacyPreferences, "analytics" | "externalMedia">
): PrivacyPreferences {
  const value: PrivacyPreferences = {
    version: COOKIE_NOTICE_VERSION,
    analytics: selection.analytics,
    externalMedia: selection.externalMedia,
    decidedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(
    new CustomEvent(PRIVACY_PREFERENCES_EVENT, { detail: value })
  );
  return value;
}

export function analyticsConsentGranted(): boolean {
  return readPrivacyPreferences()?.analytics === true;
}

export function openPrivacyPreferences(): void {
  window.dispatchEvent(new Event(OPEN_PRIVACY_PREFERENCES_EVENT));
}
