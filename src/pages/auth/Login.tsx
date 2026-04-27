import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout, Field, GoogleButton } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";

export default function Login() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  return (
    <AuthLayout
      title={t("auth.login_title")}
      sub={t("auth.login_sub")}
      footer={
        <>
          {t("auth.no_account")}{" "}
          <Link to="/auth/signup" className="text-primary font-medium hover:underline">
            {t("auth.sign_up")}
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
        <Field name="email" type="email" label={t("auth.email")} required autoComplete="email" />
        <div>
          <Field
            name="password"
            type={show ? "text" : "password"}
            label={t("auth.password")}
            required
            autoComplete="current-password"
            rightSlot={
              <button type="button" onClick={() => setShow((s) => !s)} className="text-foreground/50 hover:text-foreground transition-colors" aria-label={show ? t("auth.hide") : t("auth.show")}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          <div className="mt-2 text-right">
            <Link to="/auth/forgot-password" className="text-xs text-foreground/55 hover:text-foreground transition-colors">
              {t("auth.forgot")}
            </Link>
          </div>
        </div>

        <Button type="submit" variant="primary" size="lg" className="w-full justify-center mt-2">
          {t("auth.login_btn")}
        </Button>

        <Divider label={t("auth.or")} />
        <GoogleButton label={t("auth.continue_google")} />
      </form>
    </AuthLayout>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-border" />
      <span className="mono-eyebrow text-foreground/40">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
