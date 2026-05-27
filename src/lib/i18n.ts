import i18n from "i18next";
import { initReactI18next } from "react-i18next";


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

const isBrowser = typeof window !== "undefined";

if (isBrowser) {
  // Use a dynamic import for the browser-only detector to avoid server-side crashes
  import("i18next-browser-languagedetector").then((module) => {
    const LanguageDetector = module.default;
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
        parseMissingKeyHandler: (key) => {
          const parts = key.split('.');
          const last = parts[parts.length - 1];
          return last.charAt(0).toUpperCase() + last.slice(1).replace(/_/g, ' ');
        },
        detection: {
          order: ["localStorage", "navigator", "htmlTag"],
          caches: ["localStorage"],
          lookupLocalStorage: "reelassati.lang",
        },
      });
  });

  i18n.on("languageChanged", (lng) => {
    const base = lng.split("-")[0];
    if (document.documentElement) {
      document.documentElement.lang = base;
      document.documentElement.dir = ["ar", "he", "fa"].includes(base) ? "rtl" : "ltr";
    }
  });
} else {
  // Server-side initialization (minimal)
  i18n
    .use(initReactI18next)
    .init({
      resources: {
        it: { translation: it },
        en: { translation: en },
      },
      fallbackLng: "it",
      supportedLngs: ["it", "en"],
      interpolation: { escapeValue: false },
      react: { useSuspense: false }
    });
}

export default i18n;
