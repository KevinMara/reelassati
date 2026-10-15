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
  } else if (["es", "fr", "de", "pt"].includes(code)) {
    pending = import("./locales/ui-critical-west").then(
      module => module.westernUi[code]
    );
  } else if (["ru", "uk", "pl", "ro", "tr"].includes(code)) {
    pending = import("./locales/ui-critical-east").then(
      module => module.easternUi[code]
    );
  } else if (["ar", "ja", "ko", "zh"].includes(code)) {
    pending = import("./locales/ui-critical-cjk-ar").then(
      module => module.cjkArabicUi[code]
    );
  } else if (["hi", "vi", "he", "id", "th"].includes(code)) {
    pending = import("./locales/ui-critical-asian").then(
      module => module.asianUi[code]
    );
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
