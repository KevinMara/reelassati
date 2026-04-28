import { Video, PenLine, Scissors, Send, BarChart3, Library, Calendar, AtSign, LifeBuoy } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { PlaceholderPage } from "@/components/app/PlaceholderPage";
import { useTranslation } from "react-i18next";

export function Analyze() {
  const { t } = useTranslation();
  return <AppShell renderWith={() => <PlaceholderPage title={t("app.nav.analyze")} icon={Video} />} />;
}
export function Script() {
  const { t } = useTranslation();
  return <AppShell renderWith={() => <PlaceholderPage title={t("app.nav.script")} icon={PenLine} />} />;
}
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
export function LibraryPage() {
  const { t } = useTranslation();
  return <AppShell renderWith={() => <PlaceholderPage title={t("app.nav.library")} icon={Library} />} />;
}
export function CalendarPage() {
  const { t } = useTranslation();
  return <AppShell renderWith={() => <PlaceholderPage title={t("app.nav.calendar")} icon={Calendar} />} />;
}
export function SocialAccounts() {
  const { t } = useTranslation();
  return <AppShell renderWith={() => <PlaceholderPage title={t("app.nav.social")} icon={AtSign} />} />;
}
export function SupportInApp() {
  const { t } = useTranslation();
  return <AppShell renderWith={() => <PlaceholderPage title={t("app.nav.support")} icon={LifeBuoy} />} />;
}
