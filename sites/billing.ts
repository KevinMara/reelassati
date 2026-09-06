import type Stripe from "stripe";
import { hasStripeKey, stripeClient } from "./stripe-client";
import type { StripeReadiness } from "../contracts/billing";
import {
  BILLING_ADJUSTMENTS_SCHEMA,
  registerCreditPurchase,
  adjustCreditPurchase,
} from "./billing-adjustments";
import {
  CREDIT_TOP_UPS,
  topUpPriceCents,
  PLAN_NAME_BY_ID,
  isBillingCycle,
  isCreditTopUpId,
  isPlanId,
  planEntitlements,
  type BillingCycle,
  type BillingSummary,
  type CreditTopUpId,
  type PlanId,
} from "../contracts/billing";

type D1Result = {
  success: boolean;
  meta?: { changes?: number };
};

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{
    results: T[];
    success: boolean;
  }>;
  run(): Promise<D1Result>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
};

export type BillingEnvironment = {
  DB: D1Database;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_IDS_JSON?: string;
  STRIPE_ACCOUNT_ID?: string;
  STRIPE_PORTAL_CONFIGURATION_ID?: string;
  STRIPE_TAX_MODE?: "automatic" | "not_collecting";
  PUBLIC_APP_URL?: string;
};

export type BillingUser = { email: string; name: string };

type CreditAccountRow = {
  included_balance: number;
  topup_balance: number;
};

type BillingAccountRow = {
  owner_email: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_id: string | null;
  billing_cycle: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  next_credit_renewal_at: string | null;
  cancel_at_period_end: number;
};

type CreditLedgerRow = {
  id: string;
  amount: number;
  category: string;
  description: string;
  status: "reserved" | "settled" | "released";
  created_at: string;
};

type StripePriceConfiguration = {
  plans: Record<PlanId, Partial<Record<BillingCycle, string>>>;
  topUps: Partial<Record<CreditTopUpId, string>>;
};

let billingSchemaInitialization: Promise<unknown> | undefined;

function cleanString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

