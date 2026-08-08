import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import it from "./locales/it";
import { globalLocales } from "./locales/global";
import { platformApiUrl } from "@/lib/runtime";

export const supportedLanguages = [
  ["en", "English"],
  ["it", "Italiano"],
  ["es", "Español"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["pt", "Português"],
  ["nl", "Nederlands"],
  ["pl", "Polski"],
  ["ro", "Română"],
  ["tr", "Türkçe"],
  ["uk", "Українська"],
  ["ru", "Русский"],
  ["ar", "العربية"],
  ["hi", "हिन्दी"],
  ["ja", "日本語"],
  ["ko", "한국어"],
  ["zh", "简体中文"],
  ["vi", "Tiếng Việt"],
  ["da", "Dansk"],
  ["sv", "Svenska"],
  ["no", "Norsk"],
  ["fi", "Suomi"],
  ["cs", "Čeština"],
  ["hu", "Magyar"],
  ["el", "Ελληνικά"],
  ["he", "עברית"],
  ["id", "Bahasa Indonesia"],
  ["th", "ไทย"],
] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number][0];
const languageCodes = new Set(supportedLanguages.map(([code]) => code));
const LANGUAGE_STORAGE_KEY = "reelassati-language";

const countryLanguages: Record<string, SupportedLanguage> = {
  IT: "it",
  ES: "es",
  MX: "es",
  AR: "es",
  CO: "es",
  CL: "es",
  PE: "es",
  FR: "fr",
  BE: "fr",
  DE: "de",
  AT: "de",
  CH: "de",
  PT: "pt",
  BR: "pt",
  NL: "nl",
  PL: "pl",
  RO: "ro",
  TR: "tr",
  UA: "uk",
  RU: "ru",
  SA: "ar",
  AE: "ar",
  EG: "ar",
  MA: "ar",
  DZ: "ar",
  IN: "hi",
  JP: "ja",
  KR: "ko",
  CN: "zh",
  SG: "zh",
  VN: "vi",
  DK: "da",
  SE: "sv",
  NO: "no",
  FI: "fi",
  CZ: "cs",
  HU: "hu",
  GR: "el",
  IL: "he",
  ID: "id",
  TH: "th",
};

function normalizeLanguage(value?: string | null): SupportedLanguage | null {
  const code = value?.toLowerCase().split("-")[0];
  return code && languageCodes.has(code as SupportedLanguage)
    ? (code as SupportedLanguage)
    : null;
}

function browserLanguage(): SupportedLanguage {
  for (const candidate of navigator.languages || [navigator.language]) {
    const normalized = normalizeLanguage(candidate);
    if (normalized) return normalized;
  }
  return "en";
}

async function locationLanguage(): Promise<SupportedLanguage | null> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 1400);
    const response = await fetch(platformApiUrl("/api/localization"), {
      signal: controller.signal,
    });
    window.clearTimeout(timer);
    if (!response.ok) return null;
    const data = (await response.json()) as { country?: string | null };
    return data.country ? countryLanguages[data.country] || null : null;
  } catch {
    return null;
  }
}

function applyDocumentLanguage(language: string) {
  document.documentElement.lang = language;
  document.documentElement.dir = ["ar", "he"].includes(language)
    ? "rtl"
    : "ltr";
}

export async function initializeI18n() {
  const manuallySelected = normalizeLanguage(
    window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  );
  const initialLanguage =
    manuallySelected || (await locationLanguage()) || browserLanguage();

  await i18n.use(initReactI18next).init({
    lng: initialLanguage,
    resources: {
      en: { translation: en },
      it: { translation: it },
      ...Object.fromEntries(
        Object.entries(globalLocales).map(([code, translation]) => [
          code,
          { translation },
        ])
      ),
    },
    supportedLngs: supportedLanguages.map(([code]) => code),
    fallbackLng: "en",
    load: "languageOnly",
    interpolation: { escapeValue: false },
  });
  applyDocumentLanguage(initialLanguage);
  i18n.on("languageChanged", applyDocumentLanguage);
}

export async function selectLanguage(language: SupportedLanguage) {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  await i18n.changeLanguage(language);
}

export default i18n;
