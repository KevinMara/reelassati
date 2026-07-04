import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export function PricingTeaser() {
  const { t } = useTranslation();
  return (
    <section className="py-24 md:py-36 bg-surface/40 border-t border-border">
      <div className="container-page">
        <div className="max-w-3xl">
          <p className="mono-eyebrow text-primary mb-4">{t("pricing.eyebrow")}</p>
          <h2 className="text-display-md font-semibold">{t("pricing.lead")} <span className="serif-accent">{t("pricing.accent")}</span></h2>
          <p className="mt-6 text-lg text-foreground/70 leading-relaxed max-w-xl">{t("pricing.sub")}</p>
        </div>
        <div className="mt-16 flex justify-center">
          <Link to="/pricing" className="inline-flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover px-6 py-3 rounded-pill transition-colors">
            {t("pricing.view")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
