import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  body,
  action,
  icon: Icon,
  className,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6 bg-surface/40 border border-dashed border-border rounded-xl",
        className,
      )}
    >
      {Icon && (
        <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <h3 className="text-base font-medium">{title}</h3>
      {body && <p className="mt-2 text-sm text-foreground/60 max-w-sm">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
