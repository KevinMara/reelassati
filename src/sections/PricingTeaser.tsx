import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { useTranslation } from "react-i18next";

export function PricingTeaser() {
  const { i18n } = useTranslation();
  const isItalian = i18n.resolvedLanguage?.startsWith("it");
  const plans = [
    {
      name: "Creator",
      price: 29,
      scale: isItalian
        ? "1 brand · 2 account social"
        : "1 brand · 2 social accounts",
    },
    {
      name: "Pro",
      price: 79,
      scale: isItalian
        ? "3 brand · 6 account social"
        : "3 brands · 6 social accounts",
    },
    {
      name: "Studio",
      price: 179,
      scale: isItalian
        ? "10 brand · 12 account social"
        : "10 brands · 12 social accounts",
    },
  ];

  return (
    <section className="border-t border-border bg-surface/40 py-24 md:py-36">
      <div className="container-page">
        <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-card">
          <div className="grid lg:grid-cols-[.9fr_1.1fr]">
            <div className="p-8 md:p-12">
              <p className="mono-eyebrow text-primary">
                {isItalian ? "Prezzi" : "Pricing"}
              </p>
              <h2 className="mt-5 text-display-md font-semibold">
                {isItalian ? "Parti da creator." : "Start as a creator."}{" "}
                <span className="serif-accent">
                  {isItalian
                    ? "Scala senza cambiare sistema."
                    : "Scale without changing systems."}
                </span>
              </h2>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-foreground/70">
                {isItalian
                  ? "Lo Studio completo è incluso in ogni piano. Paghi per la scala del workspace, non per sbloccare gli strumenti essenziali."
                  : "The complete Studio is included in every plan. You pay for workspace scale—not to unlock the essential tools."}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-2 rounded-pill bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  {isItalian ? "Confronta i piani" : "Compare plans"}{" "}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  to="/dashboard/edit"
                  className="inline-flex items-center rounded-pill border border-border px-5 py-3 text-sm font-medium text-foreground/70 transition-colors hover:border-primary/30 hover:text-foreground"
                >
                  {isItalian ? "Apri lo Studio" : "Open the Studio"}
                </Link>
              </div>
            </div>

            <div className="border-t border-border bg-surface p-6 md:p-8 lg:border-l lg:border-t-0">
              <div className="grid h-full gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {plans.map((plan, index) => (
                  <Link
                    key={plan.name}
                    to="/pricing"
                    className={`group flex items-center justify-between gap-4 rounded-xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-card ${index === 1 ? "border-primary/30 bg-primary/[0.05]" : "border-border bg-background"}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Check className="h-3 w-3" aria-hidden />
                        </span>
                        <p className="text-sm font-semibold">{plan.name}</p>
                      </div>
                      <p className="mt-2 text-xs text-foreground/45">
                        {plan.scale}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold">€{plan.price}</p>
                      <p className="text-[10px] text-foreground/40">
                        /{isItalian ? "mese" : "month"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
              <p className="mt-5 text-xs leading-relaxed text-foreground/45">
                {isItalian
                  ? "Uso di modelli e generazione video addebitato separatamente dal provider collegato."
                  : "Model and video-generation usage is billed separately by the connected provider."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
