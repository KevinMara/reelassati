import { useId, type ReactNode } from "react";
import { StudioSelect } from "@/components/ui/studio-select";
import { useUiText } from "@/lib/i18n/ui";

export function StyleSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string; translate?: boolean }[];
  onChange(value: string): void;
}) {
  const ui = useUiText();
  const id = useId();
  return (
    <label htmlFor={id} className="space-y-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <StudioSelect
        id={id}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-9 w-full text-xs"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.translate === false ? option.label : ui(option.label)}
          </option>
        ))}
      </StudioSelect>
    </label>
  );
}

export function StyleRange({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  unit = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange(value: number): void;
}) {
  return (
    <label className="space-y-2 text-xs">
      <span className="flex justify-between gap-3">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          {Number(value.toFixed(2))}
          {unit}
        </span>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        className="w-full accent-primary"
      />
    </label>
  );
}

export function StyleToggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange(value: boolean): void;
  disabled?: boolean;
}) {
  return (
    <label className="!flex-row items-center gap-2 text-xs">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
        className="accent-primary"
      />
      {label}
    </label>
  );
}

export function StyleColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  return (
    <label className="space-y-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="color"
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full cursor-pointer"
      />
    </label>
  );
}

export function StyleSection({
  title,
  children,
  open = false,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open} className="rounded-lg border border-border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        {title}
      </summary>
      <div className="space-y-4 border-t border-border p-4">{children}</div>
    </details>
  );
}
