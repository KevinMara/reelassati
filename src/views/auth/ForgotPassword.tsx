import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, ArrowLeft } from "lucide-react";
import { AuthLayout, Field } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) {
        toast.error(error.message || t("auth.toast.generic_error"));
        return;
      }
      setSent(true);
      toast.success(t("auth.toast.reset_sent"));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout title={t("auth.forgot_title")} sub={t("auth.toast.reset_sent")}>
        <div className="space-y-6">
          <p className="text-center text-foreground/70">
            {t("auth.forgot_sub")}
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/auth/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("auth.back_login")}
            </Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("auth.forgot_title")}
      sub={t("auth.forgot_sub")}
      footer={
        <Link to="/auth/login" className="text-primary font-medium hover:underline">
          {t("auth.back_login")}
        </Link>
      }
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <Field
          name="email"
          type="email"
          label={t("auth.email")}
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
        <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full justify-center mt-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.send_link")}
        </Button>
      </form>
    </AuthLayout>
  );
}
