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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [tos, setTos] = useState(false);
  const [loading, setLoading] = useState(false);

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
    if (!tos) {
      toast.error(t("auth.toast.tos_required"));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password: pw,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { display_name: name, name },
        },
      });
      if (error) {
        if (error.message.toLowerCase().includes("registered") || error.message.toLowerCase().includes("already")) {
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
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
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
      <form className="space-y-5" onSubmit={onSubmit}>
        <Field name="name" label={t("auth.name")} required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
        <Field name="email" type="email" label={t("auth.email")} required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />

        <div>
          <label className="block">
            <span className="mono-eyebrow text-foreground/55 mb-2 block">{t("auth.password")}</span>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                required
                minLength={8}
                disabled={loading}
                autoComplete="new-password"
                className="w-full bg-surface-recessed border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-md px-4 py-3 text-base outline-none transition-all duration-200 disabled:opacity-60"
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
          <Checkbox id="tos" checked={tos} onCheckedChange={(v) => setTos(v === true)} className="mt-0.5" />
          <span>{t("auth.terms")}</span>
        </label>

        <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full justify-center mt-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.signup_btn")}
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="mono-eyebrow text-foreground/40">{t("auth.or")}</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <GoogleButton label={t("auth.continue_google")} onClick={onGoogle} disabled={loading} />
      </form>
    </AuthLayout>
  );
}
