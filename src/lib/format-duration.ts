/** Format a whole-minute duration using the selected interface locale's units. */
export function formatMinutesDuration(
  totalMinutes: number,
  locale: string
): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const formatUnit = (value: number, unit: "hour" | "minute") =>
    new Intl.NumberFormat(locale, {
      style: "unit",
      unit,
      unitDisplay: "short",
      maximumFractionDigits: 0,
    }).format(value);

  return [
    hours ? formatUnit(hours, "hour") : "",
    minutes || !hours ? formatUnit(minutes, "minute") : "",
  ]
    .filter(Boolean)
    .join(" ");
}
