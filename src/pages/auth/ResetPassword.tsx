import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        toast.error(error.message || t("auth.toast.generic_error"));
        return;
      }
      toast.success(t("auth.toast.password_updated"));
      navigate("/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title={t("auth.reset_title")} sub={t("auth.reset_sub")}>
      <form className="space-y-5" onSubmit={onSubmit}>
        <label className="block">
          <span className="mono-eyebrow text-foreground/55 mb-2 block">{t("auth.new_password")}</span>
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
        <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full justify-center">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.update_password")}
        </Button>
      </form>
    </AuthLayout>
  );
}