function normalizeEmail(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function validEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

export async function initializeBillingSchema(
  env: BillingEnvironment
): Promise<void> {
  if (!billingSchemaInitialization) {
    billingSchemaInitialization = env.DB.batch([
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS credit_accounts (
          owner_email TEXT PRIMARY KEY NOT NULL,
          included_balance INTEGER NOT NULL DEFAULT 0,
          topup_balance INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS credit_ledger (
          id TEXT PRIMARY KEY NOT NULL,
          owner_email TEXT NOT NULL,
          amount INTEGER NOT NULL,
          included_amount INTEGER NOT NULL DEFAULT 0,
          topup_amount INTEGER NOT NULL DEFAULT 0,
          category TEXT NOT NULL,
          status TEXT NOT NULL,
          operation_key TEXT NOT NULL UNIQUE,
          reference_id TEXT,
          description TEXT NOT NULL,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          applied INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          settled_at TEXT
        )
      `),
      env.DB.prepare(
        "CREATE INDEX IF NOT EXISTS credit_ledger_owner_created_idx ON credit_ledger (owner_email, created_at)"
      ),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS billing_accounts (
          owner_email TEXT PRIMARY KEY NOT NULL,
          stripe_customer_id TEXT UNIQUE,
          stripe_subscription_id TEXT UNIQUE,
          plan_id TEXT,
          billing_cycle TEXT,
          status TEXT NOT NULL DEFAULT 'inactive',
          current_period_start TEXT,
          current_period_end TEXT,
          next_credit_renewal_at TEXT,
          cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      env.DB.prepare(
        "CREATE INDEX IF NOT EXISTS billing_accounts_subscription_idx ON billing_accounts (stripe_subscription_id)"
      ),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS stripe_events (
          event_id TEXT PRIMARY KEY NOT NULL,
          event_type TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          processed_at TEXT,
          error TEXT
        )
      `),
      env.DB.prepare(BILLING_ADJUSTMENTS_SCHEMA),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS billing_checkouts (
        owner_email TEXT NOT NULL, kind TEXT NOT NULL, selection TEXT NOT NULL,
        attempt_id TEXT NOT NULL, session_id TEXT, lease_token TEXT,
        lease_until INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (owner_email, kind)
      )`),
    ]).catch(cause => {
      billingSchemaInitialization = undefined;
      throw cause;
    });
  }
  await billingSchemaInitialization;
}

function parsePriceConfiguration(
  env: BillingEnvironment
): StripePriceConfiguration {
  const empty: StripePriceConfiguration = {
    plans: { creator: {}, pro: {}, studio: {} },
    topUps: {},
  };
  try {
    const parsed = record(
      JSON.parse(cleanString(env.STRIPE_PRICE_IDS_JSON, "{}"))
    );
    const plans = record(parsed?.plans);
    const topUps = record(parsed?.topUps || parsed?.topups);
    for (const planId of ["creator", "pro", "studio"] as const) {
      const plan = record(plans?.[planId] || parsed?.[planId]);
      for (const cycle of ["monthly", "annual"] as const) {
        const priceId = cleanString(plan?.[cycle]);
        if (/^price_[A-Za-z0-9]+$/.test(priceId)) {
          empty.plans[planId][cycle] = priceId;
        }
      }
    }
    for (const topUpId of Object.keys(CREDIT_TOP_UPS) as CreditTopUpId[]) {
      const priceId = cleanString(topUps?.[topUpId]);
      if (/^price_[A-Za-z0-9]+$/.test(priceId)) {
        empty.topUps[topUpId] = priceId;
      }
    }
  } catch {
    return empty;
  }
  return empty;
}

export function stripeBillingConfigured(env: BillingEnvironment): boolean {
  const prices = parsePriceConfiguration(env);
  return Boolean(
    hasStripeKey(env.STRIPE_SECRET_KEY) &&
    cleanString(env.STRIPE_WEBHOOK_SECRET).startsWith("whsec_") &&
    /^bpc_[A-Za-z0-9]+$/.test(
      cleanString(env.STRIPE_PORTAL_CONFIGURATION_ID)
    ) &&
    Object.keys(CREDIT_TOP_UPS).every(id =>
      Boolean(prices.topUps[id as CreditTopUpId])
    ) &&
    Object.values(prices.plans).every(
      plan => Boolean(plan.monthly) && Boolean(plan.annual)
    )
  );
}

const readinessCache = new WeakMap<
  BillingEnvironment,
  { expiresAt: number; result: Promise<StripeReadiness> }
>();

/** Verify actual account, catalog and tax configuration before offering checkout. */
export function stripeReadiness(
  env: BillingEnvironment
): Promise<StripeReadiness> {
  const cached = readinessCache.get(env);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  const result = inspectStripeReadiness(env);
  readinessCache.set(env, { expiresAt: Date.now() + 60_000, result });
  return result;
}

async function inspectStripeReadiness(
  env: BillingEnvironment
): Promise<StripeReadiness> {
  const checkedAt = new Date().toISOString();
  const checks: StripeReadiness["checks"] = [];
  const add = (id: string, ready: boolean, message: string) =>
    checks.push({ id, ready, message });
  add(
    "api_key",
    hasStripeKey(env.STRIPE_SECRET_KEY),
    "Server API key with the required restricted permissions"
  );
  add(
    "webhook",
    cleanString(env.STRIPE_WEBHOOK_SECRET).startsWith("whsec_"),
    "Signed billing webhook"
  );
  const prices = parsePriceConfiguration(env);
  const expected = [
    ...(["creator", "pro", "studio"] as const).flatMap(id =>
      (["monthly", "annual"] as const).map(cycle => ({
        id: prices.plans[id][cycle],
        cents:
          (cycle === "annual"
            ? planEntitlements(id).annualTotal
            : planEntitlements(id).monthlyPrice) * 100,
        interval: cycle === "annual" ? "year" : "month",
      }))
    ),
    ...Object.keys(CREDIT_TOP_UPS).map(id => ({
      id: prices.topUps[id as CreditTopUpId],
      cents: topUpPriceCents(id as CreditTopUpId),
      interval: null,
    })),
  ];
  add(
    "price_ids",
    expected.every(p => Boolean(p.id)),
    "Six subscription prices and three credit packs"
  );
  add(
    "portal_id",
    /^bpc_[A-Za-z0-9]+$/.test(cleanString(env.STRIPE_PORTAL_CONFIGURATION_ID)),
    "Customer portal for invoices, plan changes and cancellation"
  );
  if (!hasStripeKey(env.STRIPE_SECRET_KEY))
    return { ready: false, checkedAt, checks };
  const stripe = stripeClient(env.STRIPE_SECRET_KEY!);
  const results = await Promise.allSettled([
    stripe.accounts.retrieve(null),
    env.STRIPE_TAX_MODE === "not_collecting"
      ? Promise.resolve(null)
      : stripe.tax.registrations.list({ status: "active", limit: 1 }),
    env.STRIPE_TAX_MODE === "not_collecting"
      ? Promise.resolve(null)
      : stripe.tax.settings.retrieve(),
    Promise.all(
      expected.map(async p => {
        if (!p.id) return false;
        const price = await stripe.prices.retrieve(p.id);
        return (
          price.active &&
          price.currency === "eur" &&
          price.unit_amount === p.cents &&
          price.tax_behavior === "inclusive" &&
          (p.interval
            ? price.recurring?.interval === p.interval &&
              price.recurring.interval_count === 1
            : price.recurring === null)
        );
      })
    ),
    env.STRIPE_PORTAL_CONFIGURATION_ID
      ? stripe.billingPortal.configurations.retrieve(
          env.STRIPE_PORTAL_CONFIGURATION_ID
        )
      : Promise.resolve(null),
  ] as const);
  const [account, registrations, taxSettings, catalog, portal] = results;
  add(
    "account",
    account.status === "fulfilled" &&
      (!env.STRIPE_ACCOUNT_ID || account.value.id === env.STRIPE_ACCOUNT_ID) &&
      (env.STRIPE_SECRET_KEY!.includes("_test_") ||
        account.value.charges_enabled === true),
    "Correct Stripe account with payment acceptance enabled"
  );
  add(
    "tax",
    registrations.status === "fulfilled" &&
      taxSettings.status === "fulfilled" &&
      (env.STRIPE_TAX_MODE === "not_collecting" ||
        Boolean(
          registrations.value?.data.length &&
          taxSettings.value?.status === "active"
        )),
    env.STRIPE_TAX_MODE === "not_collecting"
      ? "Tax collection explicitly disabled by the operator"
      : "Active tax settings and a recorded tax registration"
  );
  add(
    "catalog",
    catalog.status === "fulfilled" && catalog.value.every(Boolean),
    "Stripe amounts, currencies and billing intervals match the website"
  );
  add(
    "portal",
    portal.status === "fulfilled" &&
      Boolean(
        portal.value?.active &&
        portal.value.features.subscription_cancel.enabled &&
        portal.value.features.invoice_history.enabled
      ),
    "Active portal with invoices and cancellation"
  );
  return { ready: checks.every(c => c.ready), checkedAt, checks };
}

function activeSubscription(row: BillingAccountRow | null): boolean {
  if (!row || !["active", "trialing"].includes(row.status)) return false;
  return Boolean(
    row.current_period_end && Date.parse(row.current_period_end) > Date.now()
  );
}

async function creditAccount(
  env: BillingEnvironment,
  ownerEmail: string
): Promise<CreditAccountRow> {
  await initializeBillingSchema(env);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO credit_accounts
       (owner_email, included_balance, topup_balance, created_at, updated_at)
     VALUES (?, 0, 0, ?, ?)
     ON CONFLICT(owner_email) DO NOTHING`
  )
    .bind(ownerEmail, now, now)
    .run();
  return (
    (await env.DB.prepare(
      "SELECT included_balance, topup_balance FROM credit_accounts WHERE owner_email = ?"
    )
      .bind(ownerEmail)
      .first<CreditAccountRow>()) || { included_balance: 0, topup_balance: 0 }
  );
}

async function applyTopUpGrant(
  env: BillingEnvironment,
  ownerEmail: string,
  credits: number,
  operationKey: string,
  category: string,
  description: string,
  referenceId?: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const amount = Math.max(0, Math.floor(credits));
  if (!amount) return;
  await creditAccount(env, ownerEmail);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO credit_ledger
         (id, owner_email, amount, included_amount, topup_amount, category,
          status, operation_key, reference_id, description, metadata_json,
          applied, created_at, settled_at)
       VALUES (?, ?, ?, 0, ?, ?, 'settled', ?, ?, ?, ?, 0, ?, ?)
       ON CONFLICT(operation_key) DO NOTHING`
    ).bind(
      crypto.randomUUID(),
      ownerEmail,
      amount,
      amount,
      category,
      operationKey,
      referenceId || null,
      description,
      JSON.stringify(metadata),
      now,
      now
    ),
    env.DB.prepare(
      `UPDATE credit_accounts
       SET topup_balance = topup_balance + COALESCE((
             SELECT topup_amount FROM credit_ledger
             WHERE operation_key = ? AND applied = 0
           ),
 0),
           updated_at = ?
       WHERE owner_email = ?`
    ).bind(operationKey, now, ownerEmail),
    env.DB.prepare(
      "UPDATE credit_ledger SET applied = 1 WHERE operation_key = ? AND applied = 0"
    ).bind(operationKey),
  ]);
}

async function resetIncludedCredits(
  env: BillingEnvironment,
  ownerEmail: string,
  credits: number,
  operationKey: string,
  description: string,
  referenceId?: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const target = Math.max(0, Math.floor(credits));
  await creditAccount(env, ownerEmail);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO credit_ledger
         (id, owner_email, amount, included_amount, topup_amount, category,
          status, operation_key, reference_id, description, metadata_json,
          applied, created_at, settled_at)
       SELECT ?, ?, ? - included_balance, ? - included_balance, 0,
              'subscription', 'settled', ?, ?, ?, ?, 0, ?, ?
       FROM credit_accounts
       WHERE owner_email = ?
       ON CONFLICT(operation_key) DO NOTHING`
    ).bind(
      crypto.randomUUID(),
      ownerEmail,
      target,
      target,
      operationKey,
      referenceId || null,
      description,
      JSON.stringify(metadata),
      now,
      now,
      ownerEmail
    ),
    env.DB.prepare(
      `UPDATE credit_accounts
       SET included_balance = included_balance + COALESCE((
             SELECT included_amount FROM credit_ledger
             WHERE operation_key = ? AND applied = 0
           ), 0),
           updated_at = ?
       WHERE owner_email = ?`
    ).bind(operationKey, now, ownerEmail),
    env.DB.prepare(
      "UPDATE credit_ledger SET applied = 1 WHERE operation_key = ? AND applied = 0"
    ).bind(operationKey),
  ]);
}

async function migrateLegacyCredits(
  env: BillingEnvironment,
  ownerEmail: string
): Promise<void> {
  await creditAccount(env, ownerEmail);
  const workspace = await env.DB.prepare(
    `SELECT COALESCE(CAST(json_extract(document, '$.profile.credits') AS INTEGER), 0) AS credits
     FROM workspace_state WHERE owner_email = ?`
  )
    .bind(ownerEmail)
    .first<{ credits: number | null }>()
    .catch(() => null);
  const legacyCredits = Math.max(
    0,
    Math.floor(Number(workspace?.credits) || 0)
  );
  if (legacyCredits) {
    await applyTopUpGrant(
      env,
      ownerEmail,
      legacyCredits,
      `legacy-workspace:${ownerEmail}`,
      "migration",
      "Existing workspace credits"
    );
    await env.DB.prepare(
      `UPDATE workspace_state
       SET document = json_set(document, '$.profile.credits', 0)
       WHERE owner_email = ?`
    )
      .bind(ownerEmail)
      .run()
      .catch(() => undefined);
  }
  const referrals = await env.DB.prepare(
    `SELECT id, credits_awarded FROM referral_claims
     WHERE referrer_email = ? AND status = 'verified' AND credits_awarded > 0`
  )
    .bind(ownerEmail)
    .all<{ id: string; credits_awarded: number }>()
    .catch(() => ({ results: [], success: false }));
  for (const referral of referrals.results) {
    await applyTopUpGrant(
      env,
      ownerEmail,
      referral.credits_awarded,
      `referral:${referral.id}`,
      "referral",
      "Referral reward",
      referral.id
    );
  }
  const priorTrendSpend = await env.DB.prepare(
    "SELECT COALESCE(SUM(credit_cost), 0) AS credits FROM trend_research_runs WHERE owner_email = ?"
  )
    .bind(ownerEmail)
    .first<{ credits: number | null }>()
    .catch(() => null);
  const spent = Math.max(0, Math.floor(Number(priorTrendSpend?.credits) || 0));
  if (spent) {
    await applyHistoricalDebit(
      env,
      ownerEmail,
      spent,
      `legacy-trend-spend:${ownerEmail}`,
      "Previous custom trend research"
    );
  }
}

