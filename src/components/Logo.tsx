import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  glyphOnly?: boolean;
  collapsed?: boolean;
}

export function Logo({ className, size = "md", glyphOnly = false, collapsed = false }: LogoProps) {
  const wordSize =
    size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";
  const glyphPx = size === "sm" ? 22 : size === "lg" ? 38 : 30;

  return (
    <span
      className={cn("inline-flex items-center gap-2 select-none", className)}
      aria-label="Reelassati"
    >
      <ReelassatiGlyph size={glyphPx} />
      {!glyphOnly && !collapsed && (
        <span className={cn("flex items-baseline leading-none tracking-tight", wordSize)}>
          <span className="font-bold uppercase tracking-[0.02em]">REEL</span>
          <span
            className="font-serif italic font-normal text-foreground -ml-[0.04em]"
            style={{ fontSize: "0.95em" }}
          >
            assati
          </span>
        </span>
      )}
    </span>
  );
}

function ReelassatiGlyph({ size = 22 }: { size?: number }) {
  return (
    <ThemedLogoMark size={size} />
  );
}

export function ThemedLogoMark({
  size = 22,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("relative block shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <img
        src="/brand/reelassati-mark-light.png"
        alt=""
        width={size}
        height={size}
        className="block h-full w-full object-contain dark:hidden"
      />
      <img
        src="/brand/reelassati-mark-transparent.png"
        alt=""
        width={size}
        height={size}
        className="hidden h-full w-full object-contain dark:block"
      />
    </span>
  );
}
