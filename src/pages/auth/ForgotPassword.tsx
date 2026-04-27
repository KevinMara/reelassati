import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { AuthLayout, Field } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";

export default function ForgotPassword() {
  const { t } = useTranslation();
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
      <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
        <Field name="email" type="email" label={t("auth.email")} required autoComplete="email" />
        <Button type="submit" variant="primary" size="lg" className="w-full justify-center">
          {t("auth.send_link")}
        </Button>
      </form>
    </AuthLayout>
  );
}
