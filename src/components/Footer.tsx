import { useUiText } from "@/lib/i18n/ui";
import { LanguagePicker } from "@/components/LanguagePicker";
import { Link } from "react-router-dom";

import { Moon, Sun } from "lucide-react";
import { Logo } from "./Logo";
import { useTheme } from "@/hooks/useTheme";
import { openPrivacyPreferences } from "@/lib/privacy-consent";

export function Footer() {
  const ui = useUiText();

  const { theme, toggleTheme } = useTheme();

  return (
    <footer className="mt-32 border-t border-border bg-background">
      <div className="container-page py-16 md:py-24">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-12">
          <div className="col-span-2 md:col-span-5">
            <Logo size="lg" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-foreground/60">
              {ui(
                "The editing-first short-form studio: manual control, reviewable assistance, and one complete path from idea to delivery."
              )}
            </p>
            <span className="mt-7 inline-flex rounded-pill bg-primary/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-primary">
              {ui("Precise editing · Reviewable AI")}
            </span>
          </div>

          <FooterCol
            title={ui("Product")}
            items={[
              {
                label: ui("Capabilities"),
                to: "/#features",
              },
              { label: ui("Walkthroughs"), to: "/showcase" },
              { label: "Prompt Director", to: "/templates" },
              {
                label: ui("Pricing"),
                to: "/pricing",
              },
            ]}
          />
          <FooterCol
            title="Studio"
            items={[
              {
                label: ui("Editing"),
                to: "/dashboard/edit",
              },
              { label: "Script", to: "/dashboard/script" },
              {
                label: ui("Video generation"),
                to: "/dashboard/video",
              },
              {
                label: ui("Delivery"),
                to: "/dashboard/publish",
              },
            ]}
          />
          <FooterCol
            title={ui("Help")}
            items={[
              {
                label: ui("Local edit plan"),
                to: "/#edit-plan",
              },
              {
                label: ui("Quick start"),
                to: "/contact",
              },
              {
                label: ui("Support assistant"),
                to: "/contact",
              },
              { label: ui("Contact"), to: "/contact" },
            ]}
          />
        </div>

        <div className="mt-16 flex flex-col items-start gap-5 border-t border-border pt-8 lg:flex-row lg:items-center">
          <p className="mono-eyebrow text-foreground/40">
            &copy; {new Date().getFullYear()} REELassati ·{" "}
            {ui("All rights reserved")}
          </p>
          <nav
            aria-label={ui("Transparency and policies")}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-foreground/55 lg:ml-auto"
          >
            <Link
              to="/ai-transparency"
              className="transition-colors hover:text-foreground"
            >
              {ui("AI transparency")}
            </Link>
            <Link
              to="/responsible-use"
              className="transition-colors hover:text-foreground"
            >
              {ui("Responsible use")}
            </Link>
            <Link
              to="/provenance"
              className="transition-colors hover:text-foreground"
            >
              {ui("Check provenance")}
            </Link>
            <Link
              to="/privacy"
              className="transition-colors hover:text-foreground"
            >
              {ui("Privacy")}
            </Link>
            <Link
              to="/terms"
              className="transition-colors hover:text-foreground"
            >
              {ui("Terms")}
            </Link>
            <Link
              to="/refunds"
              className="transition-colors hover:text-foreground"
            >
              {ui("Refunds")}
            </Link>
            <Link
              to="/cookies"
              className="transition-colors hover:text-foreground"
            >
              Cookies
            </Link>
            <button
              type="button"
              onClick={openPrivacyPreferences}
              className="transition-colors hover:text-foreground"
            >
              {ui("Privacy choices")}
            </button>
            <Link
              to="/accessibility"
              className="transition-colors hover:text-foreground"
            >
              {ui("Accessibility")}
            </Link>
            <Link
              to="/legal"
              className="transition-colors hover:text-foreground"
            >
              {ui("Legal notice")}
            </Link>
          </nav>
          <div className="flex items-center gap-1 lg:ml-2">
            <LanguagePicker compact />
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={
                theme === "light" ? ui("Use dark theme") : ui("Use light theme")
              }
            >
              {theme === "light" ? (
                <Sun className="h-4 w-4" aria-hidden />
              ) : (
                <Moon className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { label: string; to: string }[];
}) {
  return (
    <div className="md:col-span-2">
      <h2 className="mono-eyebrow mb-4 text-foreground/50">{title}</h2>
      <ul className="space-y-3">
        {items.map(item => (
          <li key={`${title}-${item.label}`}>
            <Link
              to={item.to}
              className="text-sm text-foreground/75 transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
