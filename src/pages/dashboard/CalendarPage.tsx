import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function CalendarRoute() {
  return <AppShell renderWith={() => <CalendarView />} />;
}

function CalendarView() {
  const { t } = useTranslation();
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [cursor, setCursor] = useState(new Date());

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

  const shift = (delta: number) => {
    const next = new Date(cursor);
    if (view === "month") next.setMonth(next.getMonth() + delta);
    if (view === "week") next.setDate(next.getDate() + delta * 7);
    if (view === "day") next.setDate(next.getDate() + delta);
    setCursor(next);
  };

  // Build month grid
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isToday = (d: Date | null) =>
    d && d.toDateString() === today.toDateString();

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <p className="mono-eyebrow text-primary mb-3">{t("calendar.eyebrow")}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{t("calendar.title")}</h1>
        </div>
        <Button variant="primary" onClick={() => toast.info("Publisher coming in phase 5")}>
          <Plus className="h-4 w-4 mr-2" />{t("calendar.schedule")}
        </Button>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>{t("calendar.today")}</Button>
          <Button variant="outline" size="sm" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
          <span className="ml-3 text-base font-medium capitalize">{monthLabel}</span>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="month">{t("calendar.month")}</TabsTrigger>
            <TabsTrigger value="week">{t("calendar.week")}</TabsTrigger>
            <TabsTrigger value="day">{t("calendar.day")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === "month" ? (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-foreground/[0.02]">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="text-[11px] uppercase tracking-wide text-foreground/55 px-3 py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => (
              <div key={i} className="min-h-[100px] border-r border-b border-border p-2 last:border-r-0">
                {d && (
                  <div className={`text-xs tabular-nums ${isToday(d) ? "h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center" : "text-foreground/65"}`}>
                    {d.getDate()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState icon={CalendarIcon} title={t("calendar.empty_title")} body={t("calendar.empty_body")} />
      )}
    </div>
  );
}
