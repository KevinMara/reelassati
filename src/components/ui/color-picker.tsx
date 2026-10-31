import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { useUiText } from "@/lib/i18n/ui";
import {
  hexToHsv,
  hexToRgb,
  hsvToHex,
  normalizeHex,
  rgbToHex,
} from "@/lib/color-picker";

const SWATCHES = [
  "#FFFFFF",
  "#E2E8F0",
  "#94A3B8",
  "#475569",
  "#171717",
  "#000000",
  "#FDE047",
  "#FB923C",
  "#F87171",
  "#F472B6",
  "#A78BFA",
  "#818CF8",
  "#38BDF8",
  "#2DD4BF",
  "#4ADE80",
  "#A3E635",
  "#D4B896",
  "#9C6B4E",
];

/** Controlled editor color field: swatches, exact values and keyboard-friendly custom controls. */
export function ColorPicker({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
}) {
  const ui = useUiText();
  const hex = normalizeHex(value) ?? "#000000";
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [error, setError] = useState(false);
  // Retain hue at black/white, where RGB alone cannot represent it.
  const [lastHue, setLastHue] = useState(() => hexToHsv(hex).h);
  const [lastSaturation, setLastSaturation] = useState(() => hexToHsv(hex).s);
  const hsv = hexToHsv(hex);
  if (!hsv.s) hsv.h = lastHue;
  if (!hsv.v) hsv.s = lastSaturation;
  const rgb = hexToRgb(hex);
  const choose = (next: string) => {
    setError(false);
    const color = normalizeHex(next);
    if (color && color !== hex) {
      const nextHsv = hexToHsv(color);
      if (nextHsv.s) setLastHue(nextHsv.h);
      if (nextHsv.v) setLastSaturation(nextHsv.s);
      onChange(color);
    }
  };
  const remember = () =>
    setRecent(colors => [hex, ...colors.filter(c => c !== hex)].slice(0, 6));
  return (
    <div className="min-w-0 space-y-1.5 text-xs">
      <span className="block text-muted-foreground">{label}</span>
      <Popover
        open={open}
        onOpenChange={next => {
          setOpen(next);
          setError(false);
          if (!next) remember();
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={label}
            className="flex h-8 w-full items-center gap-2 rounded-lg border border-border bg-background px-2 text-xs transition hover:border-primary/50 disabled:opacity-40"
          >
            <span
              aria-hidden="true"
              className="size-4 shrink-0 rounded border border-black/15 ring-1 ring-white/15"
              style={{ background: hex }}
            />
            <span className="min-w-0 flex-1 text-left font-mono text-[11px]">
              {hex}
            </span>
            <ChevronDown size={12} className="shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="color-picker w-64 space-y-3 rounded-xl p-3"
          aria-label={label}
        >
          <div className="flex items-center justify-between text-xs font-medium">
            <span>{label}</span>
            <span
              className="size-5 rounded border border-white/15"
              style={{ background: hex }}
            />
          </div>
          <div className="grid grid-cols-6 gap-1.5" aria-label={ui("Presets")}>
            {SWATCHES.map(color => (
              <button
                key={color}
                type="button"
                title={color}
                aria-label={color}
                aria-pressed={hex === color}
                onClick={() => choose(color)}
                className="relative aspect-square rounded-md border border-black/15 ring-offset-2 ring-offset-popover transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary aria-pressed:ring-2 aria-pressed:ring-primary"
                style={{ background: color }}
              >
                {hex === color && (
                  <Check
                    size={13}
                    className="absolute inset-0 m-auto"
                    style={{
                      color: hexToHsv(color).v > 65 ? "#111827" : "#FFFFFF",
                    }}
                  />
                )}
              </button>
            ))}
          </div>
          {recent.length > 0 && (
            <div className="flex items-center gap-1.5 border-t border-border pt-2">
              <span className="mr-auto text-[10px] text-muted-foreground">
                {ui("Recent colors")}
              </span>
              {recent.map(color => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  title={color}
                  onClick={() => choose(color)}
                  className="size-5 rounded border border-border focus-visible:ring-2 focus-visible:ring-primary"
                  style={{ background: color }}
                />
              ))}
            </div>
          )}
          <div className="grid grid-cols-[1.35fr_1fr_1fr_1fr] gap-1.5 border-t border-border pt-3">
            <label className="space-y-1 text-[10px] text-muted-foreground">
              {ui("HEX")}
              <input
                key={hex}
                defaultValue={hex.slice(1)}
                maxLength={7}
                spellCheck={false}
                aria-label={ui("HEX")}
                aria-invalid={error}
                className="block h-8 w-full rounded-md border border-border bg-background px-1.5 font-mono text-[11px] text-foreground uppercase"
                onBlur={e => {
                  const next = normalizeHex(e.currentTarget.value);
                  if (next) choose(next);
                  else setError(true);
                }}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
              />
            </label>
            {rgb.map((channel, index) => (
              <label
                key={index}
                className="space-y-1 text-[10px] text-muted-foreground"
              >
                {["R", "G", "B"][index]}
                <input
                  key={channel}
                  type="number"
                  min={0}
                  max={255}
                  defaultValue={channel}
                  aria-label={["R", "G", "B"][index]}
                  className="block h-8 w-full rounded-md border border-border bg-background px-1 text-center font-mono text-[11px] text-foreground"
                  onBlur={e => {
                    const next = Number(e.currentTarget.value);
                    if (e.currentTarget.value.trim() && Number.isFinite(next))
                      choose(
                        rgbToHex(rgb.map((n, i) => (i === index ? next : n)))
                      );
                    else e.currentTarget.value = String(channel);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </label>
            ))}
          </div>
          {error && (
            <p role="alert" className="text-[11px] text-destructive">
              {ui("Enter a valid hex color.")}
            </p>
          )}
          <div className="space-y-2.5 border-t border-border pt-3">
            {(
              [
                ["h", "Hue", 360],
                ["s", "Saturation", 100],
                ["v", "Brightness", 100],
              ] as const
            ).map(([key, title, max]) => (
              <label
                key={key}
                className="block text-[10px] text-muted-foreground"
              >
                <span className="flex justify-between">
                  <span>{ui(title)}</span>
                  <span className="tabular-nums">
                    {Math.round(hsv[key])}
                    {key === "h" ? "°" : "%"}
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={max}
                  value={hsv[key]}
                  aria-label={ui(title)}
                  className="color-picker-slider mt-1 block h-2 w-full cursor-pointer appearance-none rounded-full"
                  style={{
                    background:
                      key === "h"
                        ? "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)"
                        : key === "s"
                          ? `linear-gradient(to right, ${hsvToHex({ ...hsv, s: 0 })}, ${hsvToHex({ ...hsv, s: 100 })})`
                          : `linear-gradient(to right, #000, ${hsvToHex({ ...hsv, v: 100 })})`,
                  }}
                  onChange={e => {
                    const next = Number(e.target.value);
                    if (key === "h") setLastHue(next);
                    if (key === "s") setLastSaturation(next);
                    choose(hsvToHex({ ...hsv, [key]: next }));
                  }}
                />
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
