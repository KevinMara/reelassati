import { ArrowRight, Scissors } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type EditAssetLinkProps = {
  assetId: string;
  label?: string;
  compact?: boolean;
  className?: string;
  onNavigate?: () => void;
};

export function EditAssetLink({
  assetId,
  label = "Add to Edit",
  compact = false,
  className,
  onNavigate,
}: EditAssetLinkProps) {
  return (
    <Link
      to={`/dashboard/edit?asset=${encodeURIComponent(assetId)}`}
      onClick={onNavigate}
      className={cn(
        "group inline-flex items-center justify-center gap-2 rounded-lg bg-primary font-medium text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-card disabled:opacity-45",
        compact ? "px-3 py-2 text-xs" : "w-full px-4 py-2.5 text-sm",
        className
      )}
    >
      <Scissors className="h-4 w-4" />
      {label}
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
