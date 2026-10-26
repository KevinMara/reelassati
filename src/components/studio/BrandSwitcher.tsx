import { useUiText } from "@/lib/i18n/ui";
import { StudioSelect } from "@/components/ui/studio-select";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { platformApi } from "@/lib/platform-api";
import { selectBrand } from "@/lib/workspace-scope";
import { useWorkspace } from "@/providers/workspace";

export function BrandSwitcher({
  manage = false,
  compact = false,
}: {
  manage?: boolean;
  compact?: boolean;
}) {
  const ui = useUiText();
  const { workspace, saving, error: workspaceError } = useWorkspace();
  const [data, setData] = useState<Awaited<
    ReturnType<typeof platformApi.brands>
  > | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    platformApi
      .brands()
      .then(value => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active) setError("Brand workspaces could not load.");
      });
    return () => {
      active = false;
    };
  }, []);
  async function create() {
    setBusy(true);
    setError("");
    try {
      const result = await platformApi.createBrand(name);
      selectBrand(workspace.profile.email, result.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Brand could not be created."
      );
      setBusy(false);
    }
  }
  return (
    <div
      className={
        manage
          ? compact
            ? "mb-5 grid items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 sm:grid-cols-[minmax(200px,300px)_minmax(0,1fr)]"
            : "mb-6 rounded-xl border border-border bg-surface p-5"
          : "min-w-0 border-b border-border px-1 pb-3"
      }
    >
      <label className="text-sm font-medium">
        <span
          className={
            manage
              ? "block text-xs text-muted-foreground"
              : "mb-2 flex items-center gap-2 text-[11px] font-medium text-muted-foreground"
          }
        >
          {!manage ? (
            <span className="flex h-4 w-4 items-center justify-center">
              <Building2 className="h-3.5 w-3.5" aria-hidden />
            </span>
          ) : null}
          {ui("Brand workspace")}
        </span>
        <StudioSelect
          aria-label={ui("Active brand workspace")}
          disabled={!data || saving || !!workspaceError || busy}
          value={data?.activeId || "default"}
          onChange={e => selectBrand(workspace.profile.email, e.target.value)}
          className={`${manage ? "mt-2 border-border bg-background p-2" : "border-border bg-background px-2 py-2 font-medium"} w-full rounded-lg border text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15`}
        >
          {(
            data?.brands || [
              { id: "default", name: workspace.brandKit.name || "My brand" },
            ]
          ).map(brand => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </StudioSelect>
      </label>
      {manage && data && (
        <details
          open={!compact}
          className={compact ? "min-w-0 sm:justify-self-end" : undefined}
        >
          <summary
            className={
              compact
                ? "cursor-pointer text-xs text-muted-foreground"
                : "hidden"
            }
          >
            {data.brands.length}/{data.limit} ·{" "}
            {data.brands.length < data.limit
              ? ui("Add brand")
              : ui("Compare brand allowances")}
          </summary>
          <p
            className={
              compact
                ? "mt-3 max-w-lg text-xs leading-relaxed text-muted-foreground"
                : "mt-3 text-sm text-foreground/70"
            }
          >
            {data.brands.length} {ui("of")} {data.limit}{" "}
            {ui(
              "brands. Each has its own voice, Library, projects, calendar, and social connections. Plan credits are shared."
            )}
          </p>
          {data.brands.length < data.limit ? (
            <div className={compact ? "mt-3 flex gap-2" : "mt-4 flex gap-2"}>
              <input
                aria-label={ui("New brand name")}
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={100}
                placeholder={ui("Brand name")}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={!name.trim() || busy || saving || !!workspaceError}
                onClick={() => void create()}
                className="rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {busy ? ui("Creating…") : ui("Add brand")}
              </button>
            </div>
          ) : (
            <Link
              className="mt-3 inline-block text-sm font-medium text-primary"
              to="/dashboard/billing"
            >
              {ui("Compare brand allowances")}
            </Link>
          )}
        </details>
      )}
      {error && (
        <p
          role="alert"
          className={`mt-2 text-sm text-destructive ${manage && compact ? "sm:col-span-2" : ""}`}
        >
          {ui(error)}
        </p>
      )}
    </div>
  );
}
