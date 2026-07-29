import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { useTranslation } from "react-i18next";

export function PricingTeaser() {
  const { i18n } = useTranslation();
  const isItalian = i18n.resolvedLanguage?.startsWith("it");
  const included = isItalian
    ? ["Studio di montaggio e workspace", "Anteprime e piani locali", "Connessioni esterne solo se configurate"]
    : ["Editing Studio and workspace", "Local previews and plans", "External providers only when configured"];

  return (
    <section className="border-t border-border bg-surface/40 py-24 md:py-36">
      <div className="container-page">
        <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-card">
          <div className="grid lg:grid-cols-[1.15fr_.85fr]">
            <div className="p-8 md:p-12">
              <div className="flex flex-wrap items-center gap-3">
                <p className="mono-eyebrow text-primary">{isItalian ? "Accesso" : "Access"}</p>
                <span className="rounded-pill bg-primary/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-primary">
                  {isItalian ? "Checkpoint privato" : "Private checkpoint"}
                </span>
              </div>
              <h2 className="mt-5 text-display-md font-semibold">
                {isItalian ? "Costruiamo il prodotto prima" : "Build the product first"}{" "}
                <span className="serif-accent">{isItalian ? "del listino." : "of the price table."}</span>
              </h2>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-foreground/70">
                {isItalian
                  ? "REELassati è in beta privata. Non c’è un checkout pubblico e non presentiamo piani finti: la pagina prezzi mostra esattamente cosa è disponibile ora e cosa richiede configurazione."
                  : "REELassati is in private beta. There is no public checkout and no pretend plan table: the pricing page shows exactly what is available now and what still requires configuration."}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-2 rounded-pill bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  {isItalian ? "Vedi lo stato beta" : "See beta access"} <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  to="/dashboard/edit"
                  className="inline-flex items-center rounded-pill border border-border px-5 py-3 text-sm font-medium text-foreground/70 transition-colors hover:border-primary/30 hover:text-foreground"
                >
                  {isItalian ? "Apri lo Studio" : "Open the Studio"}
                </Link>
              </div>
            </div>

            <div className="border-t border-border bg-surface p-8 md:p-10 lg:border-l lg:border-t-0">
              <p className="mono-eyebrow text-foreground/45">{isItalian ? "Questo checkpoint include" : "This checkpoint includes"}</p>
              <ul className="mt-6 space-y-4">
                {included.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-foreground/70">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-3 w-3" aria-hidden />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-8 border-t border-border pt-5 text-xs leading-relaxed text-foreground/45">
                {isItalian
                  ? "Eventuali prezzi futuri saranno mostrati prima di qualsiasi addebito. Questo checkpoint non avvia pagamenti."
                  : "Any future pricing will be shown before a charge can occur. This checkpoint does not initiate payments."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