async function applyHistoricalDebit(
  env: BillingEnvironment,
  ownerEmail: string,
  credits: number,
  operationKey: string,
  description: string
): Promise<void> {
  const current = await creditAccount(env, ownerEmail);
  const requested = Math.max(0, Math.floor(credits));
  const included = Math.min(current.included_balance, requested);
  const topUp = Math.min(current.topup_balance, requested - included);
  const amount = included + topUp;
  if (!amount) return;
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO credit_ledger
         (id, owner_email, amount, included_amount, topup_amount, category,
          status, operation_key, description, metadata_json, applied,
          created_at, settled_at)
       VALUES (?, ?, ?, ?, ?, 'migration', 'settled', ?, ?, '{}', 0, ?, ?)
       ON CONFLICT(operation_key) DO NOTHING`
    ).bind(
      crypto.randomUUID(),
      ownerEmail,
      -amount,
      -included,
      -topUp,
      operationKey,
      description,
      now,
      now
    ),
    env.DB.prepare(
      `UPDATE credit_accounts SET
         included_balance = included_balance + COALESCE((
           SELECT included_amount FROM credit_ledger
           WHERE operation_key = ? AND applied = 0
         ), 0),
         topup_balance = topup_balance + COALESCE((
           SELECT topup_amount FROM credit_ledger
           WHERE operation_key = ? AND applied = 0
         ), 0),
         updated_at = ?
       WHERE owner_email = ?`
    ).bind(operationKey, operationKey, now, ownerEmail),
    env.DB.prepare(
      "UPDATE credit_ledger SET applied = 1 WHERE operation_key = ? AND applied = 0"
    ).bind(operationKey),
  ]);
}

async function billingAccount(
  env: BillingEnvironment,
  ownerEmail: string
): Promise<BillingAccountRow | null> {
  await initializeBillingSchema(env);
  return env.DB.prepare("SELECT * FROM billing_accounts WHERE owner_email = ?")
    .bind(ownerEmail)
    .first<BillingAccountRow>();
}

function addCalendarMonth(iso: string): string {
  const date = new Date(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString();
}

async function applyDueAnnualCreditRenewals(
  env: BillingEnvironment,
  ownerEmail: string
): Promise<void> {
  let account = await billingAccount(env, ownerEmail);
  if (
    !account ||
    account.billing_cycle !== "annual" ||
    !account.plan_id ||
    !isPlanId(account.plan_id) ||
    !activeSubscription(account) ||
    !account.next_credit_renewal_at ||
    !account.current_period_end
  ) {
    return;
  }
  const planId = account.plan_id;
  const currentPeriodEnd = account.current_period_end;
  for (let index = 0; index < 12; index += 1) {
    const dueAt = account.next_credit_renewal_at;
    if (
      !dueAt ||
      Date.parse(dueAt) > Date.now() ||
      Date.parse(dueAt) >= Date.parse(currentPeriodEnd)
    ) {
      break;
    }
    const credits = planEntitlements(planId).monthlyCredits;
    await resetIncludedCredits(
      env,
      ownerEmail,
      credits,
      `annual-credit:${account.stripe_subscription_id || ownerEmail}:${dueAt}`,
      `${PLAN_NAME_BY_ID[planId]} monthly credits`,
      account.stripe_subscription_id || undefined,
      { planId, billingCycle: "annual", dueAt }
    );
    const next = addCalendarMonth(dueAt);
    await env.DB.prepare(
      `UPDATE billing_accounts SET next_credit_renewal_at = ?, updated_at = ?
       WHERE owner_email = ? AND next_credit_renewal_at = ?`
    )
      .bind(next, new Date().toISOString(), ownerEmail, dueAt)
      .run();
    account = (await billingAccount(env, ownerEmail)) || account;
  }
}

export async function availableCredits(
  env: BillingEnvironment,
  user: BillingUser
): Promise<number> {
  await migrateLegacyCredits(env, user.email);
  await applyDueAnnualCreditRenewals(env, user.email);
  const account = await creditAccount(env, user.email);
  return Math.max(
    0,
    Math.floor(account.included_balance) + Math.floor(account.topup_balance)
  );
}

export type CreditReservation = {
  id: string;
  cost: number;
  operationKey: string;
};

export async function reserveCredits(
  env: BillingEnvironment,
  user: BillingUser,
  input: {
    cost: number;
    operationKey: string;
    category: string;
    description: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<CreditReservation | null> {
  const cost = Math.max(1, Math.floor(input.cost));
  await migrateLegacyCredits(env, user.email);
  await applyDueAnnualCreditRenewals(env, user.email);
  const subscription = await billingAccount(env, user.email);
  if (!activeSubscription(subscription)) return null;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO credit_ledger
         (id, owner_email, amount, included_amount, topup_amount, category,
          status, operation_key, reference_id, description, metadata_json,
          applied, created_at)
       SELECT ?, owner_email, -?, -MIN(included_balance, ?),
              -( ? - MIN(included_balance, ?) ), ?, 'reserved', ?, ?, ?, ?, 0, ?
       FROM credit_accounts
       WHERE owner_email = ? AND included_balance + topup_balance >= ?
       ON CONFLICT(operation_key) DO NOTHING`
    ).bind(
      id,
      cost,
      cost,
      cost,
      cost,
      input.category,
      input.operationKey,
      input.referenceId || null,
      input.description,
      JSON.stringify(input.metadata || {}),
      now,
      user.email,
      cost
    ),
    env.DB.prepare(
      `UPDATE credit_accounts SET
         included_balance = included_balance + COALESCE((
           SELECT included_amount FROM credit_ledger
           WHERE operation_key = ? AND owner_email = ? AND applied = 0
         ), 0),
         topup_balance = topup_balance + COALESCE((
           SELECT topup_amount FROM credit_ledger
           WHERE operation_key = ? AND owner_email = ? AND applied = 0
         ), 0),
         updated_at = ?
       WHERE owner_email = ?`
    ).bind(
      input.operationKey,
      user.email,
      input.operationKey,
      user.email,
      now,
      user.email
    ),
    env.DB.prepare(
      `UPDATE credit_ledger SET applied = 1
       WHERE operation_key = ? AND owner_email = ? AND applied = 0`
    ).bind(input.operationKey, user.email),
  ]);
  const row = await env.DB.prepare(
    `SELECT id, amount, status FROM credit_ledger
     WHERE operation_key = ? AND owner_email = ?`
  )
    .bind(input.operationKey, user.email)
    .first<{ id: string; amount: number; status: string }>();
  if (
    !row ||
    row.amount !== -cost ||
    !["reserved", "settled"].includes(row.status)
  ) {
    return null;
  }
  return { id: row.id, cost, operationKey: input.operationKey };
}

export async function settleCreditReservation(
  env: BillingEnvironment,
  reservation: CreditReservation
): Promise<void> {
  await env.DB.prepare(
    `UPDATE credit_ledger SET status = 'settled', settled_at = ?
     WHERE id = ? AND status = 'reserved'`
  )
    .bind(new Date().toISOString(), reservation.id)
    .run();
}

