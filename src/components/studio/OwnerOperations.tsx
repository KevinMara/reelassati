import { getUiLocale, useUiText } from "@/lib/i18n/ui";
import { useEffect, useState } from "react";
import { platformApi } from "@/lib/platform-api";
import type { OperationsStatus } from "@contracts/operations";
export function OwnerOperations() {
  const ui = useUiText();
  const locale = getUiLocale();
  const readinessLabels: Record<string, string> = {
    "Server API key with the required restricted permissions": ui(
      "Server API key with the required restricted permissions"
    ),
    "Signed billing webhook": ui("Signed billing webhook"),
    "Six subscription prices and three credit packs": ui(
      "Six subscription prices and three credit packs"
    ),
    "Customer portal for invoices, plan changes and cancellation": ui(
      "Customer portal for invoices, plan changes and cancellation"
    ),
    "Correct Stripe account with payment acceptance enabled": ui(
      "Correct Stripe account with payment acceptance enabled"
    ),
    "Stripe Managed Payments handles indirect tax compliance": ui(
      "Stripe Managed Payments handles indirect tax compliance"
    ),
    "Tax collection explicitly disabled by the operator": ui(
      "Tax collection explicitly disabled by the operator"
    ),
    "Active tax settings and a recorded tax registration": ui(
      "Active tax settings and a recorded tax registration"
    ),
    "Stripe amounts, currencies and billing intervals match the website": ui(
      "Stripe amounts, currencies and billing intervals match the website"
    ),
    "Active portal with invoices and cancellation": ui(
      "Active portal with invoices and cancellation"
    ),
  };
  const [data, setData] = useState<OperationsStatus | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    platformApi
      .operations()
      .then(d => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setError("Operations could not load.");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="mb-6 rounded-2xl border border-primary/30 bg-surface p-6">
      <h2 className="text-xl font-semibold">{ui("Platform operations")}</h2>
      <p className="mt-1 text-sm text-foreground/70">
        {ui("Private to the platform operator.")}
      </p>
      {error && <p role="alert">{ui(error)}</p>}
      {data && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {data.services.map(s => (
              <div
                key={s.name}
                className={`rounded-lg border p-3 text-sm ${s.configured ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}
              >
                {s.name} ·{" "}
                {s.configured ? ui("Configured") : ui("Needs activation")}
              </div>
            ))}
          </div>
          {data.billingReadiness && !data.billingReadiness.ready ? (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <h3 className="font-medium">{ui("Finish payment setup")}</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {data.billingReadiness.checks.map(check => (
                  <li key={check.id} className="flex justify-between gap-4">
                    <span>
                      {readinessLabels[check.message] ?? check.message}
                    </span>
                    <span
                      className={
                        check.ready ? "text-emerald-500" : "text-amber-500"
                      }
                    >
                      {check.ready ? ui("Ready") : ui("Needs setup")}
                    </span>
                  </li>
                ))}
              </ul>
              <a
                className="mt-4 inline-flex text-sm font-medium text-primary underline underline-offset-4"
                href="https://dashboard.stripe.com/account/onboarding"
                target="_blank"
                rel="noopener noreferrer"
              >
                {ui("Open Stripe account setup")}
              </a>
            </div>
          ) : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {[
              [ui("Payment issues"), data.counts.failedPayments],
              [ui("AI failures · 7 days"), data.counts.failedGenerations],
              [ui("Jobs over 30 minutes"), data.counts.stalledGenerations],
              [ui("Open support"), data.counts.openSupport],
            ].map(([label, n]) => (
              <div key={label} className="rounded-lg border border-border p-3">
                <p className="text-xs text-foreground/70">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{n}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm">
            {ui("Library:")} {data.counts.assets.toLocaleString(locale)}{" "}
            {ui("assets ·")} {(data.counts.storageBytes / 1024 ** 3).toFixed(2)}{" "}
            {ui("GB stored")}
          </p>
          <p className="mt-2 text-sm">
            {ui("Weekly trends:")}{" "}
            {data.trends.generatedAt
              ? ui("updated {{date}}", {
                  date: new Date(data.trends.generatedAt).toLocaleString(
                    locale
                  ),
                })
              : ui("Awaiting first successful update")}
            {data.trends.lastError
              ? ui(" · Latest refresh failed; previous feed preserved.")
              : ""}
          </p>
          {data.paymentIssues.length > 0 && (
            <div className="mt-4 rounded-lg bg-amber-500/10 p-4">
              <p className="text-sm font-medium">
                {ui("Reconcile these events in Stripe, then resend them")}
              </p>
              {data.paymentIssues.map(p => (
                <p key={p.eventId} className="mt-2 break-all font-mono text-xs">
                  {p.type} · {p.eventId}
                </p>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-foreground/65">
            {ui(
              "Configuration checks do not verify provider balances or live payments. Updated"
            )}{" "}
            {new Date(data.checkedAt).toLocaleTimeString(locale)}.
          </p>
        </>
      )}
    </section>
  );
}
