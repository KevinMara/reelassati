import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/Logo";
import { useTheme } from "@/hooks/useTheme";
import { Globe, Sun, Moon, Mail } from "lucide-react";

export default function ForgotPassword() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const toggleLang = () => i18n.changeLanguage(i18n.language === "it" ? "en" : "it");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <nav className="flex items-center justify-center gap-4 py-6">
        <Link to="/" aria-label="Reelassati home"><Logo size="md" /></Link>
        <div className="h-4 w-px bg-border" />
        <button onClick={toggleLang} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Globe className="h-3.5 w-3.5" /> {i18n.language === "it" ? "IT" : "EN"}
        </button>
        <button onClick={toggleTheme} className="text-muted-foreground hover:text-foreground transition-colors">
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-4">
        <div className="w-full max-w-sm text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">{t("auth.forgot.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("auth.forgot.subtitle")}</p>
        </div>

        {sent ? (
          <div className="w-full max-w-sm text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-primary-wash text-primary flex items-center justify-center mx-auto">
              <Mail className="h-6 w-6" />
            </div>
            <p className="text-sm text-muted-foreground">{t("auth.forgot.sent")}</p>
            <Link to="/auth/login" className="text-primary hover:text-primary-hover text-sm font-medium transition-colors">{t("auth.back_to_login")}</Link>
          </div>
        ) : (
          <div className="w-full max-w-sm">
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
              <div>
                <label className="block text-[10px] font-mono tracking-[0.15em] uppercase text-muted-foreground mb-2">{t("auth.email")}</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-11 px-4 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder={t("auth.placeholder_email")} required />
              </div>
              <button type="submit" className="w-full h-11 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover rounded-pill transition-colors">{t("auth.send_reset")}</button>
            </form>
            <Link to="/auth/login" className="flex items-center justify-center gap-1 text-sm text-primary hover:text-primary-hover mt-6 transition-colors">&larr; {t("auth.back_to_login")}</Link>
          </div>
        )}
      </main>
    </div>
  );
}
