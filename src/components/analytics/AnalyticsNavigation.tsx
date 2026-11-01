import { BarChart3, Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { useUiText } from "@/lib/i18n/ui";

export function AnalyticsNavigation({
  active,
}: {
  active: "overview" | "coach";
}) {
  const ui = useUiText();
  return (
    <nav
      aria-label={ui("Analytics views")}
      className="mb-6 flex gap-5 border-b border-border"
    >
      {[
        {
          key: "overview",
          label: "Overview",
          to: "/dashboard/analytics",
          icon: BarChart3,
        },
        {
          key: "coach",
          label: "Weekly coach",
          to: "/dashboard/coaching",
          icon: Compass,
        },
      ].map(item => (
        <Link
          key={item.key}
          to={item.to}
          aria-current={active === item.key ? "page" : undefined}
          className={`inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${active === item.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <item.icon className="h-4 w-4" aria-hidden />
          {ui(item.label)}
        </Link>
      ))}
    </nav>
  );
}