export async function releaseCreditReservation(
  env: BillingEnvironment,
  reservation: CreditReservation
): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE credit_accounts SET
         included_balance = included_balance - COALESCE((
           SELECT included_amount FROM credit_ledger
           WHERE id = ? AND status = 'reserved'
         ), 0),
         topup_balance = topup_balance - COALESCE((
           SELECT topup_amount FROM credit_ledger
           WHERE id = ? AND status = 'reserved'
         ), 0),
         updated_at = ?
       WHERE owner_email = (
         SELECT owner_email FROM credit_ledger WHERE id = ?
       )`
    ).bind(reservation.id, reservation.id, now, reservation.id),
    env.DB.prepare(
      `UPDATE credit_ledger SET status = 'released', settled_at = ?
       WHERE id = ? AND status = 'reserved'`
    ).bind(now, reservation.id),
  ]);
}

export async function grantReferralCredits(
  env: BillingEnvironment,
  ownerEmail: string,
  claimId: string,
  credits: number
): Promise<void> {
  await applyTopUpGrant(
    env,
    ownerEmail,
    credits,
    `referral:${claimId}`,
    "referral",
    "Referral reward",
    claimId
  );
}

export async function billingSummary(
  env: BillingEnvironment,
  user: BillingUser
): Promise<BillingSummary> {
  await availableCredits(env, user);
  const usageThrough = new Date().toISOString();
  const usageSince = new Date(usageThrough);
  usageSince.setUTCHours(0, 0, 0, 0);
  usageSince.setUTCDate(usageSince.getUTCDate() - 29);
  const [credits, subscription, activity, usage] = await Promise.all([
    creditAccount(env, user.email),
    billingAccount(env, user.email),
    env.DB.prepare(
      `SELECT id, amount, category, description, status, created_at
       FROM credit_ledger WHERE owner_email = ?
       ORDER BY created_at DESC LIMIT 20`
    )
      .bind(user.email)
      .all<CreditLedgerRow>(),
    env.DB.prepare(
      `SELECT substr(created_at, 1, 10) AS date, category, SUM(-amount) AS credits
      FROM credit_ledger WHERE owner_email = ? AND created_at >= ? AND created_at <= ?
      AND status = 'settled' AND amount < 0
      AND category IN ('video', 'image', 'speech', 'script', 'analysis', 'transcription', 'edit-plan', 'trend-research')
      GROUP BY substr(created_at, 1, 10), category ORDER BY date`
    )
      .bind(user.email, usageSince.toISOString(), usageThrough)
      .all<{ date: string; category: string; credits: number }>(),
  ]);
  const planId = subscription?.plan_id || "";
  const cycle = subscription?.billing_cycle || "";
  const plan =
    subscription && isPlanId(planId) && isBillingCycle(cycle)
      ? {
          id: planId,
          name: PLAN_NAME_BY_ID[planId],
          billingCycle: cycle,
          status: subscription.status,
          ...planEntitlements(planId),
          currentPeriodEnd: subscription.current_period_end,
          nextCreditRenewalAt: subscription.next_credit_renewal_at,
          cancelAtPeriodEnd: subscription.cancel_at_period_end === 1,
        }
      : null;
  const readiness = await stripeReadiness(env);
  return {
    configured: readiness.ready,
    availableCredits: Math.max(
      0,
      credits.included_balance + credits.topup_balance
    ),
    includedCredits: Math.max(0, credits.included_balance),
    topUpCredits: Math.max(0, credits.topup_balance),
    adjustmentDebt: Math.max(0, -credits.topup_balance),
    canUseCredits: activeSubscription(subscription),
    canManageBilling:
      hasStripeKey(env.STRIPE_SECRET_KEY) &&
      Boolean(subscription?.stripe_customer_id),
    plan,
    topUps: (Object.keys(CREDIT_TOP_UPS) as CreditTopUpId[]).map(id => ({
      ...CREDIT_TOP_UPS[id],
      price: topUpPriceCents(id) / 100,
      available: readiness.ready,
    })),
    usage: { through: usageThrough, daily: usage.results },
    recentActivity: activity.results.map(item => ({
      id: item.id,
      amount: item.amount,
      category: item.category,
      description: item.description,
      status: item.status,
      createdAt: item.created_at,
    })),
  };
}

export async function socialAccountLimit(
  env: BillingEnvironment,
  user: BillingUser
): Promise<number> {
  const subscription = await billingAccount(env, user.email);
  return subscription &&
    activeSubscription(subscription) &&
    isPlanId(subscription.plan_id || "")
    ? planEntitlements(subscription.plan_id as PlanId).socialAccounts
    : 0;
}

function safeAppOrigin(request: Request, env: BillingEnvironment): string {
  const configured = cleanString(env.PUBLIC_APP_URL).replace(/\/$/, "");
  if (/^https:\/\/(?:www\.)?reelassati\.app$/i.test(configured)) {
    return configured;
  }
  const origin = new URL(request.url).origin;
  if (
    /^https:\/\/(?:www\.)?reelassati\.app$/i.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.chatgpt\.site$/i.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) ||
    /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin)
  ) {
    return origin;
  }
  return "https://www.reelassati.app";
}

async function currentSubscription(env: BillingEnvironment, id: string) {
  if (!hasStripeKey(env.STRIPE_SECRET_KEY)) return null;
  try {
    return (await stripeClient(env.STRIPE_SECRET_KEY!).subscriptions.retrieve(
      id
    )) as unknown as Record<string, unknown>;
  } catch {
    throw new Error("Stripe subscription reconciliation unavailable");
  }
}

function billingFailure(cause: unknown): Response {
  // SDK errors can contain request parameters. Keep them out of customer messages/logs.
  console.error("Stripe operation failed", {
    type: cause instanceof Error ? cause.name : "UnknownError",
  });
  return error("Billing could not be opened. Try again shortly.", 502);
}

type CheckoutRow = {
  selection: string;
  attempt_id: string;
  session_id: string | null;
};

async function checkoutSession(
  request: Request,
  env: BillingEnvironment,
  user: BillingUser,
  kind: "subscription" | "topup",
  id: string,
  cycle?: BillingCycle
): Promise<Response> {
  if (!stripeBillingConfigured(env)) {
    return error(
      "Billing activation is in progress. No payment was attempted.",
      503
    );
  }
  if (!(await stripeReadiness(env)).ready) {
    return error(
      "Payment setup is being completed. No payment was attempted.",
      503
    );
  }
  const prices = parsePriceConfiguration(env);
  const priceId =
    kind === "subscription" && isPlanId(id) && cycle
      ? prices.plans[id][cycle]
      : isCreditTopUpId(id)
        ? prices.topUps[id]
        : undefined;
  if (!priceId) return error("That purchase option is not available", 422);
  const account = await billingAccount(env, user.email);
  if (kind === "topup" && !activeSubscription(account))
    return error("Choose an active plan before adding extra credits", 409);
  if (kind === "subscription" && activeSubscription(account))
    return error(
      "Manage or change your active plan from the billing portal",
      409
    );

  // One resumable session per owner/purchase kind. A lease covers concurrent tabs,
  // and the persisted attempt ID survives a provider response or process timeout.
  const lease = crypto.randomUUID();
  const selection = `${id}:${cycle || "once"}:${priceId}:v3`;
  await env.DB.prepare(
    `INSERT INTO billing_checkouts
    (owner_email, kind, selection, attempt_id, lease_token, lease_until)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_email, kind) DO UPDATE SET lease_token = excluded.lease_token,
    lease_until = excluded.lease_until WHERE billing_checkouts.lease_until < ?`
  )
    .bind(
      user.email,
      kind,
      selection,
      crypto.randomUUID(),
      lease,
      Date.now() + 120_000,
      Date.now()
    )
    .run();
  let state = await env.DB.prepare(
    "SELECT selection, attempt_id, session_id FROM billing_checkouts WHERE owner_email = ? AND kind = ? AND lease_token = ?"
  )
    .bind(user.email, kind, lease)
    .first<CheckoutRow>();
  if (!state)
    return error(
      "Checkout is already opening. Please try again in a moment.",
      409
    );
  const stripe = stripeClient(env.STRIPE_SECRET_KEY!);
  try {
    let customerId = account?.stripe_customer_id;
    if (!customerId) {
      const customerKey = await hmacHex(
        env.STRIPE_SECRET_KEY!,
        `customer:${user.email}`
      );
      const customer = await stripe.customers.create(
        { email: user.email, metadata: { owner_email: user.email } },
        { idempotencyKey: `reelassati-customer:${customerKey}` }
      );
      customerId = customer.id;
      const now = new Date().toISOString();
      await env.DB.prepare(
        `INSERT INTO billing_accounts (owner_email, stripe_customer_id, status, created_at, updated_at)
        VALUES (?, ?, 'inactive', ?, ?) ON CONFLICT(owner_email) DO UPDATE SET
        stripe_customer_id = COALESCE(billing_accounts.stripe_customer_id, excluded.stripe_customer_id), updated_at = excluded.updated_at`
      )
        .bind(user.email, customerId, now, now)
        .run();
    }
    if (kind === "subscription") {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
      });
      if (
        subscriptions.has_more ||
        subscriptions.data.some(
          s => !["canceled", "incomplete_expired"].includes(s.status)
        )
      )
        return error(
          "An existing subscription or payment needs attention. Open Manage subscription to continue.",
          409
        );
    }
    let newAttempt = state.selection !== selection;
    if (!state.session_id) {
      const recent = await stripe.checkout.sessions.list({
        customer: customerId,
        created: { gte: Math.floor(Date.now() / 1000) - 86400 },
        limit: 100,
      });
      const attemptId = state.attempt_id;
      const recovered = recent.data.find(
        s => s.metadata?.checkout_attempt_id === attemptId
      );
      if (recovered) state.session_id = recovered.id;
      else if (recent.has_more)
        return error(
          "There are too many recent checkout attempts. Complete or close an existing checkout first.",
          409
        );
    }
    if (state.session_id) {
      const previous = await stripe.checkout.sessions.retrieve(
        state.session_id
      );
      if (previous.status === "open" && !newAttempt && previous.url)
        return json({ checkoutUrl: previous.url });
      if (previous.status === "open")
        await stripe.checkout.sessions.expire(previous.id);
      if (previous.status === "complete" && kind === "subscription") {
        const priorId =
          typeof previous.subscription === "string"
            ? previous.subscription
            : previous.subscription?.id;
        const prior = priorId
          ? await stripe.subscriptions.retrieve(priorId)
          : null;
        if (
          !prior ||
          !["canceled", "incomplete_expired"].includes(prior.status)
        )
          return error(
            "Your previous payment is being confirmed. Refresh your balance shortly.",
            409
          );
      }
      newAttempt = true;
    }
    if (newAttempt) {
      state = { selection, attempt_id: crypto.randomUUID(), session_id: null };
      await env.DB.prepare(
        "UPDATE billing_checkouts SET selection = ?, attempt_id = ?, session_id = NULL WHERE owner_email = ? AND kind = ? AND lease_token = ?"
      )
        .bind(selection, state.attempt_id, user.email, kind, lease)
        .run();
    }
    const origin = safeAppOrigin(request, env);
    const metadata: Record<string, string> = {
      owner_email: user.email,
      purchase_kind: kind,
      checkout_attempt_id: state.attempt_id,
    };
    if (kind === "subscription")
      Object.assign(metadata, { plan_id: id, billing_cycle: cycle! });
    else
      Object.assign(metadata, {
        topup_id: id,
        credits: String(CREDIT_TOP_UPS[id as CreditTopUpId].credits),
        quoted_cents: String(topUpPriceCents(id as CreditTopUpId)),
        pricing_version: "3",
      });
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: kind === "subscription" ? "subscription" : "payment",
      customer: customerId,
      customer_update: { address: "auto", name: "auto" },
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.email,
      success_url: `${origin}/#/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#/dashboard/billing?checkout=cancelled`,
      metadata,
      // Keep the integration label stable across retries of a persisted attempt.
      integration_identifier: `reelassati_${kind}_${state.attempt_id
        .replace(/-/g, "")
        .slice(0, 8)
        .replace(/[0-9]/g, n => String.fromCharCode(97 + Number(n)))}`,
      automatic_tax: { enabled: env.STRIPE_TAX_MODE !== "not_collecting" },
      tax_id_collection: { enabled: true },
      billing_address_collection: "required",
      ...(kind === "subscription"
        ? { subscription_data: { metadata }, allow_promotion_codes: true }
        : { payment_intent_data: { metadata } }),
    };
    const session = await stripe.checkout.sessions.create(params, {
      idempotencyKey: `reelassati-checkout:${state.attempt_id}`,
    });
    if (!session.url || !/^https:\/\/checkout\.stripe\.com\//.test(session.url))
      return error("Billing did not return a secure checkout URL", 502);
    await env.DB.prepare(
      "UPDATE billing_checkouts SET session_id = ? WHERE owner_email = ? AND kind = ? AND lease_token = ?"
    )
      .bind(session.id, user.email, kind, lease)
      .run();
    return json({ checkoutUrl: session.url });
  } catch (cause) {
    return billingFailure(cause);
  } finally {
    await env.DB.prepare(
      "UPDATE billing_checkouts SET lease_token = NULL, lease_until = 0 WHERE owner_email = ? AND kind = ? AND lease_token = ?"
    )
      .bind(user.email, kind, lease)
      .run();
  }
}

