import { Scissors, Send, BarChart3, LifeBuoy } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { PlaceholderPage } from "@/components/app/PlaceholderPage";
import { useTranslation } from "react-i18next";

export function Edit() {
  const { t } = useTranslation();
  return <AppShell renderWith={() => <PlaceholderPage title={t("app.nav.edit")} icon={Scissors} />} />;
}
export function Publish() {
  const { t } = useTranslation();
  return <AppShell renderWith={() => <PlaceholderPage title={t("app.nav.publish")} icon={Send} />} />;
}
export function Analytics() {
  const { t } = useTranslation();
  return <AppShell renderWith={() => <PlaceholderPage title={t("app.nav.analytics")} icon={BarChart3} />} />;
}
export function SupportInApp() {
  const { t } = useTranslation();
  return <AppShell renderWith={() => <PlaceholderPage title={t("app.nav.support")} icon={LifeBuoy} />} />;
}
