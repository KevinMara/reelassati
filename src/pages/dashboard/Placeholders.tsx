import { LifeBuoy } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { PlaceholderPage } from "@/components/app/PlaceholderPage";
import { useTranslation } from "react-i18next";

export function SupportInApp() {
  const { t } = useTranslation();
  return <AppShell renderWith={() => <PlaceholderPage title={t("app.nav.support")} icon={LifeBuoy} />} />;
}
