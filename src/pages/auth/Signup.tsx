import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout, Field, GoogleButton } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export default function Signup() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [pw, setPw] = useState("");

  // crude meter, 0–4
  const strength = (() => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  })();

  return (
    <AuthLayout
      title={t("auth.signup_title")}
      sub={t("auth.signup_sub")}
      footer={
        <>
          {t("auth.have_account")}{" "}
          <Link to="/auth/login" className="text-primary font-medium hover:underline">
            {t("auth.sign_in")}
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
        <Field name="name" label={t("auth.name")} required autoComplete="name" />
        <Field name="email" type="email" label={t("auth.email")} required autoComplete="email" />

        <div>
          <label className="block">
            <span className="mono-eyebrow text-foreground/55 mb-2 block">{t("auth.password")}</span>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full bg-surface-recessed border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-md px-4 py-3 text-base outline-none transition-all duration-200"
              />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground" aria-label={show ? t("auth.hide") : t("auth.show")}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          <div className="mt-2.5 flex gap-1.5" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  i < strength
                    ? strength <= 1 ? "bg-destructive" : strength === 2 ? "bg-warning" : "bg-success"
                    : "bg-border-strong"
                }`}
              />
            ))}
          </div>
        </div>

        <label className="flex items-start gap-3 text-sm text-foreground/70 cursor-pointer">
          <Checkbox id="tos" required className="mt-0.5" />
          <span>{t("auth.terms")}</span>
        </label>

        <Button type="submit" variant="primary" size="lg" className="w-full justify-center mt-2">
          {t("auth.signup_btn")}
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="mono-eyebrow text-foreground/40">{t("auth.or")}</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <GoogleButton label={t("auth.continue_google")} />
      </form>
    </AuthLayout>
  );
}
