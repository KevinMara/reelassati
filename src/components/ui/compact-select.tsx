import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { cn } from "@/lib/utils";

type CompactSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: string; disabled?: boolean }[];
  "aria-label": string;
  disabled?: boolean;
  className?: string;
  id?: string;
};

/** A compact, keyboard-accessible menu with the same appearance on every OS. */
export function CompactSelect({
  value,
  onValueChange,
  options,
  className,
  disabled,
  id,
  "aria-label": label,
}: CompactSelectProps) {
  const emptyValue = "__reelassati_empty_selection__";
  return (
    <Select
      value={value || emptyValue}
      onValueChange={next => onValueChange(next === emptyValue ? "" : next)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-label={label}
        size="sm"
        className={cn(
          "min-w-0 w-full rounded-lg border-border bg-background/70 px-2.5 text-xs shadow-none",
          className
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="start"
        sideOffset={4}
        className="max-h-72 max-w-[min(24rem,calc(100vw-2rem))] rounded-xl border-border bg-surface p-1 text-foreground shadow-xl"
      >
        {options.map(option => (
          <SelectItem
            key={option.value}
            value={option.value || emptyValue}
            disabled={option.disabled}
            className="cursor-pointer rounded-md py-2 text-xs focus:bg-primary/15 focus:text-foreground"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
