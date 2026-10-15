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
};
