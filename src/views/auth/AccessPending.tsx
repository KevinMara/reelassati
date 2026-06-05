import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Clock, ArrowLeft } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

export default function AccessPending() {
  const { t } = useTranslation();
  const { state } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (state === "loggedIn") {
      navigate("/dashboard", { replace: true });
    }
  }, [state, navigate]);

  return (
    <AuthLayout
      title={t("auth.pending_title")}
      sub={t("auth.pending_sub")}
    >
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center animate-pulse-soft">
            <Clock className="h-8 w-8" />
          </div>
        </div>
        <p className="text-foreground/70 leading-relaxed">
          {t("auth.pending_body")}
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("auth.pending_back_home")}
          </Link>
        </Button>
      </div>
    </AuthLayout>
  );
}
