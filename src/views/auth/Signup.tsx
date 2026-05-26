import { AuthLayout } from "@/components/auth/AuthLayout";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Field, GoogleButton } from "@/components/auth/AuthLayout";

export default function Signup() {
  const { t } = useTranslation();
  return (
    <AuthLayout title={t("auth.signup.title")} sub={t("auth.signup.sub")}>
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <Field name="name" label={t("auth.signup.name")} required />
        <Field name="email" label={t("auth.signup.email")} type="email" required />
        <Field name="password" label={t("auth.signup.password")} type="password" required />
        <Button className="w-full" size="lg">{t("auth.signup.submit")}</Button>
        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-surface px-2 text-muted-foreground">{t("auth.signup.or")}</span></div>
        </div>
        <GoogleButton label={t("auth.signup.google")} />
      </form>
      <div className="mt-8 text-center text-sm">
        <span className="text-foreground/50">{t("auth.signup.have_account")} </span>
        <Link to="/auth/login" className="text-primary font-medium hover:underline">{t("auth.signup.login_link")}</Link>
      </div>
    </AuthLayout>
  );
}
