import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { LangSwitcher } from "./LangSwitcher";

export function MarketingFooter() {
  const { t } = useTranslation();
  const links = t("footer.links", { returnObjects: true }) as Record<string, string>;

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
            { label: links.features, to: "/#features" },
            { label: links.pricing, to: "/pricing" },
            { label: links.integrations, to: "/#platforms" },
            { label: links.changelog, to: "#" },
          ]} />
          <FooterCol title={t("footer.resources")} items={[
            { label: links.docs, to: "#" },
            { label: links.blog, to: "#" },
            { label: links.api, to: "#" },
            { label: links.community, to: "#" },
          ]} />
          <FooterCol title={t("footer.company")} items={[
            { label: links.about, to: "#" },
            { label: links.contact, to: "/support" },
            { label: links.privacy, to: "#" },
            { label: links.terms, to: "#" },
          ]} />
        </div>

        <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <p className="mono-eyebrow text-foreground/40">
            © {new Date().getFullYear()} Reelassati · {t("footer.rights")}
          </p>
          <div className="flex items-center gap-1">
            <LangSwitcher />
            <ThemeToggle />
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
