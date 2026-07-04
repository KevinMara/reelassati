import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useTranslation } from "react-i18next";

export default function Pricing() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <h1 className="text-4xl font-bold tracking-tight mb-4">{t("pricing.title")}</h1>
        <p className="text-muted-foreground">{t("pricing.coming_soon")}</p>
      </main>
      <Footer />
    </div>
  );
}
