import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  OPEN_PRIVACY_PREFERENCES_EVENT,
  PRIVACY_PREFERENCES_EVENT,
  readPrivacyPreferences,
  savePrivacyPreferences,
  type PrivacyPreferences,
} from "@/lib/privacy-consent";

export function usePrivacyPreferences() {
  const [preferences, setPreferences] = useState<PrivacyPreferences | null>(
    () => readPrivacyPreferences()
  );

  useEffect(() => {
    const update = () => setPreferences(readPrivacyPreferences());
    window.addEventListener(PRIVACY_PREFERENCES_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(PRIVACY_PREFERENCES_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return preferences;
}

export function PrivacyChoices() {
  const { i18n } = useTranslation();
  const isItalian = i18n.resolvedLanguage?.startsWith("it");
  const saved = usePrivacyPreferences();
  const [open, setOpen] = useState(() => saved === null);
  const [analytics, setAnalytics] = useState(saved?.analytics ?? false);
  const [externalMedia, setExternalMedia] = useState(
    saved?.externalMedia ?? false
  );

  useEffect(() => {
    const show = () => {
      const current = readPrivacyPreferences();
      setAnalytics(current?.analytics ?? false);
      setExternalMedia(current?.externalMedia ?? false);
      setOpen(true);
    };
    window.addEventListener(OPEN_PRIVACY_PREFERENCES_EVENT, show);
    return () =>
      window.removeEventListener(OPEN_PRIVACY_PREFERENCES_EVENT, show);
  }, []);

  const commit = (next: { analytics: boolean; externalMedia: boolean }) => {
    savePrivacyPreferences(next);
    setAnalytics(next.analytics);
    setExternalMedia(next.externalMedia);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <section
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-2xl border border-border bg-surface p-5 shadow-modal sm:bottom-5 sm:p-6"
      role="dialog"
      aria-modal="false"
      aria-labelledby="privacy-choices-title"
    >
      {saved ? (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 rounded-lg p-2 text-foreground/55 hover:bg-background hover:text-foreground"
          aria-label={isItalian ? "Chiudi preferenze" : "Close preferences"}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
      <div className="flex items-start gap-3 pr-8">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Cookie className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 id="privacy-choices-title" className="font-semibold">
            {isItalian ? "Le tue scelte sulla privacy" : "Your privacy choices"}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-foreground/65">
            {isItalian
              ? "Usiamo sempre solo le tecnologie necessarie al servizio. Analytics e contenuti social incorporati restano disattivati finché non li autorizzi."
              : "We always use only the technology needed to provide the service. Analytics and embedded social media stay off until you allow them."}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3 text-sm">
          <input
            id="privacy-necessary"
            type="checkbox"
            checked
            disabled
            aria-label={
              isItalian ? "Tecnologie necessarie" : "Necessary technology"
            }
            className="mt-0.5 accent-primary"
          />
          <span>
            <strong>{isItalian ? "Necessari" : "Necessary"}</strong>
            <span className="mt-0.5 block text-xs text-foreground/55">
              {isItalian
                ? "Accesso, sicurezza, saldo, preferenze e funzioni richieste."
                : "Sign-in, security, balance, preferences, and requested features."}
            </span>
          </span>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3 text-sm">
          <input
            id="privacy-analytics"
            type="checkbox"
            checked={analytics}
            onChange={event => setAnalytics(event.target.checked)}
            aria-label={isItalian ? "Consenti analytics" : "Allow analytics"}
            className="mt-0.5 accent-primary"
          />
          <span>
            <strong>Analytics</strong>
            <span className="mt-0.5 block text-xs text-foreground/55">
              {isItalian
                ? "Misurazione facoltativa per migliorare il prodotto."
                : "Optional measurement used to improve the product."}
            </span>
          </span>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3 text-sm sm:col-span-2">
          <input
            id="privacy-external-media"
            type="checkbox"
            checked={externalMedia}
            onChange={event => setExternalMedia(event.target.checked)}
            aria-label={
              isItalian
                ? "Consenti media social esterni"
                : "Allow external social media"
            }
            className="mt-0.5 accent-primary"
          />
          <span>
            <strong>
              {isItalian ? "Media social esterni" : "External social media"}
            </strong>
            <span className="mt-0.5 block text-xs text-foreground/55">
              {isItalian
                ? "Carica player di TikTok, Instagram e YouTube, che possono ricevere dati tecnici."
                : "Loads TikTok, Instagram, and YouTube players, which may receive technical data."}
            </span>
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        <Link
          to="/cookies"
          className="px-1 text-xs text-primary hover:underline"
        >
          {isItalian ? "Leggi la Cookie Policy" : "Read the Cookie Policy"}
        </Link>
        <div className="flex flex-1 flex-col gap-2 sm:ml-auto sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => commit({ analytics: false, externalMedia: false })}
            className="rounded-pill border border-border bg-background px-4 py-2.5 text-sm font-medium hover:border-primary/35"
          >
            {isItalian ? "Solo necessari" : "Necessary only"}
          </button>
          <button
            type="button"
            onClick={() => commit({ analytics, externalMedia })}
            className="rounded-pill border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-primary/15"
          >
            {isItalian ? "Salva scelte" : "Save choices"}
          </button>
          <button
            type="button"
            onClick={() => commit({ analytics: true, externalMedia: true })}
            className="rounded-pill bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            {isItalian ? "Consenti facoltativi" : "Allow optional"}
          </button>
        </div>
      </div>
    </section>
  );
}
