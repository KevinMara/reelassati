import { Apple, Github } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth, type SocialProvider } from "@/hooks/useAuth";

export function SocialAuthButtons() {
  const { t } = useTranslation();
  const { availableProviders, oauthLogin, loading } = useAuth();
  if (!availableProviders.length) return null;

  const labels: Record<SocialProvider, string> = {
    google: t("auth.google_login"),
    apple: "Continue with Apple",
    azure: "Continue with Microsoft",
    github: "Continue with GitHub",
  };

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {availableProviders.map(provider => (
          <button
            key={provider}
            type="button"
            disabled={loading}
            onClick={() => void oauthLogin(provider)}
            className="group flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background/60 px-4 text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary-wash hover:shadow-md disabled:opacity-50"
          >
            {provider === "google" ? (
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full bg-white font-bold text-[#4285f4] shadow-sm"
                aria-hidden="true"
              >
                G
              </span>
            ) : provider === "apple" ? (
              <Apple className="h-4 w-4" />
            ) : provider === "azure" ? (
              <span
                className="grid h-4 w-4 grid-cols-2 gap-px"
                aria-hidden="true"
              >
                <span className="bg-current" />
                <span className="bg-current" />
                <span className="bg-current" />
                <span className="bg-current" />
              </span>
            ) : (
              <Github className="h-4 w-4" />
            )}
            {labels[provider]}
          </button>
        ))}
      </div>
      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("auth.or")}
        <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}
