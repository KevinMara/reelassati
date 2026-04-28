import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function PlaceholderPage({
  title,
  icon: Icon,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <section className="p-8 lg:p-12">
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold">{title}</h1>
        </div>
        <p className="text-foreground/60 leading-relaxed">{t("app.placeholder.body")}</p>
        <Button variant="outline" size="lg" className="mt-8" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("app.placeholder.back")}
        </Button>
      </div>
    </section>
  );
}
