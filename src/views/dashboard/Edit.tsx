import { AppShell } from "@/components/app/AppShell";
import { PlaceholderPage } from "@/components/app/PlaceholderPage";
import { Scissors } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Edit() {
  const { t } = useTranslation();
  return (
    <AppShell>
      <div className="p-8 max-w-7xl mx-auto">
        <header className="mb-8">
          <p className="mono-eyebrow text-primary mb-2">{t("app.nav.edit")}</p>
          <h1 className="text-3xl font-semibold tracking-tight">Auto Editor</h1>
          <p className="text-foreground/60 mt-2">Raw footage to hyper-professional vertical. Surgical beat-sync.</p>
        </header>
        
        <PlaceholderPage title="Editor" icon={Scissors} />
      </div>
    </AppShell>
  );
}
