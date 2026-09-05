import { DatabaseSync } from "node:sqlite";
import { createHmac } from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import {
  handleStripeWebhook,
  initializeBillingSchema,
  billingSummary,
  type BillingEnvironment,
} from "./billing";

const sqlite = new DatabaseSync(":memory:");
class Statement {
  values: (string | number | null)[] = [];
  constructor(private sql: string) {}
  bind(...values: unknown[]) {
    this.values = values as (string | number | null)[];
    return this;
  }
  async first<T>() {
    return (sqlite.prepare(this.sql).get(...this.values) || null) as T | null;
  }
  async all<T>() {
    return {
      results: sqlite.prepare(this.sql).all(...this.values) as T[],
      success: true,
    };
  }
  async run() {
    const result = sqlite.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}
const env: BillingEnvironment = {
  DB: {
    prepare: sql => new Statement(sql),
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const result = [];
        for (const statement of statements) result.push(await statement.run());
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  },
  STRIPE_WEBHOOK_SECRET: "whsec_test_only",
  STRIPE_PRICE_IDS_JSON: JSON.stringify({
    plans: { creator: { monthly: "price_creator", annual: "price_annual" } },
  }),
};
const owner = "owner@example.com";
const start = new Date();
start.setUTCDate(1);
start.setUTCHours(0, 0, 0, 0);
const end = new Date(start);
end.setUTCMonth(end.getUTCMonth() + 1);
async function webhook(
  id: string,
  type: string,
  object: Record<string, unknown>
) {
  const body = JSON.stringify({ id, type, data: { object } });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", env.STRIPE_WEBHOOK_SECRET!)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return handleStripeWebhook(
    new Request("https://example.com/api/billing/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
      body,
    }),
    env
  );
}
function account() {
  return sqlite
    .prepare("SELECT * FROM billing_accounts WHERE owner_email = ?")
    .get(owner)!;
}
function credits() {
  return sqlite
    .prepare("SELECT * FROM credit_accounts WHERE owner_email = ?")
    .get(owner)!;
}
beforeAll(async () => {
  await initializeBillingSchema(env);
});
beforeEach(() => {
  sqlite.exec(
    "DELETE FROM billing_accounts; DELETE FROM credit_accounts; DELETE FROM credit_ledger; DELETE FROM stripe_events;"
  );
  sqlite
    .prepare(
      `INSERT INTO billing_accounts (owner_email,stripe_customer_id,stripe_subscription_id,plan_id,billing_cycle,status,current_period_start,current_period_end,next_credit_renewal_at,cancel_at_period_end,created_at,updated_at) VALUES (?, 'cus_owner','sub_owner','creator','monthly','active',?,?,?,1,?,?)`
    )
    .run(
      owner,
      start.toISOString(),
      end.toISOString(),
      end.toISOString(),
      start.toISOString(),
      start.toISOString()
    );
  sqlite
    .prepare("INSERT INTO credit_accounts VALUES (?, 700, 0, ?, ?)")
    .run(owner, start.toISOString(), start.toISOString());
});
afterAll(() => sqlite.close());
describe("Stripe entitlement integrity with actual SQLite", () => {
  it("grants one top-up across retries without deactivating or uncancelling the plan", async () => {
    const object = {
      id: "cs_topup",
      customer: "cus_owner",
      payment_status: "paid",
      metadata: {
        owner_email: owner,
        purchase_kind: "topup",
        topup_id: "boost",
      },
    };
    expect(
      (await webhook("evt_topup", "checkout.session.completed", object)).status
    ).toBe(200);
    expect(
      (
        await webhook(
          "evt_retry",
          "checkout.session.async_payment_succeeded",
          object
        )
      ).status
    ).toBe(200);
    expect(account().status).toBe("active");
    expect(account().cancel_at_period_end).toBe(1);
    expect(credits().included_balance).toBe(700);
    expect(credits().topup_balance).toBe(500);
  });
  it("does not downgrade an activated plan when Checkout arrives later", async () => {
    await webhook("evt_checkout", "checkout.session.completed", {
      id: "cs_plan",
      customer: "cus_owner",
      subscription: "sub_owner",
      metadata: {
        owner_email: owner,
        plan_id: "creator",
        billing_cycle: "monthly",
      },
    });
    expect(account().status).toBe("active");
    expect(credits().included_balance).toBe(700);
  });
  it("ignores paid and failed one-off invoices for subscription entitlements", async () => {
    await webhook("evt_oneoff", "invoice.paid", {
      id: "in_oneoff",
      customer: "cus_owner",
    });
    await webhook("evt_oneoff_failed", "invoice.payment_failed", {
      id: "in_oneoff_failed",
      customer: "cus_owner",
    });
    expect(account().status).toBe("active");
    expect(credits().included_balance).toBe(700);
  });
  it("reads nested subscription metadata even when invoice metadata is empty", async () => {
    sqlite.exec("DELETE FROM billing_accounts; DELETE FROM credit_accounts;");
    const response = await webhook("evt_invoice", "invoice.paid", {
      id: "in_plan",
      customer: "cus_owner",
      metadata: {},
      parent: {
        subscription_details: {
          subscription: "sub_owner",
          metadata: {
            owner_email: owner,
            plan_id: "creator",
            billing_cycle: "monthly",
          },
        },
      },
      lines: {
        data: [
          {
            price: { id: "price_creator" },
            period: {
              start: start.getTime() / 1000,
              end: end.getTime() / 1000,
            },
          },
        ],
      },
    });
    expect(response.status).toBe(200);
    expect(account().status).toBe("active");
    expect(credits().included_balance).toBe(1000);
  });
  it("preserves the advanced annual credit cursor during subscription updates", async () => {
    const renewal = new Date(start);
    renewal.setUTCMonth(renewal.getUTCMonth() + 4);
    sqlite
      .prepare(
        "UPDATE billing_accounts SET billing_cycle='annual', next_credit_renewal_at=?"
      )
      .run(renewal.toISOString());
    await webhook("evt_update", "customer.subscription.updated", {
      id: "sub_owner",
      customer: "cus_owner",
      status: "active",
      current_period_start: start.getTime() / 1000,
      current_period_end: end.getTime() / 1000,
      items: { data: [{ price: { id: "price_annual" } }] },
    });
    expect(account().next_credit_renewal_at).toBe(renewal.toISOString());
  });
  it("aggregates all completed usage, including more than 20 records, with zero empty data", async () => {
    const insert = sqlite.prepare(
      "INSERT INTO credit_ledger (id,owner_email,amount,category,status,operation_key,description,created_at) VALUES (?,?,?,?,?,?,?,?)"
    );
    for (let i = 0; i < 30; i++)
      insert.run(
        `usage${i}`,
        owner,
        -5,
        "script",
        "settled",
        `usage${i}`,
        "Script",
        new Date().toISOString()
      );
    for (const [id, email, status, category] of [
      ["other", "other@example.com", "settled", "video"],
      ["failed", owner, "released", "video"],
      ["pending", owner, "reserved", "video"],
      ["reset", owner, "settled", "subscription"],
    ])
      insert.run(
        id,
        email,
        -500,
        category,
        status,
        id,
        id,
        new Date().toISOString()
      );
    const summary = await billingSummary(env, { email: owner, name: "Owner" });
    expect(summary.usage?.daily).toEqual([
      {
        date: new Date().toISOString().slice(0, 10),
        category: "script",
        credits: 150,
      },
    ]);
    expect(summary.recentActivity).toHaveLength(20);
    const empty = await billingSummary(env, {
      email: "empty@example.com",
      name: "Empty",
    });
    expect(empty.usage?.daily).toEqual([]);
  });
});
