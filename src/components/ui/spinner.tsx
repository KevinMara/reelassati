import { useUiText } from "@/lib/i18n/ui";
import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  const ui = useUiText();
  return (
    <Loader2Icon
      role="status"
      aria-label={ui("Loading")}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
