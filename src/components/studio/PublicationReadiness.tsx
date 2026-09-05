import type { ScheduledPost } from "@contracts/workspace";
import { useWorkspace } from "@/providers/workspace";
export function PublicationReadiness({ post }: { post: ScheduledPost }) {
  const { workspace } = useWorkspace();
  const checks = [
    { label: "Caption", ready: !!post.caption.trim() },
    {
      label: "Media",
      ready: !!workspace.assets.find(
        a => a.id === post.mediaAssetId && a.status === "ready"
      ),
    },
    {
      label: "Account",
      ready:
        post.accountIds.length > 0 &&
        post.accountIds.every(id =>
          workspace.accounts.some(a => a.id === id && a.status === "connected")
        ),
    },
    { label: "Review", ready: !!post.complianceReview },
  ];
  const count = checks.filter(c => c.ready).length;
  return (
    <div className="mt-3">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {checks.map(c => (
          <span
            key={c.label}
            className={`rounded-md px-2 py-1 text-xs ${c.ready ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "bg-foreground/5 text-foreground/70"}`}
          >
            {c.ready ? "✓ " : ""}
            {c.label}
          </span>
        ))}
      </div>
      <progress
        aria-label={`${count} of ${checks.length} preparation checks complete`}
        className="h-1 w-full accent-primary"
        value={count}
        max={checks.length}
      />
      <p className="mt-1 text-xs text-foreground/65">
        {count}/{checks.length} prepared · final checks happen when you publish.
      </p>
    </div>
  );
}
