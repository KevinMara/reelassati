import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthLayout, Field, GoogleButton } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export default function Signup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [pw, setPw] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  // crude meter, 0–4
  const strength = (() => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  })();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password: pw,
        options: {
          data: {
            full_name: name,
          },
        },
      });
      if (error) {
        if (error.message.toLowerCase().includes("already registered")) {
          toast.error(t("auth.toast.already_registered"));
        } else {
          toast.error(error.message || t("auth.toast.generic_error"));
        }
        return;
      }
      toast.success(t("auth.toast.check_email"));
      navigate("/auth/login");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error(t("auth.toast.generic_error"));
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate("/");
  }

  return (
    <AuthLayout
      title={t("auth.signup.title")}
      sub={t("auth.signup.sub")}
      footer={
        <>
          {t("auth.signup.have_account")}{" "}
          <Link to="/auth/login" className="text-primary font-medium hover:underline">
            {t("auth.signup.login_link")}
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <Field name="name" label={t("auth.signup.name")} required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
        <Field name="email" type="email" label={t("auth.signup.email")} required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />

        <div>
          <Field
            name="password"
            type={show ? "text" : "password"}
            label={t("auth.signup.password")}
            required
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            disabled={loading}
            rightSlot={
              <button type="button" onClick={() => setShow((s) => !s)} className="text-foreground/50 hover:text-foreground transition-colors" aria-label={show ? t("auth.hide") : t("auth.show")}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
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

        <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full justify-center mt-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.signup.submit")}
        </Button>

        <div className="flex items-center gap-3 py-2">
          <div className="flex-1 h-px bg-border" />
          <span className="mono-eyebrow text-foreground/40 text-[10px]">{t("auth.signup.or")}</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <GoogleButton label={t("auth.signup.google")} onClick={onGoogle} disabled={loading} />
      </form>
    </AuthLayout>
  );
}
