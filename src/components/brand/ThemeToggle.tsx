import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-pill text-foreground/70 hover:text-foreground hover:bg-foreground/[0.04] transition-colors duration-200",
        className,
      )}
    >
      <Sun
        className={cn(
          "absolute h-4 w-4 transition-all duration-300 ease-out-expo",
          theme === "dark" ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100",
        )}
      />
      <Moon
        className={cn(
          "absolute h-4 w-4 transition-all duration-300 ease-out-expo",
          theme === "dark" ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-90 opacity-0",
        )}
      />
    </button>
  );
}
