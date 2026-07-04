import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Globe, Sun, Moon } from "lucide-react";
import { Logo } from "./Logo";
import { useTheme } from "@/hooks/useTheme";

export function Footer() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === "it" ? "en" : "it");
  };

  return (
    <footer className="border-t border-border bg-background mt-32">
      <div className="container-page py-16 md:py-24">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-10">
          <div className="col-span-2 md:col-span-5">
            <Logo size="lg" />
            <p className="mt-5 text-sm text-foreground/60 max-w-xs leading-relaxed">
              {t("footer.tagline")}
            </p>
            <p className="mt-8 mono-eyebrow text-foreground/40">{t("footer.made_in")}</p>
          </div>

          <FooterCol title={t("footer.product")} items={[
            { label: t("nav.features"), to: "/#features" },
            { label: t("nav.pricing"), to: "/pricing" },
            { label: t("nav.support"), to: "/support" },
            { label: t("footer.changelog"), to: "#" },
          ]} />
          <FooterCol title={t("footer.resources")} items={[
            { label: t("footer.documentation"), to: "#" },
            { label: t("footer.blog"), to: "#" },
            { label: t("footer.api"), to: "#" },
            { label: t("footer.community"), to: "#" },
          ]} />
          <FooterCol title={t("footer.company")} items={[
            { label: t("footer.about"), to: "#" },
            { label: t("footer.contact"), to: "/support" },
            { label: t("footer.privacy"), to: "#" },
            { label: t("footer.terms"), to: "#" },
          ]} />
        </div>

        <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <p className="mono-eyebrow text-foreground/40">
            &copy; {new Date().getFullYear()} Reelassati &middot; {t("footer.copyright")}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={toggleLang} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground px-2 py-1 transition-colors">
              <Globe className="h-3.5 w-3.5" /> {i18n.language === "it" ? "IT" : "EN"}
            </button>
            <button onClick={toggleTheme} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
              {theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: { label: string; to: string }[] }) {
  return (
    <div className="md:col-span-2">
      <h4 className="mono-eyebrow text-foreground/50 mb-4">{title}</h4>
      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.label}>
            <Link to={it.to} className="text-sm text-foreground/75 hover:text-foreground transition-colors">
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
