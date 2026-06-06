import { AppShell } from "@/components/app/AppShell";
import { useTranslation } from "react-i18next";
import { Library as LibraryIcon, Search, Filter, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Library() {
  const { t } = useTranslation();

  const mockItems = [
    { id: 1, title: "72-hour dough reveal", type: "Video", date: "2d ago", score: 92 },
    { id: 2, title: "POV: Pizzeria mornings", type: "Script", date: "3d ago", score: 85 },
    { id: 3, title: "The secret ingredient", type: "Video", date: "5d ago", score: 78 },
  ];

  return (
    <AppShell>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="mono-eyebrow text-primary mb-2">{t("app.nav.library")}</p>
            <h1 className="text-3xl font-semibold tracking-tight">Media Library</h1>
            <p className="text-foreground/60 mt-2">Browse your processed videos, generated scripts, and neural analyses.</p>
          </div>
        </header>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
            <Input className="pl-9" placeholder="Search library..." />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockItems.map((item) => (
            <div key={item.id} className="group bg-surface border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all">
              <div className="aspect-video bg-foreground/[0.05] relative flex items-center justify-center">
                <div className="h-12 w-12 rounded-full bg-background/80 flex items-center justify-center text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="h-5 w-5 fill-current" />
                </div>
                <div className="absolute top-3 right-3 bg-background/80 px-2 py-1 rounded text-[10px] font-bold">
                  {item.score}/100
                </div>
              </div>
              <div className="p-4">
                <div className="text-[10px] uppercase tracking-wider text-primary font-medium mb-1">{item.type}</div>
                <h3 className="font-semibold truncate">{item.title}</h3>
                <div className="text-xs text-foreground/45 mt-1">{item.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
