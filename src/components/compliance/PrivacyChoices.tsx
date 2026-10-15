import { useUiText } from "@/lib/i18n/ui";
import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";
import { Link } from "react-router-dom";

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
  const ui = useUiText();

  const saved = usePrivacyPreferences();
  const [expanded, setExpanded] = useState(false);
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
      setExpanded(true);
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
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-h-[85dvh] overflow-y-auto max-w-3xl rounded-2xl border border-border bg-surface p-5 shadow-modal sm:bottom-5 sm:p-6"
      role="dialog"
      aria-modal="false"
      aria-labelledby="privacy-choices-title"
    >
      {saved ? (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 rounded-lg p-2 text-foreground/55 hover:bg-background hover:text-foreground"
          aria-label={ui("Close preferences")}
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
            {ui("Your privacy choices")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-foreground/65">
            {ui(
              "Necessary cookies keep the studio working. Optional analytics and social embeds stay off until you choose."
            )}
          </p>
        </div>
      </div>

      {expanded && (
        <div id="privacy-details" className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3 text-sm">
            <input
              id="privacy-necessary"
              type="checkbox"
              checked
              disabled
              aria-label={ui("Necessary technology")}
              className="mt-0.5 accent-primary"
            />
            <span>
              <strong>{ui("Necessary")}</strong>
              <span className="mt-0.5 block text-xs text-foreground/55">
                {ui(
                  "Sign-in, security, balance, preferences, and requested features."
                )}
              </span>
            </span>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3 text-sm">
            <input
              id="privacy-analytics"
              type="checkbox"
              checked={analytics}
              onChange={event => setAnalytics(event.target.checked)}
              aria-label={ui("Allow analytics")}
              className="mt-0.5 accent-primary"
            />
            <span>
              <strong>{ui("Analytics")}</strong>
              <span className="mt-0.5 block text-xs text-foreground/55">
                {ui("Optional measurement used to improve the product.")}
              </span>
            </span>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3 text-sm sm:col-span-2">
            <input
              id="privacy-external-media"
              type="checkbox"
              checked={externalMedia}
              onChange={event => setExternalMedia(event.target.checked)}
              aria-label={ui("Allow external social media")}
              className="mt-0.5 accent-primary"
            />
            <span>
              <strong>{ui("External social media")}</strong>
              <span className="mt-0.5 block text-xs text-foreground/55">
                {ui(
                  "Loads TikTok, Instagram, and YouTube players, which may receive technical data."
                )}
              </span>
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        <Link
          to="/cookies"
          className="px-1 text-xs text-primary hover:underline"
        >
          {ui("Read the Cookie Policy")}
        </Link>
        <div className="flex flex-1 flex-col gap-2 sm:ml-auto sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => commit({ analytics: false, externalMedia: false })}
            className="rounded-pill border border-border bg-background px-4 py-2.5 text-sm font-medium hover:border-primary/35"
          >
            {ui("Necessary only")}
          </button>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="privacy-details"
            onClick={() =>
              expanded
                ? commit({ analytics, externalMedia })
                : setExpanded(true)
            }
            className="rounded-pill border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-primary/15"
          >
            {expanded ? ui("Save choices") : ui("Customize")}
          </button>
          <button
            type="button"
            onClick={() => commit({ analytics: true, externalMedia: true })}
            className="rounded-pill border border-border bg-background px-4 py-2.5 text-sm font-medium hover:border-primary/35"
          >
            {ui("Allow optional")}
          </button>
        </div>
      </div>
    </section>
  );
}