export async function handleBillingApi(
  request: Request,
  env: BillingEnvironment,
  user: BillingUser,
  url: URL
): Promise<Response> {
  if (url.pathname === "/api/billing/summary" && request.method === "GET") {
    return json({ billing: await billingSummary(env, user) });
  }
  if (
    url.pathname === "/api/billing/checkout-status" &&
    request.method === "GET"
  ) {
    const sessionId = url.searchParams.get("session_id") || "";
    if (!/^cs_[A-Za-z0-9_]{1,200}$/.test(sessionId))
      return error("Checkout not found", 404);
    if (!hasStripeKey(env.STRIPE_SECRET_KEY))
      return error("Billing is not active yet", 503);
    try {
      const session = await stripeClient(
        env.STRIPE_SECRET_KEY!
      ).checkout.sessions.retrieve(sessionId);
      if (normalizeEmail(session.metadata?.owner_email) !== user.email)
        return error("Checkout not found", 404);
      let status: "pending" | "processing" | "complete" | "expired" =
        session.status === "expired" ? "expired" : "pending";
      if (session.status === "complete") {
        status = "processing";
        if (["paid", "no_payment_required"].includes(session.payment_status)) {
          if (session.metadata?.purchase_kind === "topup") {
            const applied = await env.DB.prepare(
              "SELECT id FROM credit_ledger WHERE owner_email = ? AND reference_id = ? AND category = 'topup' AND applied = 1 AND status = 'settled'"
            )
              .bind(user.email, session.id)
              .first();
            if (applied) status = "complete";
          } else {
            const subscription = await billingAccount(env, user.email);
            const id =
              typeof session.subscription === "string"
                ? session.subscription
                : session.subscription?.id;
            if (
              activeSubscription(subscription) &&
              subscription?.stripe_subscription_id === id
            )
              status = "complete";
          }
        }
      }
      return json({ status });
    } catch (cause) {
      return billingFailure(cause);
    }
  }
  if (url.pathname === "/api/billing/checkout" && request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as {
      planId?: unknown;
      billingCycle?: unknown;
    };
    const planId = cleanString(body.planId);
    const cycle = cleanString(body.billingCycle);
    if (!isPlanId(planId) || !isBillingCycle(cycle)) {
      return error("Choose a valid plan and billing cycle");
    }
    return checkoutSession(request, env, user, "subscription", planId, cycle);
  }
  if (
    url.pathname === "/api/billing/topup-checkout" &&
    request.method === "POST"
  ) {
    const body = (await request.json().catch(() => ({}))) as {
      topUpId?: unknown;
    };
    const topUpId = cleanString(body.topUpId);
    if (!isCreditTopUpId(topUpId)) return error("Choose a valid credit pack");
    return checkoutSession(request, env, user, "topup", topUpId);
  }
  if (url.pathname === "/api/billing/portal" && request.method === "POST") {
    const account = await billingAccount(env, user.email);
    if (!account?.stripe_customer_id) {
      return error("No billing account is attached to this workspace", 404);
    }
    const origin = safeAppOrigin(request, env);
    let portal: Stripe.BillingPortal.Session;
    try {
      portal = await stripeClient(
        env.STRIPE_SECRET_KEY || ""
      ).billingPortal.sessions.create({
        customer: account.stripe_customer_id,
        configuration: env.STRIPE_PORTAL_CONFIGURATION_ID,
        return_url: `${origin}/#/dashboard/billing`,
      });
    } catch (cause) {
      return billingFailure(cause);
    }
    const portalUrl = cleanString(portal.url);
    if (!/^https:\/\/billing\.stripe\.com\//.test(portalUrl)) {
      return error("Billing did not return a secure portal URL", 502);
    }
    return json({ portalUrl });
  }
  return error("Billing route not found", 404);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return bytesToHex(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
    )
  );
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  const fields = (signatureHeader || "").split(",").map(field => field.trim());
  const timestamp = fields.find(field => field.startsWith("t="))?.slice(2);
  const signatures = fields
    .filter(field => field.startsWith("v1="))
    .map(field => field.slice(3));
  if (!timestamp || !/^\d+$/.test(timestamp) || !signatures.length)
    return false;
  const timestampSeconds = Number(timestamp);
  if (Math.abs(Date.now() / 1_000 - timestampSeconds) > 300) return false;
  const expected = await hmacHex(secret, `${timestamp}.${rawBody}`);
  return signatures.some(signature => constantTimeEqual(signature, expected));
}

