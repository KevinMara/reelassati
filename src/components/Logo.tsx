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
  const glyphPx = size === "sm" ? 18 : size === "lg" ? 28 : 22;

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
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="15" className="fill-primary/8" />
      <path d="M9 9 L9 17 L16 13 Z" className="fill-primary" />
      <path
        d="M9 17 C 12 22, 18 24, 24 19"
        className="stroke-primary"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="24" cy="19" r="1.6" className="fill-primary" />
    </svg>
  );
}
