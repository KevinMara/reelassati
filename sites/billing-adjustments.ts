import type { BillingEnvironment } from "./billing";

type Payment = { owner_email: string; credits: number; total_cents: number };
const text = (v: unknown) => (typeof v === "string" ? v : "");
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

export const BILLING_ADJUSTMENTS_SCHEMA = `CREATE TABLE IF NOT EXISTS billing_payment_adjustments (
 payment_intent TEXT PRIMARY KEY, owner_email TEXT NOT NULL, credits INTEGER NOT NULL,
 total_cents INTEGER NOT NULL, refunded_cents INTEGER NOT NULL DEFAULT 0,
 disputed_cents INTEGER NOT NULL DEFAULT 0, dispute_updated_at INTEGER NOT NULL DEFAULT 0,
 dispute_id TEXT, dispute_closed INTEGER NOT NULL DEFAULT 0,
 applied_debit INTEGER NOT NULL DEFAULT 0
)`;

/** The server owns all purchase amounts. Refunds can arrive before Checkout completion. */
export async function registerCreditPurchase(
  env: BillingEnvironment,
  paymentIntent: string,
  owner: string,
  credits: number,
  paid: number
) {
  if (!paymentIntent || !Number.isSafeInteger(paid) || paid <= 0) return;
  await env.DB.prepare(
    `INSERT INTO billing_payment_adjustments(payment_intent,owner_email,credits,total_cents) VALUES (?, ?, ?, ?) ON CONFLICT(payment_intent) DO NOTHING`
  )
    .bind(paymentIntent, owner, credits, paid)
    .run();
}

export async function adjustCreditPurchase(
  env: BillingEnvironment,
  eventId: string,
  type: string,
  payload: Record<string, unknown>,
  created: number
): Promise<boolean> {
  const paymentIntent =
    text(payload.payment_intent) || text(object(payload.payment_intent).id);
  if (!paymentIntent) return false;
  let purchase = await env.DB.prepare(
    "SELECT owner_email, credits, total_cents FROM billing_payment_adjustments WHERE payment_intent = ?"
  )
    .bind(paymentIntent)
    .first<Payment>();
  if (!purchase) {
    const metadata = object(payload.metadata);
    const credits = Number(metadata.credits),
      paid = Number(payload.amount),
      owner = text(metadata.owner_email);
    if (
      metadata.purchase_kind !== "topup" ||
      !owner ||
      !Number.isSafeInteger(credits) ||
      credits <= 0 ||
      credits > 5000 ||
      !Number.isSafeInteger(paid) ||
      paid <= 0
    )
      return false;
    await registerCreditPurchase(env, paymentIntent, owner, credits, paid);
    purchase = { owner_email: owner, credits, total_cents: paid };
  }
  const now = new Date().toISOString(),
    key = `stripe-adjustment:${eventId}`;
  const disputed = type.startsWith("charge.dispute.");
  const status = text(payload.status);
  const disputedCents = ["won", "warning_closed"].includes(status)
    ? 0
    : Math.max(0, Number(payload.amount) || 0);
  const update = disputed
    ? env.DB.prepare(
        `UPDATE billing_payment_adjustments SET disputed_cents = ?, dispute_updated_at = ?, dispute_id = ?, dispute_closed = ? WHERE payment_intent = ? AND dispute_updated_at <= ? AND (dispute_closed = 0 OR dispute_id <> ?)`
      ).bind(
        disputedCents,
        created,
        text(payload.id),
        type === "charge.dispute.closed" ? 1 : 0,
        paymentIntent,
        created,
        text(payload.id)
      )
    : env.DB.prepare(
        `UPDATE billing_payment_adjustments SET refunded_cents = MAX(refunded_cents, ?) WHERE payment_intent = ?`
      ).bind(Math.max(0, Number(payload.amount_refunded) || 0), paymentIntent);
  // Carry spent refunded credits as a debt instead of silently gifting them back on the next top-up.
  const target =
    "MIN(credits, CAST((credits * MIN(total_cents, refunded_cents + disputed_cents) + total_cents - 1) / total_cents AS INTEGER))";
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO credit_accounts(owner_email,included_balance,topup_balance,created_at,updated_at) VALUES (?,0,0,?,?) ON CONFLICT(owner_email) DO NOTHING"
    ).bind(purchase.owner_email, now, now),
    update,
    env.DB.prepare(
      `INSERT INTO credit_ledger(id,owner_email,amount,included_amount,topup_amount,category,status,operation_key,reference_id,description,metadata_json,applied,created_at,settled_at) SELECT ?,owner_email,applied_debit-${target},0,applied_debit-${target},'adjustment','settled',?,?,'Payment refund or dispute adjustment','{}',0,?,? FROM billing_payment_adjustments WHERE payment_intent = ? ON CONFLICT(operation_key) DO NOTHING`
    ).bind(crypto.randomUUID(), key, paymentIntent, now, now, paymentIntent),
    env.DB.prepare(
      `UPDATE credit_accounts SET topup_balance = topup_balance + COALESCE((SELECT topup_amount FROM credit_ledger WHERE operation_key = ? AND applied = 0),0), updated_at = ? WHERE owner_email = ?`
    ).bind(key, now, purchase.owner_email),
    env.DB.prepare(
      `UPDATE billing_payment_adjustments SET applied_debit = ${target} WHERE payment_intent = ?`
    ).bind(paymentIntent),
    env.DB.prepare(
      "UPDATE credit_ledger SET applied = 1 WHERE operation_key = ?"
    ).bind(key),
  ]);
  return true;
}
