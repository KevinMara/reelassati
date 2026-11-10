import { useState } from "react";
import { CalendarDays, Flame } from "lucide-react";
import { getUiLocale, useUiText } from "@/lib/i18n/ui";
import type { MomentumMetric, MomentumPoint } from "@/lib/workspace-progress";

const levels = [
  "bg-muted/40 text-muted-foreground border-border",
  "bg-primary/15 text-foreground border-primary/20",
  "bg-primary/30 text-foreground border-primary/30",
  "bg-primary/55 text-foreground border-primary/50",
  "bg-primary text-primary-foreground border-primary",
];

/** A date-based view of the same records, without inventing goals or rewards. */
export function MomentumCalendar({
  series,
  metric,
  label,
}: {
  series: MomentumPoint[];
  metric: MomentumMetric;
  label: string;
}) {
  const ui = useUiText();
  const locale = getUiLocale();
  const [selectedDate, setSelectedDate] = useState<string>();
  const selected =
    series.find(point => point.date === selectedDate) ?? series.at(-1)!;
  const activeDays = series.filter(point => point[metric] > 0).length;
  const maximum = Math.max(1, ...series.map(point => point[metric]));
  let run = 0;
  let longestRun = 0;
  for (const point of series) {
    run = point[metric] > 0 ? run + 1 : 0;
    longestRun = Math.max(longestRun, run);
  }
  const offset = (new Date(`${series[0].date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const dateLabel = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  const levelFor = (value: number) =>
    value === 0 ? 0 : Math.max(1, Math.ceil((value / maximum) * 4));

  return (
    <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-surface to-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-medium">
          <CalendarDays className="h-3.5 w-3.5 text-primary" aria-hidden />
          {ui("Activity calendar")}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {ui("Daily records · UTC")}
        </span>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(140px,0.5fr)] sm:items-center">
        <div
          className="grid grid-cols-7 gap-1.5"
          role="group"
          aria-label={ui("Activity calendar")}
        >
          {Array.from({ length: 7 }, (_, day) => (
            <span
              key={day}
              className="pb-1 text-center text-[10px] text-muted-foreground"
              aria-hidden
            >
              {new Date(Date.UTC(2026, 0, 5 + day)).toLocaleDateString(locale, {
                weekday: "narrow",
                timeZone: "UTC",
              })}
            </span>
          ))}
          {Array.from({ length: offset }, (_, index) => (
            <span key={`blank-${index}`} aria-hidden />
          ))}
          {series.map(point => (
            <button
              key={point.date}
              type="button"
              aria-pressed={selected.date === point.date}
              aria-label={`${dateLabel(point.date)} · ${label}: ${point[metric].toLocaleString(locale)}`}
              title={`${dateLabel(point.date)} · ${label}: ${point[metric].toLocaleString(locale)}`}
              onClick={() => setSelectedDate(point.date)}
              className={`relative h-7 rounded-md border text-[11px] tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${levels[levelFor(point[metric])]} ${selected.date === point.date ? "ring-2 ring-primary/70 ring-offset-2 ring-offset-background" : "hover:border-primary"}`}
            >
              {Number(point.date.slice(-2)).toLocaleString(locale)}
            </button>
          ))}
        </div>
        <dl className="flex gap-5 border-t border-border/70 pt-3 sm:flex-col sm:gap-4 sm:border-t-0 sm:border-s sm:ps-5 sm:pt-0">
          <div>
            <dt className="text-[11px] text-muted-foreground">
              {ui("Active days")}
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {activeDays.toLocaleString(locale)}{" "}
              <span className="ms-1 text-xs font-normal text-muted-foreground">
                / {series.length.toLocaleString(locale)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Flame className="h-3 w-3 text-primary" aria-hidden />
              {ui("Longest streak")}
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-primary">
              {longestRun.toLocaleString(locale)}{" "}
              <span className="ms-1 text-xs font-normal text-muted-foreground">
                {ui("Consecutive days")}
              </span>
            </dd>
          </div>
        </dl>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
        <p
          className="text-[11px] text-muted-foreground"
          aria-live="polite"
          aria-atomic="true"
        >
          {dateLabel(selected.date)} <span className="mx-1">·</span>
          <strong className="font-semibold text-foreground">
            {selected[metric].toLocaleString(locale)}
          </strong>{" "}
          {label.toLocaleLowerCase(locale)}
        </p>
        <div
          className="flex items-center gap-1 text-[10px] text-muted-foreground"
          aria-hidden
        >
          <span className="me-1">{ui("Less activity")}</span>
          {levels.map(level => (
            <span
              key={level}
              className={`h-2 w-2 rounded-sm border ${level}`}
            />
          ))}
          <span className="ms-1">{ui("More activity")}</span>
        </div>
      </div>
    </div>
  );
}
