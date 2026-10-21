import { automaticResearchDisabled } from "./locales/ui-manual-only";
import type { InterfaceLanguage } from "@contracts/interface-language";

type InterfaceCatalog = Record<string, string>;
const pendingCatalogs = new Map<string, Promise<InterfaceCatalog>>();

/** Load only the requested language group; English literal keys need no catalog. */
export function loadUiLocale(
  code: InterfaceLanguage
): Promise<InterfaceCatalog> {
  const cached = pendingCatalogs.get(code);
  if (cached) return cached;
  let pending: Promise<InterfaceCatalog>;
  if (code === "en") pending = Promise.resolve({});
  else if (code === "it") {
    pending = Promise.all([
      import("./locales/ui-it"),
      import("./locales/ui-it-existing"),
    ]).then(([manual, existing]) => ({
      ...existing.existingItalianUi,
      ...manual.italianUi,
    }));
  } else if (code === "fr") {
    pending = Promise.all([
      import("./locales/ui-critical-west"),
      import("./locales/ui-fr"),
    ]).then(([critical, full]) => ({
      ...full.frenchUi,
      ...critical.westernUi.fr,
    }));
  } else if (["es", "de", "pt"].includes(code)) {
    const supplement =
      code === "es"
        ? import("./locales/ui-es").then(module => module.spanishUi)
        : code === "de"
          ? import("./locales/ui-de").then(module => module.germanUi)
          : import("./locales/ui-pt").then(module => module.portugueseUi);
    pending = Promise.all([
      import("./locales/ui-critical-west"),
      supplement,
    ]).then(([critical, full]) => ({ ...full, ...critical.westernUi[code] }));
  } else if (["pl", "tr", "ro", "uk", "ru"].includes(code)) {
    const supplement =
      code === "pl"
        ? import("./locales/ui-pl").then(module => module.polishUi)
        : code === "tr"
          ? import("./locales/ui-tr").then(module => module.turkishUi)
          : code === "ro"
            ? import("./locales/ui-ro").then(module => module.romanianUi)
            : code === "uk"
              ? import("./locales/ui-uk").then(module => module.ukrainianUi)
              : import("./locales/ui-ru").then(module => module.russianUi);
    pending = Promise.all([
      import("./locales/ui-critical-east"),
      supplement,
    ]).then(([critical, full]) => ({ ...full, ...critical.easternUi[code] }));
  } else if (["ja", "zh", "ko", "ar"].includes(code)) {
    const supplement =
      code === "ja"
        ? import("./locales/ui-ja").then(module => module.japaneseUi)
        : code === "zh"
          ? import("./locales/ui-zh").then(module => module.chineseUi)
          : code === "ko"
            ? import("./locales/ui-ko").then(module => module.koreanUi)
            : import("./locales/ui-ar").then(module => module.arabicUi);
    pending = Promise.all([
      import("./locales/ui-critical-cjk-ar"),
      supplement,
    ]).then(([critical, full]) => ({
      ...full,
      ...critical.cjkArabicUi[code],
    }));
  } else if (["id", "vi", "th", "hi", "he"].includes(code)) {
    const supplement =
      code === "id"
        ? import("./locales/ui-id").then(module => module.indonesianUi)
        : code === "vi"
          ? import("./locales/ui-vi").then(module => module.vietnameseUi)
          : code === "th"
            ? import("./locales/ui-th").then(module => module.thaiUi)
            : code === "hi"
              ? import("./locales/ui-hi").then(module => module.hindiUi)
              : import("./locales/ui-he").then(module => module.hebrewUi);
    pending = Promise.all([
      import("./locales/ui-critical-asian"),
      supplement,
    ]).then(([critical, full]) => ({
      ...full,
      ...critical.asianUi[code],
    }));
  } else if (["nl", "da", "cs", "sv", "hu", "no", "el", "fi"].includes(code)) {
    const supplement =
      code === "nl"
        ? import("./locales/ui-nl").then(module => module.dutchUi)
        : code === "da"
          ? import("./locales/ui-da").then(module => module.danishUi)
          : code === "cs"
            ? import("./locales/ui-cs").then(module => module.czechUi)
            : code === "sv"
              ? import("./locales/ui-sv").then(module => module.swedishUi)
              : code === "hu"
                ? import("./locales/ui-hu").then(module => module.hungarianUi)
                : code === "no"
                  ? import("./locales/ui-no").then(module => module.norwegianUi)
                  : code === "el"
                    ? import("./locales/ui-el").then(module => module.greekUi)
                    : import("./locales/ui-fi").then(
                        module => module.finnishUi
                      );
    pending = Promise.all([
      import("./locales/ui-critical-europe"),
      supplement,
    ]).then(([critical, full]) => ({
      ...full,
      ...critical.europeanUi[code],
    }));
  } else {
    pending = import("./locales/ui-critical-europe").then(
      module => module.europeanUi[code]
    );
  }
  if (code !== "en")
    pending = pending.then(catalog => ({
      ...catalog,
      "Automatic research is disabled.": automaticResearchDisabled[code],
    }));
  pendingCatalogs.set(code, pending);
  void pending.catch(() => {
    if (pendingCatalogs.get(code) === pending) pendingCatalogs.delete(code);
  });
  return pending;
}
