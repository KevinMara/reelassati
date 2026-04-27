import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import it from "./locales/it";
import en from "./locales/en";

// Phase 1 ships: it (primary), en. Structure ready for 20+ more languages —
// add to SUPPORTED_LANGUAGES and create a locale module to enable.
export const SUPPORTED_LANGUAGES = [
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "en", label: "English", flag: "🇬🇧" },
  // Pending translation queue:
  { code: "es", label: "Español", flag: "🇪🇸", pending: true },
  { code: "fr", label: "Français", flag: "🇫🇷", pending: true },
  { code: "de", label: "Deutsch", flag: "🇩🇪", pending: true },
  { code: "pt", label: "Português", flag: "🇵🇹", pending: true },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      it: { translation: it },
      en: { translation: en },
    },
    fallbackLng: "it",
    supportedLngs: ["it", "en"],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "reelassati.lang",
    },
  });

i18n.on("languageChanged", (lng) => {
  const base = lng.split("-")[0];
  document.documentElement.lang = base;
  document.documentElement.dir = ["ar", "he", "fa"].includes(base) ? "rtl" : "ltr";
});

export default i18n;