function unixIso(value: unknown): string | null {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1_000).toISOString();
}

function priceIdentity(
  env: BillingEnvironment,
  priceId: string
): { planId: PlanId; cycle: BillingCycle } | null {
  const prices = parsePriceConfiguration(env);
  for (const planId of ["creator", "pro", "studio"] as const) {
    for (const cycle of ["monthly", "annual"] as const) {
      if (prices.plans[planId][cycle] === priceId) return { planId, cycle };
    }
  }
  return null;
}

function eventMetadata(
  object: Record<string, unknown>
): Record<string, unknown> {
  const direct = record(object.metadata);
  const parent = record(object.parent);
  const subscriptionDetails = record(parent?.subscription_details);
  return { ...record(subscriptionDetails?.metadata), ...direct };
}

function subscriptionIdFromObject(object: Record<string, unknown>): string {
  const parent = record(object.parent);
  const details = record(parent?.subscription_details);
  const subscription = details?.subscription;
  return cleanString(
    typeof subscription === "string" ? subscription : record(subscription)?.id,
    cleanString(object.subscription)
  );
}

function priceIdFromObject(object: Record<string, unknown>): string {
  const lines = record(object.lines);
  const data = Array.isArray(lines?.data) ? lines.data : [];
  const firstLine = record(
    data.find(line => Number(record(line)?.amount) > 0) || data[0]
  );
  const price = record(firstLine?.price);
  const pricing = record(firstLine?.pricing);
  const priceDetails = record(pricing?.price_details);
  const items = record(object.items);
  const itemData = Array.isArray(items?.data) ? items.data : [];
  const firstItem = record(itemData[0]);
  const itemPrice = record(firstItem?.price);
  return cleanString(
    price?.id,
    cleanString(priceDetails?.price, cleanString(itemPrice?.id))
  );
}

function periodFromObject(object: Record<string, unknown>): {
  start: string | null;
  end: string | null;
} {
  const lines = record(object.lines);
  const data = Array.isArray(lines?.data) ? lines.data : [];
  const firstLine = record(
    data.find(line => Number(record(line)?.amount) > 0) || data[0]
  );
  const period = record(firstLine?.period);
  const items = record(object.items);
  const itemData = Array.isArray(items?.data) ? items.data : [];
  const firstItem = record(itemData[0]);
  return {
    start: unixIso(
      object.current_period_start ??
        firstItem?.current_period_start ??
        period?.start
    ),
    end: unixIso(
      object.current_period_end ?? firstItem?.current_period_end ?? period?.end
    ),
  };
}

async function ownerForStripeObject(
  env: BillingEnvironment,
  object: Record<string, unknown>
): Promise<string> {
  const metadata = eventMetadata(object);
  const supplied = normalizeEmail(
    metadata.owner_email || object.customer_email || object.client_reference_id
  );
  if (validEmail(supplied)) return supplied;
  const customerId = cleanString(object.customer);
  const subscriptionId =
    subscriptionIdFromObject(object) || cleanString(object.id);
  const existing = await env.DB.prepare(
    `SELECT owner_email FROM billing_accounts
     WHERE stripe_customer_id = ? OR stripe_subscription_id = ? LIMIT 1`
  )
    .bind(customerId || "__none__", subscriptionId || "__none__")
    .first<{ owner_email: string }>();
  return normalizeEmail(existing?.owner_email);
}

async function upsertBillingAccount(
  env: BillingEnvironment,
  input: {
    ownerEmail: string;
    customerId?: string;
    subscriptionId?: string;
    planId?: PlanId;
    cycle?: BillingCycle;
    status?: string;
    periodStart?: string | null;
    periodEnd?: string | null;
    nextCreditRenewalAt?: string | null;
    cancelAtPeriodEnd?: boolean;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO billing_accounts
       (owner_email, stripe_customer_id, stripe_subscription_id, plan_id,
        billing_cycle, status, current_period_start, current_period_end,
        next_credit_renewal_at, cancel_at_period_end, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner_email) DO UPDATE SET
       stripe_customer_id = COALESCE(excluded.stripe_customer_id, stripe_customer_id),
       stripe_subscription_id = COALESCE(excluded.stripe_subscription_id, stripe_subscription_id),
       plan_id = COALESCE(excluded.plan_id, plan_id),
       billing_cycle = COALESCE(excluded.billing_cycle, billing_cycle),
       status = excluded.status,
       current_period_start = COALESCE(excluded.current_period_start, current_period_start),
       current_period_end = COALESCE(excluded.current_period_end, current_period_end),
       next_credit_renewal_at = COALESCE(excluded.next_credit_renewal_at, next_credit_renewal_at),
       cancel_at_period_end = excluded.cancel_at_period_end,
       updated_at = excluded.updated_at`
  )
    .bind(
      input.ownerEmail,
      input.customerId || null,
      input.subscriptionId || null,
      input.planId || null,
      input.cycle || null,
      input.status || "inactive",
      input.periodStart || null,
      input.periodEnd || null,
      input.nextCreditRenewalAt || null,
      input.cancelAtPeriodEnd ? 1 : 0,
      now,
      now
    )
    .run();
}

async function qualifyReferralFromPaidPlan(
  env: BillingEnvironment,
  ownerEmail: string,
  eventId: string,
  planId: PlanId
): Promise<void> {
  const claim = await env.DB.prepare(
    `SELECT id, referrer_email FROM referral_claims
     WHERE referred_email = ? AND status = 'pending' LIMIT 1`
  )
    .bind(ownerEmail)
    .first<{ id: string; referrer_email: string }>()
    .catch(() => null);
  if (!claim) return;
  const now = new Date().toISOString();
  const updated = await env.DB.prepare(
    `UPDATE referral_claims
     SET status = 'verified', credits_awarded = 500, value_cents = 500,
         qualified_at = ?, payment_event_id = ?, plan_id = ?
     WHERE id = ? AND status = 'pending' AND payment_event_id IS NULL`
  )
    .bind(now, eventId, planId, claim.id)
    .run();
  if ((updated.meta?.changes || 0) === 1) {
    await grantReferralCredits(env, claim.referrer_email, claim.id, 500);
  }
}

/** A paid mid-cycle upgrade adds only the unused portion of the allowance difference. */
async function applyProratedPlanCredits(
  env: BillingEnvironment,
  ownerEmail: string,
  invoice: Record<string, unknown>,
  planId: PlanId,
  start: string,
  end: string | null,
  cycle: BillingCycle
) {
  const lines = record(invoice.lines);
  const data = (Array.isArray(lines?.data) ? lines.data : [])
    .map(record)
    .filter((line): line is Record<string, unknown> => Boolean(line));
  const oldLine = data.find(
    line =>
      Number(line.amount) < 0 &&
      priceIdentity(env, priceIdFromObject({ lines: { data: [line] } }))
  );
  const oldPlan = oldLine
    ? priceIdentity(env, priceIdFromObject({ lines: { data: [oldLine] } }))
        ?.planId
    : null;
  // Without a credited old-plan line, don't guess an allowance from an unrelated invoice.
  if (!oldPlan || !end) return;
  const newLine = data.find(
    line =>
      Number(line.amount) > 0 &&
      priceIdentity(env, priceIdFromObject({ lines: { data: [line] } }))
        ?.planId === planId
  );
  if (!newLine) return;
  const changeAt = unixIso(record(newLine.period)?.start);
  if (!changeAt) return;
  if (cycle === "annual") {
    for (
      let i = 0;
      i < 12 && Date.parse(addCalendarMonth(start)) <= Date.parse(changeAt);
      i++
    )
      start = addCalendarMonth(start);
    if (Date.parse(addCalendarMonth(start)) < Date.parse(end))
      end = addCalendarMonth(start);
  }
  const fraction = Math.min(
    1,
    Math.max(
      0,
      (Date.parse(end) - Date.parse(changeAt)) /
        Math.max(1, Date.parse(end) - Date.parse(start))
    )
  );
  const amount = Math.max(
    0,
    Math.floor(
      (planEntitlements(planId).monthlyCredits -
        planEntitlements(oldPlan).monthlyCredits) *
        fraction
    )
  );
  if (!amount) return;
  await creditAccount(env, ownerEmail);
  const key = `stripe-plan-upgrade:${cleanString(invoice.id)}`;
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO credit_ledger (id, owner_email, amount, included_amount, topup_amount, category, status, operation_key, reference_id, description, metadata_json, applied, created_at, settled_at) VALUES (?, ?, ?, ?, 0, 'subscription', 'settled', ?, ?, ?, ?, 0, ?, ?) ON CONFLICT(operation_key) DO NOTHING`
    ).bind(
      crypto.randomUUID(),
      ownerEmail,
      amount,
      amount,
      key,
      cleanString(invoice.id),
      "Prorated plan upgrade credits",
      JSON.stringify({ planId, oldPlan, fraction }),
      now,
      now
    ),
    env.DB.prepare(
      `UPDATE credit_accounts SET included_balance = included_balance + COALESCE((SELECT included_amount FROM credit_ledger WHERE operation_key = ? AND applied = 0), 0), updated_at = ? WHERE owner_email = ?`
    ).bind(key, now, ownerEmail),
    env.DB.prepare(
      "UPDATE credit_ledger SET applied = 1 WHERE operation_key = ?"
    ).bind(key),
  ]);
}

