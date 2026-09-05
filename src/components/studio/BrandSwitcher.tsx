import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { platformApi } from "@/lib/platform-api";
import { selectBrand } from "@/lib/workspace-scope";
import { useWorkspace } from "@/providers/workspace";

export function BrandSwitcher({ manage = false }: { manage?: boolean }) {
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
          ? "mb-6 rounded-xl border border-border bg-surface p-5"
          : "min-w-0"
      }
    >
      <label className="text-sm font-medium">
        Brand workspace
        <select
          aria-label="Active brand workspace"
          disabled={!data || saving || !!workspaceError || busy}
          value={data?.activeId || "default"}
          onChange={e => selectBrand(workspace.profile.email, e.target.value)}
          className="mt-2 w-full rounded-lg border border-border bg-background p-2 text-sm"
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
        </select>
      </label>
      {manage && data && (
        <>
          <p className="mt-3 text-sm text-foreground/70">
            {data.brands.length} of {data.limit} brands. Each has its own voice,
            Library, projects, calendar, and social connections. Plan credits
            are shared.
          </p>
          {data.brands.length < data.limit ? (
            <div className="mt-4 flex gap-2">
              <input
                aria-label="New brand name"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={100}
                placeholder="Brand name"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background p-3 text-sm"
              />
              <button
                type="button"
                disabled={!name.trim() || busy || saving || !!workspaceError}
                onClick={() => void create()}
                className="rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Creating…" : "Add brand"}
              </button>
            </div>
          ) : (
            <Link
              className="mt-3 inline-block text-sm font-medium text-primary"
              to="/dashboard/billing"
            >
              Compare brand allowances
            </Link>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
