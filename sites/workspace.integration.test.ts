import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import worker from "./server";
import { createEmptyWorkspace } from "../contracts/workspace";

const sqlite = new DatabaseSync(":memory:");
class Statement {
  values: Array<string | number | null> = [];
  constructor(readonly sql: string) {}
  bind(...values: Array<string | number | null>) {
    this.values = values;
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
const DB = {
  prepare: (sql: string) => new Statement(sql),
  async batch(statements: Statement[]) {
    sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sqlite.exec("COMMIT");
      return results;
    } catch (e) {
      sqlite.exec("ROLLBACK");
      throw e;
    }
  },
};
const env = {
  DB,
  BUCKET: {},
  SUPABASE_URL: "https://auth.example",
  SUPABASE_PUBLISHABLE_KEY: "test",
  AI_PROVENANCE_SIGNING_KEY: "test-only-key",
  ASSETS: { fetch: () => new Response("static") },
};
async function request(
  path: string,
  brand = "default",
  method = "GET",
  body?: unknown,
  owner = "owner@example.com"
) {
  return worker.fetch(
    new Request(`https://studio.example${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${owner}`,
        "Content-Type": "application/json",
        "X-Reelassati-Brand": brand,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    env as never
  );
}
beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (_url, init) =>
        new Response(
          JSON.stringify({
            email: init.headers.Authorization.replace("Bearer ", ""),
          }),
          { headers: { "Content-Type": "application/json" } }
        )
    )
  );
});
afterAll(() => {
  sqlite.close();
  vi.unstubAllGlobals();
});

describe("real SQLite workspace separation", () => {
  it("preserves the original workspace while creating isolated brands and enforcing plan limits", async () => {
    expect((await request("/api/workspace")).status).toBe(200);
    // Billing initializes from the real schema before activating a test entitlement.
    await request("/api/billing/summary");
    sqlite
      .prepare(
        "INSERT INTO billing_accounts(owner_email, plan_id, billing_cycle, status, stripe_subscription_id, current_period_end, created_at, updated_at) VALUES (?, 'pro', 'monthly', 'active', 'sub_test', ?, ?, ?)"
      )
      .run(
        "owner@example.com",
        new Date(Date.now() + 86400000 * 30).toISOString(),
        new Date().toISOString(),
        new Date().toISOString()
      );
    const first = await request("/api/brands", "default", "POST", {
      name: "Brand A",
    });
    expect(first.status).toBe(201);
    const { id } = (await first.json()) as { id: string };
    const brand = await request("/api/workspace", id);
    expect(brand.status).toBe(200);
    const { workspace } = (await brand.json()) as {
      workspace: ReturnType<typeof createEmptyWorkspace>;
    };
    expect(workspace.brandKit.name).toBe("Brand A");
    workspace.brandKit.voice = "Brand A voice";
    expect(
      (await request("/api/workspace", id, "PUT", { workspace })).status
    ).toBe(200);
    const primary = (await (await request("/api/workspace")).json()) as {
      workspace: ReturnType<typeof createEmptyWorkspace>;
    };
    expect(primary.workspace.brandKit.voice).toBe("");
    expect(
      (
        await request(
          "/api/workspace",
          id,
          "GET",
          undefined,
          "other@example.com"
        )
      ).status
    ).toBe(404);
    expect(
      (await request("/api/brands", "default", "POST", { name: "Brand B" }))
        .status
    ).toBe(201);
    expect(
      (
        await request("/api/brands", "default", "POST", {
          name: "Over allowance",
        })
      ).status
    ).toBe(409);
    const now = new Date().toISOString();
    sqlite
      .prepare(
        "INSERT INTO assets(id,owner_email,brand_id,name,kind,content_type,bytes,r2_key,created_at) VALUES ('asset_a',?,?, 'A.mp4','video','video/mp4',1,'a',?)"
      )
      .run("owner@example.com", id, now);
    const scoped = (await (await request("/api/workspace", id)).json()) as {
      workspace: ReturnType<typeof createEmptyWorkspace>;
    };
    expect(scoped.workspace.assets.map(a => a.id)).toEqual(["asset_a"]);
    expect(scoped.workspace.assets[0].url).toMatch(
      /^\/api\/media\/asset_a\?expires=/
    );
    expect((await request("/api/assets/asset_a")).status).toBe(404);
    const defaultAfter = (await (await request("/api/workspace")).json()) as {
      workspace: ReturnType<typeof createEmptyWorkspace>;
    };
    expect(defaultAfter.workspace.assets).toEqual([]);
  });
});
