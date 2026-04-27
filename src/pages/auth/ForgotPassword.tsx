import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AuthLayout, Field } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      toast.success(t("auth.toast.reset_sent"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={t("auth.forgot_title")}
      sub={t("auth.forgot_sub")}
      footer={
        <Link to="/auth/login" className="inline-flex items-center gap-2 text-primary font-medium hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("auth.back_login")}
        </Link>
      }
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <Field name="email" type="email" label={t("auth.email")} required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
        <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full justify-center">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.send_link")}
        </Button>
      </form>
    </AuthLayout>
  );
}
