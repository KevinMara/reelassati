import { useState } from "react";
import { Link } from "react-router-dom";
import { platformApi } from "@/lib/platform-api";
export function AccountDataControls() {
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [confirm, setConfirm] = useState("");
  async function download() {
    setBusy(true);
    setNotice("");
    try {
      const data = await platformApi.accountData();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "reelassati-account-data.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setNotice(
        "Account data downloaded. Media files can be downloaded separately from the Library."
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Export unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function requestDeletion() {
    setBusy(true);
    try {
      const r = await platformApi.requestAccountDeletion();
      setNotice(
        `Deletion request ${r.requestId} received. Your account has not been deleted yet; support will confirm completion.`
      );
      setConfirm("");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Request could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-8 rounded-xl border border-border bg-surface p-6">
      <h2 className="font-semibold">Your account and data</h2>
      <p className="mt-2 text-sm text-foreground/70">
        Download projects, scripts, settings, and media links across all your
        brands.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void download()}
        className="mt-4 rounded-lg border border-primary/30 px-4 py-2 text-sm font-medium text-primary disabled:opacity-60"
      >
        Download my data
      </button>
      <details className="mt-5">
        <summary className="cursor-pointer text-sm text-foreground/75">
          Request account deletion
        </summary>
        <p className="mt-3 text-sm text-foreground/70">
          This requests removal of your account and all brand workspaces.
          Support checks subscription cancellation and any records that must be
          retained. A request does not cancel billing automatically.{" "}
          <Link to="/dashboard/billing" className="text-primary underline">
            Manage your subscription
          </Link>
          .
        </p>
        <label className="mt-4 block text-xs">
          Type DELETE MY ACCOUNT
          <input
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="mt-2 block w-full max-w-sm rounded-lg border border-border bg-background p-2 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={busy || confirm !== "DELETE MY ACCOUNT"}
          onClick={() => void requestDeletion()}
          className="mt-3 rounded-lg border border-destructive/40 px-4 py-2 text-sm text-destructive disabled:opacity-60"
        >
          Submit deletion request
        </button>
      </details>
      {notice && (
        <p role="status" className="mt-4 text-sm">
          {notice}
        </p>
      )}
    </section>
  );
}
