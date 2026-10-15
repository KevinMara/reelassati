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
};
