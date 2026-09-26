import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ReactNode } from "react";

export function EditorInfo({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`About ${label}`}
          className="inline-flex shrink-0 items-center rounded p-1 text-foreground/50 hover:text-primary"
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-72 rounded-xl text-sm leading-relaxed"
      >
        <p className="mb-1 font-semibold">{label}</p>
        {children}
      </PopoverContent>
    </Popover>
  );
}
