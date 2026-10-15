import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";
import { INTERFACE_LANGUAGE_CODES } from "@contracts/interface-language";
import { uiLocales } from "./locales/ui";
import { westernUi } from "./locales/ui-critical-west";
import { loadUiLocale } from "./load-ui-locale";
import { localizedLegacyKeys } from "./translation-resources";
import { globalLocales } from "./locales/global";

function placeholders(text: string) {
  return [...text.matchAll(/\{\{\s*([\w]+)\s*\}\}/g)]
    .map(match => match[1])
    .sort();
}

describe("interface localization", () => {
  it("loads only the chosen catalog and caches it without changing creation languages", async () => {
    expect(await loadUiLocale("en")).toEqual({});
    const italian = loadUiLocale("it");
    expect(loadUiLocale("it")).toBe(italian);
    expect((await italian)["Clarity"]).toBe("Chiarezza");
    expect((await loadUiLocale("ja"))["Clarity"]).toBe(uiLocales.ja.Clarity);
    expect((await loadUiLocale("fr"))["Settings"]).toBe(uiLocales.fr.Settings);
  });

  it("connects legacy navigation keys to the selected interface catalog", () => {
    for (const code of INTERFACE_LANGUAGE_CODES.filter(
      code => !["en", "it"].includes(code)
    )) {
      const translation = localizedLegacyKeys(
        globalLocales[code] || {},
        uiLocales[code]
      );
      expect(translation["nav.analyze"], code).toBe(uiLocales[code].Analyze);
      expect(translation["nav.logout"], code).toBe(
        uiLocales[code]["Exit Studio"]
      );
    }
    expect(
      localizedLegacyKeys(
        { "nav.login": "Already reviewed" },
        { Login: "Replacement" }
      )["nav.login"]
    ).toBe("Already reviewed");
  });
  it("covers the complete analyzer and shared-control catalog in every advertised locale", () => {
    const criticalKeys = Object.keys(westernUi.es);
    expect(criticalKeys.length).toBeGreaterThan(200);
    expect(Object.keys(uiLocales).sort()).toEqual(
      [...INTERFACE_LANGUAGE_CODES].sort()
    );
    for (const code of INTERFACE_LANGUAGE_CODES.filter(code => code !== "en")) {
      const dictionary = uiLocales[code];
      const missing = criticalKeys.filter(key => !dictionary[key]?.trim());
      expect(missing, code).toEqual([]);
      for (const key of criticalKeys) {
        expect(placeholders(dictionary[key]), `${code}: ${key}`).toEqual(
          placeholders(key)
        );
      }
    }
  });

  it("preserves interpolated content and links throughout supplemental catalogs", () => {
    const links = (text: string) =>
      [...text.matchAll(/https?:\/\/[a-z0-9][^\s<>"')}]*/gi)]
        .map(match => match[0].replace(/[.,;!?]+$/, ""))
        .sort();
    const markup = (text: string) =>
      [...text.matchAll(/<\/?[a-z][^>]*>/gi)].map(match => match[0]).sort();
    for (const [code, dictionary] of Object.entries(uiLocales)) {
      for (const [key, value] of Object.entries(dictionary)) {
        expect(value.trim(), `${code}: ${key}`).not.toBe("");
        expect(placeholders(value), `${code}: ${key}`).toEqual(
          placeholders(key)
        );
        expect(links(value), `${code}: ${key}`).toEqual(links(key));
        expect(markup(value), `${code}: ${key}`).toEqual(markup(key));
      }
    }
  });

  it("keeps the image resolution distinct from the purchased image count", () => {
    const key = "1K images if used only for images.";
    for (const [code, dictionary] of Object.entries(uiLocales)) {
      const translated = dictionary[key];
      if (translated !== undefined) {
        expect(translated, code).toMatch(/1\s*K/i);
      }
    }
  });

  it("switches interface copy and keeps interpolated user content intact", async () => {
    const instance = createInstance();
    await instance.init({
      lng: "it",
      fallbackLng: "en",
      defaultNS: "ui",
      keySeparator: false,
      nsSeparator: false,
      resources: Object.fromEntries(
        Object.entries(uiLocales).map(([code, ui]) => [code, { ui }])
      ),
      interpolation: { escapeValue: false },
    });
    expect(instance.t("Processing load")).toBe("Carico cognitivo");
    expect(
      instance.t("Available credits: {{credits}}", { credits: "801" })
    ).toBe("Crediti disponibili: 801");
    expect(
      instance.t("Voice: {{name}}", { name: "Sarah — Bright & clear" })
    ).toBe("Voce: Sarah — Bright & clear");
    expect(
      instance.t("Delete {{name}}", { name: "My original footage.mp4" })
    ).toBe("Elimina My original footage.mp4");
    expect(instance.t("Word rise")).toBe("Parole in salita");
    expect(instance.t("Back one second")).toBe("Indietro di un secondo");
    expect(
      instance.t("Projects updated in the last 7 days: {{count}}", { count: 4 })
    ).toBe("Progetti aggiornati negli ultimi 7 giorni: 4");
    expect(instance.t("Prepare video · no credits")).toBe(
      "Prepara il video · nessun credito"
    );
    expect(
      instance.t("Prioritize “{{goal}}”; it is at {{percent}}% of target.", {
        goal: "My English goal",
        percent: 55,
      })
    ).toBe("Dai priorità a «My English goal»: è al 55% dell'obiettivo.");
    await instance.changeLanguage("de");
    expect(instance.t("Processing load")).not.toBe("Processing load");
    expect(instance.t("Overall score")).not.toBe("Overall score");
    await instance.changeLanguage("en");
    expect(
      instance.t("Projects updated in the last 7 days: {{count}}", { count: 4 })
    ).toBe("Projects updated in the last 7 days: 4");
    expect(
      instance.t("Source note: {{text}}", { text: "A: original text" })
    ).toBe("Source note: A: original text");
  });
});
