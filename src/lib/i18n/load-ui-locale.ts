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
  } else if (["pl", "tr", "ro"].includes(code)) {
    const supplement =
      code === "pl"
        ? import("./locales/ui-pl").then(module => module.polishUi)
        : code === "tr"
          ? import("./locales/ui-tr").then(module => module.turkishUi)
          : import("./locales/ui-ro").then(module => module.romanianUi);
    pending = Promise.all([
      import("./locales/ui-critical-east"),
      supplement,
    ]).then(([critical, full]) => ({ ...full, ...critical.easternUi[code] }));
  } else if (["ru", "uk"].includes(code)) {
    pending = import("./locales/ui-critical-east").then(
      module => module.easternUi[code]
    );
  } else if (["ar", "ja", "ko", "zh"].includes(code)) {
    pending = import("./locales/ui-critical-cjk-ar").then(
      module => module.cjkArabicUi[code]
    );
  } else if (code === "id") {
    pending = Promise.all([
      import("./locales/ui-critical-asian"),
      import("./locales/ui-id"),
    ]).then(([critical, full]) => ({
      ...full.indonesianUi,
      ...critical.asianUi.id,
    }));
  } else if (["hi", "vi", "he", "th"].includes(code)) {
    pending = import("./locales/ui-critical-asian").then(
      module => module.asianUi[code]
    );
  } else if (["nl", "da", "cs", "sv"].includes(code)) {
    const supplement =
      code === "nl"
        ? import("./locales/ui-nl").then(module => module.dutchUi)
        : code === "da"
          ? import("./locales/ui-da").then(module => module.danishUi)
          : code === "cs"
            ? import("./locales/ui-cs").then(module => module.czechUi)
            : import("./locales/ui-sv").then(module => module.swedishUi);
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
  pendingCatalogs.set(code, pending);
  void pending.catch(() => {
    if (pendingCatalogs.get(code) === pending) pendingCatalogs.delete(code);
  });
  return pending;
}