async function processStripeEvent(
  env: BillingEnvironment,
  eventId: string,
  eventType: string,
  object: Record<string, unknown>,
  eventCreated = Math.floor(Date.now() / 1000)
): Promise<void> {
  if (
    eventType === "charge.refunded" ||
    eventType.startsWith("charge.dispute.")
  ) {
    if (
      !(await adjustCreditPurchase(
        env,
        eventId,
        eventType,
        object,
        eventCreated
      ))
    ) {
      const owner = await ownerForStripeObject(env, object);
      if (validEmail(owner))
        throw new Error(
          "Payment adjustment requires reconciliation before retry"
        );
    }
    return;
  }
  if (
    eventType === "checkout.session.completed" ||
    eventType === "checkout.session.async_payment_succeeded"
  ) {
    const ownerEmail = await ownerForStripeObject(env, object);
    if (!validEmail(ownerEmail)) return;
    const metadata = eventMetadata(object);
    const purchaseKind = cleanString(metadata.purchase_kind);
    const customerId = cleanString(object.customer);
    if (
      purchaseKind === "topup" &&
      cleanString(object.payment_status) === "paid"
    ) {
      const topUpId = cleanString(metadata.topup_id);
      if (isCreditTopUpId(topUpId)) {
        // Old Checkout sessions retain their original allowance after repricing.
        const credits = ["2", "3"].includes(
          cleanString(metadata.pricing_version)
        )
          ? Number(metadata.credits)
          : ({ boost: 500, momentum: 2000, scale: 5000 } as const)[topUpId];
        if (!Number.isSafeInteger(credits) || credits <= 0 || credits > 5000)
          throw new Error("Invalid top-up credit snapshot");
        await registerCreditPurchase(
          env,
          cleanString(object.payment_intent),
          ownerEmail,
          credits,
          Number(object.amount_total)
        );
        // A credit purchase must never overwrite subscription entitlements.
        await env.DB.prepare(
          "UPDATE billing_accounts SET stripe_customer_id = COALESCE(stripe_customer_id, ?), updated_at = ? WHERE owner_email = ?"
        )
          .bind(customerId || null, new Date().toISOString(), ownerEmail)
          .run();
        await applyTopUpGrant(
          env,
          ownerEmail,
          credits,
          `stripe-topup:${cleanString(object.id, eventId)}`,
          "topup",
          `${credits.toLocaleString("en-US")} credit top-up`,
          cleanString(object.id, eventId),
          {
            topUpId,
            paymentIntentId: cleanString(object.payment_intent),
            paidCents: Number(object.amount_total) || 0,
            credits,
          }
        );
      }
      return;
    }
    const planId = cleanString(metadata.plan_id);
    const cycle = cleanString(metadata.billing_cycle);
    if (isPlanId(planId) && isBillingCycle(cycle)) {
      const existing = await billingAccount(env, ownerEmail);
      // Invoice/subscription events can arrive before Checkout completion.
      if (existing?.stripe_subscription_id === cleanString(object.subscription))
        return;
      if (activeSubscription(existing)) return;
      await upsertBillingAccount(env, {
        ownerEmail,
        customerId,
        subscriptionId: cleanString(object.subscription),
        planId,
        cycle,
        status: "incomplete",
      });
    }
    return;
  }

  if (eventType === "invoice.paid") {
    const subscriptionId = subscriptionIdFromObject(object);
    if (!subscriptionId) return; // One-off invoices cannot refill plan credits.
    const ownerEmail = await ownerForStripeObject(env, object);
    if (!validEmail(ownerEmail)) return;
    const latest = await currentSubscription(env, subscriptionId);
    if (
      latest &&
      (cleanString(
        latest.latest_invoice,
        cleanString(record(latest.latest_invoice)?.id)
      ) !== cleanString(object.id) ||
        !["active", "trialing"].includes(cleanString(latest.status)))
    )
      return;
    const metadata = eventMetadata(latest || object);
    const identity = priceIdentity(env, priceIdFromObject(latest || object));
    const metadataPlan = cleanString(metadata.plan_id);
    const metadataCycle = cleanString(metadata.billing_cycle);
    const existing = await billingAccount(env, ownerEmail);
    const planId =
      identity?.planId ||
      (isPlanId(metadataPlan) ? metadataPlan : null) ||
      (existing && isPlanId(existing.plan_id || "")
        ? (existing.plan_id as PlanId)
        : null);
    const cycle =
      identity?.cycle ||
      (isBillingCycle(metadataCycle) ? metadataCycle : null) ||
      (existing && isBillingCycle(existing.billing_cycle || "")
        ? (existing.billing_cycle as BillingCycle)
        : null);
    if (!planId || !cycle) return;
    if (
      existing?.stripe_subscription_id &&
      existing.stripe_subscription_id !== subscriptionId &&
      activeSubscription(existing)
    )
      throw new Error(
        "A different subscription is already active; reconcile duplicate purchase"
      );
    const period = periodFromObject(latest || object);
    if (
      period.end &&
      existing?.current_period_end &&
      Date.parse(period.end) < Date.parse(existing.current_period_end)
    )
      return;
    if (
      existing?.status === "canceled" &&
      existing.stripe_subscription_id === subscriptionId
    )
      return;
    const periodStart = period.start || new Date().toISOString();
    const nextCreditRenewalAt =
      cycle === "annual" &&
      existing?.current_period_start === periodStart &&
      existing.next_credit_renewal_at
        ? existing.next_credit_renewal_at
        : cycle === "annual"
          ? addCalendarMonth(periodStart)
          : period.end;
    await upsertBillingAccount(env, {
      ownerEmail,
      customerId: cleanString(object.customer),
      subscriptionId,
      planId,
      cycle,
      status: "active",
      periodStart,
      periodEnd: period.end,
      nextCreditRenewalAt,
      cancelAtPeriodEnd: latest
        ? latest.cancel_at_period_end === true
        : existing?.cancel_at_period_end === 1,
    });
    if (cleanString(object.billing_reason) === "subscription_update") {
      await applyProratedPlanCredits(
        env,
        ownerEmail,
        object,
        planId,
        periodStart,
        period.end,
        cycle
      );
      return;
    }
    await resetIncludedCredits(
      env,
      ownerEmail,
      planEntitlements(planId).monthlyCredits,
      `stripe-plan-credits:${cleanString(object.id, eventId)}`,
      `${PLAN_NAME_BY_ID[planId]} monthly credits`,
      cleanString(object.id, eventId),
      { planId, billingCycle: cycle, periodStart }
    );
    await qualifyReferralFromPaidPlan(env, ownerEmail, eventId, planId);
    return;
  }

  if (
    eventType === "customer.subscription.updated" ||
    eventType === "customer.subscription.deleted"
  ) {
    object = (await currentSubscription(env, cleanString(object.id))) || object;
    const ownerEmail = await ownerForStripeObject(env, object);
    if (!validEmail(ownerEmail)) return;
    const identity = priceIdentity(env, priceIdFromObject(object));
    const metadata = eventMetadata(object);
    const metadataPlan = cleanString(metadata.plan_id);
    const metadataCycle = cleanString(metadata.billing_cycle);
    const planId =
      identity?.planId || (isPlanId(metadataPlan) ? metadataPlan : undefined);
    const cycle =
      identity?.cycle ||
      (isBillingCycle(metadataCycle) ? metadataCycle : undefined);
    const period = periodFromObject(object);
    const existing = await billingAccount(env, ownerEmail);
    if (
      existing?.stripe_subscription_id &&
      existing.stripe_subscription_id !== cleanString(object.id)
    )
      return;
    if (
      period.end &&
      existing?.current_period_end &&
      Date.parse(period.end) < Date.parse(existing.current_period_end)
    )
      return;
    if (
      existing?.status === "canceled" &&
      eventType !== "customer.subscription.deleted"
    )
      return;
    const status =
      eventType === "customer.subscription.deleted"
        ? "canceled"
        : cleanString(object.status, "inactive");
    await upsertBillingAccount(env, {
      ownerEmail,
      customerId: cleanString(object.customer),
      subscriptionId: cleanString(object.id),
      planId,
      cycle,
      status,
      periodStart: period.start,
      periodEnd: period.end,
      nextCreditRenewalAt:
        cycle === "annual" && period.start
          ? existing?.stripe_subscription_id === cleanString(object.id) &&
            existing.current_period_start === period.start &&
            existing.next_credit_renewal_at
            ? existing.next_credit_renewal_at
            : addCalendarMonth(period.start)
          : period.end,
      cancelAtPeriodEnd: object.cancel_at_period_end === true,
    });
    if (eventType === "customer.subscription.deleted") {
      await resetIncludedCredits(
        env,
        ownerEmail,
        0,
        `subscription-ended:${eventId}`,
        "Plan credits expired",
        cleanString(object.id)
      );
    }
    return;
  }

  if (eventType === "invoice.payment_failed") {
    if (!subscriptionIdFromObject(object)) return;
    const ownerEmail = await ownerForStripeObject(env, object);
    if (!validEmail(ownerEmail)) return;
    const existing = await billingAccount(env, ownerEmail);
    if (existing?.stripe_subscription_id !== subscriptionIdFromObject(object))
      return;
    const latest = await currentSubscription(
      env,
      subscriptionIdFromObject(object)
    );
    if (
      latest &&
      ["active", "trialing", "canceled"].includes(cleanString(latest.status))
    )
      return;
    const failedPeriod = periodFromObject(object);
    if (
      failedPeriod.end &&
      existing?.current_period_end &&
      Date.parse(failedPeriod.end) < Date.parse(existing.current_period_end)
    )
      return;
    await upsertBillingAccount(env, {
      ownerEmail,
      customerId: cleanString(object.customer),
      subscriptionId: subscriptionIdFromObject(object),
      planId:
        existing && isPlanId(existing.plan_id || "")
          ? (existing.plan_id as PlanId)
          : undefined,
      cycle:
        existing && isBillingCycle(existing.billing_cycle || "")
          ? (existing.billing_cycle as BillingCycle)
          : undefined,
      status: "past_due",
    });
  }
}

