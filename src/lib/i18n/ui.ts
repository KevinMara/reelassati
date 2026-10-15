import { useTranslation } from "react-i18next";
import i18n from "./index";

/** Static interface copy. Generated/user content keeps its own chosen language. */
export function useUiText() {
  const { t } = useTranslation("ui");
  return t;
}

/** For event-time feedback outside React render; component copy uses the hook. */
export function translateUi(text: string) {
  return i18n.t(text, { ns: "ui", keySeparator: false, nsSeparator: false });
}
