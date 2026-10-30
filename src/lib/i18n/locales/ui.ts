import { studioPolishUi } from "./ui-studio-polish";
import { editorOct30Ui } from "./ui-editor-oct30";
import { translatePresetNames } from "@contracts/editor-presets";
import { automaticResearchDisabled } from "./ui-manual-only";
import { stylesWorkspaceUi } from "./ui-styles-workspace";
import { editorReceiptUi } from "./ui-editor-receipts";
import { guidedTourUi } from "./ui-guided-tour";
import { librarySourceUi } from "./ui-library-sources";
import { editingTemplateUi } from "./ui-edit-templates";
import { editingTraitUi } from "./ui-edit-template-traits";
import { italianUi } from "./ui-it";
import { existingItalianUi } from "./ui-it-existing";
import { westernUi } from "./ui-critical-west";
import { easternUi } from "./ui-critical-east";
import { cjkArabicUi } from "./ui-critical-cjk-ar";
import { asianUi } from "./ui-critical-asian";
import { europeanUi } from "./ui-critical-europe";
import { frenchUi } from "./ui-fr";
import { spanishUi } from "./ui-es";
import { germanUi } from "./ui-de";
import { portugueseUi } from "./ui-pt";
import { dutchUi } from "./ui-nl";
import { polishUi } from "./ui-pl";
import { turkishUi } from "./ui-tr";
import { romanianUi } from "./ui-ro";
import { danishUi } from "./ui-da";
import { czechUi } from "./ui-cs";
import { indonesianUi } from "./ui-id";
import { swedishUi } from "./ui-sv";
import { analyzerUi } from "./ui-analyzer";
import { editDurationUi } from "./ui-edit-duration";
import { editorRedesignUi } from "./ui-editor-redesign";
import { editorInteractionUi } from "./ui-editor-interactions";
import { hungarianUi } from "./ui-hu";
import { norwegianUi } from "./ui-no";
import { vietnameseUi } from "./ui-vi";
import { greekUi } from "./ui-el";
import { japaneseUi } from "./ui-ja";
import { finnishUi } from "./ui-fi";
import { chineseUi } from "./ui-zh";
import { ukrainianUi } from "./ui-uk";
import { koreanUi } from "./ui-ko";
import { thaiUi } from "./ui-th";
import { russianUi } from "./ui-ru";
import { arabicUi } from "./ui-ar";
import { hindiUi } from "./ui-hi";
import { hebrewUi } from "./ui-he";

/** Literal-source keys make untranslated interface copy visible to the audit. */
export const uiLocales: Record<string, Record<string, string>> = {
  en: {},
  it: { ...existingItalianUi, ...italianUi },
  ...westernUi,
  ...easternUi,
  ...cjkArabicUi,
  ...asianUi,
  ...europeanUi,
  fr: { ...frenchUi, ...westernUi.fr },
  es: { ...spanishUi, ...westernUi.es },
  de: { ...germanUi, ...westernUi.de },
  pt: { ...portugueseUi, ...westernUi.pt },
  nl: { ...dutchUi, ...europeanUi.nl },
  pl: { ...polishUi, ...easternUi.pl },
  tr: { ...turkishUi, ...easternUi.tr },
  ro: { ...romanianUi, ...easternUi.ro },
  da: { ...danishUi, ...europeanUi.da },
  cs: { ...czechUi, ...europeanUi.cs },
  id: { ...indonesianUi, ...asianUi.id },
  sv: { ...swedishUi, ...europeanUi.sv },
  hu: { ...hungarianUi, ...europeanUi.hu },
  no: { ...norwegianUi, ...europeanUi.no },
  vi: { ...vietnameseUi, ...asianUi.vi },
  el: { ...greekUi, ...europeanUi.el },
  ja: { ...japaneseUi, ...cjkArabicUi.ja },
  fi: { ...finnishUi, ...europeanUi.fi },
  zh: { ...chineseUi, ...cjkArabicUi.zh },
  uk: { ...ukrainianUi, ...easternUi.uk },
  ko: { ...koreanUi, ...cjkArabicUi.ko },
  th: { ...thaiUi, ...asianUi.th },
  ru: { ...russianUi, ...easternUi.ru },
  ar: { ...arabicUi, ...cjkArabicUi.ar },
  hi: { ...hindiUi, ...asianUi.hi },
  he: { ...hebrewUi, ...asianUi.he },
};

for (const [language, translation] of Object.entries(editorReceiptUi)) {
  if (language !== "en") Object.assign(uiLocales[language], translation);
}
for (const [language, translation] of Object.entries(guidedTourUi)) {
  if (language !== "en") Object.assign(uiLocales[language], translation);
}
for (const [language, translation] of Object.entries(librarySourceUi)) {
  if (language !== "en") Object.assign(uiLocales[language], translation);
}

for (const [language, translation] of Object.entries(editorRedesignUi)) {
  Object.assign(uiLocales[language], translation);
}
for (const [language, translation] of Object.entries(editorInteractionUi)) {
  Object.assign(uiLocales[language], translation);
}

for (const [language, translation] of Object.entries(
  automaticResearchDisabled
)) {
  uiLocales[language]["Automatic research is disabled."] = translation;
}
for (const [language, translation] of Object.entries(editingTemplateUi)) {
  Object.assign(uiLocales[language], translation);
}
for (const [language, translation] of Object.entries(analyzerUi)) {
  Object.assign(uiLocales[language], translation);
}
for (const [language, translation] of Object.entries(editDurationUi)) {
  for (const [key, value] of Object.entries(translation))
    uiLocales[language][key] ??= value;
}
for (const [language, translation] of Object.entries(editingTraitUi)) {
  for (const [key, value] of Object.entries(translation))
    uiLocales[language][key] ??= value;
}
for (const [language, translation] of Object.entries(stylesWorkspaceUi)) {
  Object.assign(uiLocales[language], translation);
}

for (const [code, catalog] of Object.entries(uiLocales))
  if (code !== "en") Object.assign(catalog, translatePresetNames(catalog));

for (const [code, entries] of Object.entries(editorOct30Ui))
  Object.assign(uiLocales[code], entries);

for (const [code, entries] of Object.entries(studioPolishUi))
  Object.assign(uiLocales[code as keyof typeof uiLocales], entries);
