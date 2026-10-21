import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  reconcileAnalyzerCredits,
  cancelAnalyzerCredits,
  analyzerOperationKey,
} from "./analyzer-credit-recovery";

let sqlite: DatabaseSync;
let failBatch = false;
class Statement {
  values: unknown[] = [];
  constructor(readonly sql: string) {}
  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }
  run() {
    return sqlite
      .prepare(this.sql)
      .run(...(this.values as Array<string | number | null>));
  }
}
const DB = {
  prepare: (sql: string) => new Statement(sql),
  async batch(statements: Statement[]) {
    sqlite.exec("BEGIN");
    try {
      const rows = statements.map((statement, index) => {
        if (failBatch && index === 1) throw new Error("DB failure");
        return statement.run();
      });
      sqlite.exec("COMMIT");
      return rows;
    } catch (cause) {
      sqlite.exec("ROLLBACK");
      throw cause;
    }
  },
};
const ledger = "b3c01a9a-f46e-4614-a577-768b22d192b1";
const invocation = "8e3f3eb6-1d85-4fc7-b38d-30b5cdb93099";
const now = Date.parse("2026-10-21T16:00:00Z");
beforeEach(() => {
  failBatch = false;
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE credit_accounts (owner_email TEXT PRIMARY KEY, included_balance INTEGER, topup_balance INTEGER, updated_at TEXT);
    CREATE TABLE credit_ledger (id TEXT PRIMARY KEY, owner_email TEXT, amount INTEGER, included_amount INTEGER, topup_amount INTEGER,
      category TEXT, status TEXT, operation_key TEXT UNIQUE, reference_id TEXT, description TEXT DEFAULT 'Video analysis', metadata_json TEXT, applied INTEGER, created_at TEXT, settled_at TEXT);
    CREATE TABLE ai_invocations (id TEXT PRIMARY KEY, owner_email TEXT, purpose TEXT, provider TEXT, model TEXT, created_at TEXT,
      input_sha256 TEXT, status TEXT, output_sha256 TEXT, error_code TEXT, completed_at TEXT);
    INSERT INTO credit_accounts VALUES ('owner', 0, 791, 'before');`);
  sqlite
    .prepare(
      "INSERT INTO credit_ledger VALUES (?, 'owner', -10, 0, -10, 'analysis', 'reserved', 'video-analysis:0a604089-8ba1-4d53-adf4-438a1985e96b', '3fdf0598-7da5-4d71-9d32-02371f3c87c9', 'Video analysis', '{}', 1, '2026-10-21T14:30:39.884Z', NULL)"
    )
    .run(ledger);
  sqlite
    .prepare(
      "INSERT INTO ai_invocations VALUES (?, 'owner', 'video-analysis', 'OpenRouter', 'moonshotai/kimi-k3', '2026-10-21T14:30:40.336Z', 'de4286a062869efdb92724d1ccb04539203dc576ddbd570e740240844d84dc62', 'in_progress', NULL, NULL, NULL)"
    )
    .run(invocation);
});
afterEach(() => sqlite.close());
const balance = () =>
  sqlite
    .prepare(
      "SELECT included_balance, topup_balance FROM credit_accounts WHERE owner_email='owner'"
    )
    .get();
const entry = () =>
  sqlite
    .prepare("SELECT status, metadata_json FROM credit_ledger WHERE id=?")
    .get(ledger);
describe("authorized canceled analyzer credit repair", () => {
  it("keeps explicit cancellation scoped to the owner and brand and releases it exactly once", async () => {
    const key = analyzerOperationKey("owner", "brand", "request-0123456789");
    sqlite
      .prepare(
        "INSERT INTO credit_ledger VALUES ('modern', 'owner', -10, 0, -10, 'analysis', 'reserved', ?, 'source', 'Video analysis', ?, 1, 'now', NULL)"
      )
      .run(key, JSON.stringify({ analyzerTransport: "foreground-v1" }));
    await cancelAnalyzerCredits(
      DB,
      "someone-else",
      "brand",
      "request-0123456789"
    );
    await cancelAnalyzerCredits(
      DB,
      "owner",
      "another-brand",
      "request-0123456789"
    );
    expect(balance()).toEqual({ included_balance: 0, topup_balance: 791 });
    await cancelAnalyzerCredits(DB, "owner", "brand", "request-0123456789");
    await cancelAnalyzerCredits(DB, "owner", "brand", "request-0123456789");
    expect(balance()).toEqual({ included_balance: 0, topup_balance: 801 });
    expect(
      sqlite.prepare("SELECT status FROM credit_ledger WHERE id='modern'").get()
    ).toMatchObject({ status: "released" });
    expect(entry()).toMatchObject({ status: "reserved" });
  });
  it("records a zero-value cancellation before reservation, without adding credits", async () => {
    await cancelAnalyzerCredits(DB, "owner", "default", "early-0123456789");
    const key = analyzerOperationKey("owner", "default", "early-0123456789");
    expect(
      sqlite
        .prepare(
          "SELECT amount,status,applied FROM credit_ledger WHERE operation_key=?"
        )
        .get(key)
    ).toMatchObject({ amount: 0, status: "released", applied: 0 });
    expect(balance()).toEqual({ included_balance: 0, topup_balance: 791 });
  });
  it("restores exactly ten top-up credits once across repeated and concurrent reads", async () => {
    await Promise.all([
      reconcileAnalyzerCredits(DB, "owner", now),
      reconcileAnalyzerCredits(DB, "owner", now),
    ]);
    await reconcileAnalyzerCredits(DB, "owner", now);
    expect(balance()).toEqual({ included_balance: 0, topup_balance: 801 });
    expect(entry()).toMatchObject({ status: "released" });
    expect(
      sqlite
        .prepare("SELECT status,error_code FROM ai_invocations WHERE id=?")
        .get(invocation)
    ).toMatchObject({
      status: "failed",
      error_code: "analysis_request_canceled_reconciled",
    });
  });
  it.each([
    "UPDATE credit_ledger SET status='settled'",
    "UPDATE credit_ledger SET status='released'",
    "UPDATE credit_ledger SET amount=-20,topup_amount=-20",
    "UPDATE credit_ledger SET reference_id='another-asset'",
    "UPDATE credit_ledger SET operation_key='another-operation'",
    "UPDATE credit_ledger SET included_amount=-10,topup_amount=0",
    "UPDATE ai_invocations SET model='another-model'",
    "UPDATE ai_invocations SET status='completed',output_sha256='valid-output'",
    "UPDATE ai_invocations SET created_at='another-time'",
    "UPDATE ai_invocations SET owner_email='another-owner'",
  ])("does not release a nonmatching incident: %s", async sql => {
    sqlite.exec(sql);
    await reconcileAnalyzerCredits(DB, "owner", now);
    expect(balance()).toEqual({ included_balance: 0, topup_balance: 791 });
  });
  it("does not let a different authenticated owner trigger the repair", async () => {
    await reconcileAnalyzerCredits(DB, "another-owner", now);
    expect(balance()).toEqual({ included_balance: 0, topup_balance: 791 });
    expect(entry()).toMatchObject({ status: "reserved" });
  });
  it("rolls the balance restoration back if releasing its ledger hold fails", async () => {
    failBatch = true;
    await expect(reconcileAnalyzerCredits(DB, "owner", now)).rejects.toThrow(
      "DB failure"
    );
    expect(balance()).toEqual({ included_balance: 0, topup_balance: 791 });
    expect(entry()).toMatchObject({ status: "reserved" });
  });
  it("releases only expired, tagged foreground holds to their original buckets, without touching ordinary holds", async () => {
    sqlite.exec(
      "UPDATE ai_invocations SET model='unrelated'; UPDATE credit_accounts SET included_balance=40;"
    );
    const insert = sqlite.prepare(
      "INSERT INTO credit_ledger VALUES (?, 'owner', -10, -7, -3, 'analysis', 'reserved', ?, 'source', 'Video analysis', ?, 1, 'old', NULL)"
    );
    insert.run(
      "expired",
      "expired",
      JSON.stringify({
        analyzerTransport: "foreground-v1",
        analyzerDeadlineAt: now - 40_000,
        analysisInvocationId: "expired-model",
      })
    );
    insert.run(
      "active",
      "active",
      JSON.stringify({
        analyzerTransport: "foreground-v1",
        analyzerDeadlineAt: now + 1,
      })
    );
    insert.run(
      "grace",
      "grace",
      JSON.stringify({
        analyzerTransport: "foreground-v1",
        analyzerDeadlineAt: now - 10_000,
      })
    );
    insert.run("legacy", "legacy", "{}");
    insert.run("bad-metadata", "bad-metadata", "not-json");
    sqlite.exec(
      "INSERT INTO ai_invocations (id,owner_email,purpose,status) VALUES ('expired-model','owner','video-analysis','in_progress')"
    );
    await reconcileAnalyzerCredits(DB, "owner", now);
    await reconcileAnalyzerCredits(DB, "owner", now);
    expect(balance()).toEqual({ included_balance: 47, topup_balance: 794 });
    expect(
      sqlite
        .prepare(
          "SELECT id,status FROM credit_ledger WHERE id != ? ORDER BY id"
        )
        .all(ledger)
    ).toEqual([
      { id: "active", status: "reserved" },
      { id: "bad-metadata", status: "reserved" },
      { id: "expired", status: "released" },
      { id: "grace", status: "reserved" },
      { id: "legacy", status: "reserved" },
    ]);
    expect(
      sqlite
        .prepare(
          "SELECT status,error_code FROM ai_invocations WHERE id='expired-model'"
        )
        .get()
    ).toMatchObject({
      status: "failed",
      error_code: "analysis_request_expired",
    });
  });
});
