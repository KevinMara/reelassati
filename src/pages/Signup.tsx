import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Globe, Sun, Moon, Eye, EyeOff } from "lucide-react";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default function Signup() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { signup, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const toggleLang = () => i18n.changeLanguage(i18n.language === "it" ? "en" : "it");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError(i18n.language === "it" ? "Minimo 8 caratteri" : "Minimum 8 characters");
      return;
    }
    const ok = signup(name, email, password);
    if (ok) navigate("/dashboard");
    else setError(i18n.language === "it" ? "Email gi\u00e0 registrata" : "Email already registered");
  };

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
          <h1 className="text-4xl font-bold tracking-tight mb-2">{t("auth.signup.title")}</h1>
          <p className="text-base text-muted-foreground">{t("auth.signup.subtitle")}</p>
        </div>

        <div className="w-full max-w-sm bg-surface rounded-2xl border border-border p-6 shadow-card">
          {error && <p className="mb-4 text-sm text-destructive text-center">{error}</p>}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-[10px] font-mono tracking-[0.15em] uppercase text-muted-foreground mb-2">{t("auth.name")}</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full h-11 px-4 rounded-xl bg-surface-recessed border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder={t("auth.placeholder_name")} required />
            </div>
            <div>
              <label className="block text-[10px] font-mono tracking-[0.15em] uppercase text-muted-foreground mb-2">{t("auth.email")}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-11 px-4 rounded-xl bg-surface-recessed border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder={t("auth.placeholder_email")} required />
            </div>
            <div>
              <label className="block text-[10px] font-mono tracking-[0.15em] uppercase text-muted-foreground mb-2">{t("auth.password")}</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-11 px-4 pr-10 rounded-xl bg-surface-recessed border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Min. 8" required />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button type="submit" className="w-full h-11 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover rounded-pill transition-colors">{t("auth.signup_btn")}</button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center"><span className="bg-surface px-3 text-[10px] font-mono tracking-wider uppercase text-muted-foreground">{t("auth.or")}</span></div>
          </div>

          <button
            type="button"
            onClick={googleLogin}
            className="w-full h-11 flex items-center justify-center gap-2.5 text-sm font-medium text-foreground bg-surface border border-border rounded-pill hover:bg-surface-recessed transition-colors"
          >
            <GoogleIcon />
            {t("auth.google_signup")}
          </button>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          {t("auth.has_account")}{" "}
          <Link to="/auth/login" className="text-primary hover:text-primary-hover font-medium transition-colors">{t("nav.login")}</Link>
        </p>
      </main>
    </div>
  );
}
