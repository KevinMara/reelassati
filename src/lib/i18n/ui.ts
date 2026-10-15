import { useTranslation } from "react-i18next";
import i18n from "./index";

/** Static interface copy. Generated/user content keeps its own chosen language. */
export function useUiText() {
  const { t } = useTranslation("ui");
  return t;
}

/** Display formatters use the selected interface locale, independently of content language. */
export function getUiLocale() {
  return i18n.resolvedLanguage || i18n.language || "en";
}

/** For event-time feedback outside React render; component copy uses the hook. */
export function translateUi(text: string) {
  return i18n.t(text, { ns: "ui", keySeparator: false, nsSeparator: false });
}
