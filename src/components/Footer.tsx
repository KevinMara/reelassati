import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Globe, Moon, Sun } from "lucide-react";
import { Logo } from "./Logo";
import { useTheme } from "@/hooks/useTheme";

export function Footer() {
  const { i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isItalian = i18n.resolvedLanguage?.startsWith("it");

  const toggleLang = () => {
    void i18n.changeLanguage(isItalian ? "en" : "it");
  };

  return (
    <footer className="mt-32 border-t border-border bg-background">
      <div className="container-page py-16 md:py-24">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-12">
          <div className="col-span-2 md:col-span-5">
            <Logo size="lg" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-foreground/60">
              {isItalian
                ? "Lo studio short-form centrato sul montaggio: controllo manuale, assistenza revisionabile e un flusso completo dall’idea alla consegna."
                : "The editing-first short-form studio: manual control, reviewable assistance, and one complete path from idea to delivery."}
            </p>
            <span className="mt-7 inline-flex rounded-pill bg-primary/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-primary">
              {isItalian ? "Checkpoint beta privato" : "Private beta checkpoint"}
            </span>
          </div>

          <FooterCol
            title={isItalian ? "Prodotto" : "Product"}
            items={[
              { label: isItalian ? "Funzioni" : "Capabilities", to: "/#features" },
              { label: isItalian ? "Esempi" : "Walkthroughs", to: "/showcase" },
              { label: "Prompt Director", to: "/templates" },
              { label: isItalian ? "Accesso beta" : "Beta access", to: "/pricing" },
            ]}
          />
          <FooterCol
            title="Studio"
            items={[
              { label: isItalian ? "Montaggio" : "Editing", to: "/dashboard/edit" },
              { label: "Script", to: "/dashboard/script" },
              { label: isItalian ? "Generazione video" : "Video generation", to: "/dashboard/video" },
              { label: isItalian ? "Consegna" : "Delivery", to: "/dashboard/publish" },
            ]}
          />
          <FooterCol
            title={isItalian ? "Aiuto" : "Help"}
            items={[
              { label: isItalian ? "Piano locale" : "Local edit plan", to: "/#edit-plan" },
              { label: isItalian ? "Guida rapida" : "Quick start", to: "/support" },
              { label: "FAQ", to: "/support#faq" },
              { label: isItalian ? "Contatto" : "Contact", to: "/support" },
            ]}
          />
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-6 border-t border-border pt-8 md:flex-row md:items-center">
          <p className="mono-eyebrow text-foreground/40">
            &copy; {new Date().getFullYear()} REELassati · {isItalian ? "Tutti i diritti riservati" : "All rights reserved"}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleLang}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              aria-label={isItalian ? "Passa all’inglese" : "Switch to Italian"}
            >
              <Globe className="h-3.5 w-3.5" aria-hidden /> {isItalian ? "IT" : "EN"}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={theme === "light"
                ? isItalian ? "Attiva tema scuro" : "Use dark theme"
                : isItalian ? "Attiva tema chiaro" : "Use light theme"}
            >
              {theme === "light" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
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
      <h2 className="mono-eyebrow mb-4 text-foreground/50">{title}</h2>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={`${title}-${item.label}`}>
            {item.to.includes("#") ? (
              <a href={item.to} className="text-sm text-foreground/75 transition-colors hover:text-foreground">
                {item.label}
              </a>
            ) : (
              <Link to={item.to} className="text-sm text-foreground/75 transition-colors hover:text-foreground">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