export async function handleStripeWebhook(
  request: Request,
  env: BillingEnvironment
): Promise<Response> {
  const secret = cleanString(env.STRIPE_WEBHOOK_SECRET);
  if (request.method !== "POST" || !secret.startsWith("whsec_")) {
    return error("Webhook unavailable", 404);
  }
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > 1_000_000) {
    return error("Webhook body is too large", 413);
  }
  const rawBody = await request.text();
  if (rawBody.length > 1_000_000)
    return error("Webhook body is too large", 413);
  if (
    !(await verifyStripeSignature(
      rawBody,
      request.headers.get("stripe-signature"),
      secret
    ))
  ) {
    return error("Webhook signature is invalid", 401);
  }
  let event: Record<string, unknown> | null;
  try {
    event = record(JSON.parse(rawBody));
  } catch {
    return error("Webhook event is invalid");
  }
  const eventId = cleanString(event?.id);
  const eventType = cleanString(event?.type);
  const data = record(event?.data);
  const object = record(data?.object);
  if (!eventId || !eventType || !object)
    return error("Webhook event is invalid");
  await initializeBillingSchema(env);
  const existing = await env.DB.prepare(
    "SELECT status FROM stripe_events WHERE event_id = ?"
  )
    .bind(eventId)
    .first<{ status: string }>();
  if (existing?.status === "processed") return json({ received: true });
  const now = new Date().toISOString();
  const lease = await env.DB.prepare(
    `INSERT INTO stripe_events (event_id, event_type, status, created_at)
     VALUES (?, ?, 'processing', ?)
     ON CONFLICT(event_id) DO UPDATE SET status = 'processing', error = NULL, created_at = excluded.created_at WHERE stripe_events.status = 'failed' OR (stripe_events.status = 'processing' AND stripe_events.created_at <= ?)`
  )
    .bind(eventId, eventType, now, new Date(Date.now() - 300000).toISOString())
    .run();
  if (lease.meta?.changes !== 1)
    return error("This event is already processing; retry shortly", 409);
  try {
    await processStripeEvent(
      env,
      eventId,
      eventType,
      object,
      Number(event?.created) || Math.floor(Date.now() / 1000)
    );
    await env.DB.prepare(
      `UPDATE stripe_events SET status = 'processed', processed_at = ?, error = NULL
       WHERE event_id = ?`
    )
      .bind(new Date().toISOString(), eventId)
      .run();
    return json({ received: true });
  } catch (cause) {
    console.error("Stripe webhook processing failed", {
      eventId,
      eventType,
      errorType: cause instanceof Error ? cause.name : typeof cause,
    });
    await env.DB.prepare(
      `UPDATE stripe_events SET status = 'failed', error = ? WHERE event_id = ?`
    )
      .bind("processing_failure", eventId)
      .run()
      .catch(() => undefined);
    return error("Webhook processing failed", 500);
  }
}

export async function applyAllDueAnnualCreditRenewals(
  env: BillingEnvironment
): Promise<void> {
  await initializeBillingSchema(env);
  const result = await env.DB.prepare(
    `SELECT owner_email FROM billing_accounts
     WHERE billing_cycle = 'annual' AND status IN ('active', 'trialing')
       AND next_credit_renewal_at IS NOT NULL AND next_credit_renewal_at <= ?
     LIMIT 500`
  )
    .bind(new Date().toISOString())
    .all<{ owner_email: string }>();
  for (const row of result.results) {
    await applyDueAnnualCreditRenewals(env, row.owner_email);
  }
}
