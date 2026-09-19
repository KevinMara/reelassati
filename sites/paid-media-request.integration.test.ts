import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import worker from "./server";
import { imageCreditCost, speechCreditCost } from "../contracts/billing";

const sqlite = new DatabaseSync(":memory:");
let failFinalCacheWrite = false;
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
  execute() {
    if (
      failFinalCacheWrite &&
      /UPDATE paid_media_requests SET status='completed'/i.test(this.sql)
    ) {
      failFinalCacheWrite = false;
      throw new Error("Simulated final response cache failure");
    }
    return {
      success: true,
      meta: {
        changes: Number(sqlite.prepare(this.sql).run(...this.values).changes),
      },
    };
  }
  async run() {
    return this.execute();
  }
}
const DB = {
  prepare: (sql: string) => new Statement(sql),
  async batch(statements: Statement[]) {
    sqlite.exec("BEGIN");
    try {
      const result = statements.map(statement => statement.execute());
      sqlite.exec("COMMIT");
      return result;
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  },
};
const objects = new Map<string, Uint8Array>();
const env = {
  DB,
  BUCKET: {
    async get(key: string) {
      const bytes = objects.get(key);
      return bytes
        ? {
            size: bytes.length,
            etag: "etag",
            body: new Response(new Uint8Array(bytes).buffer).body,
            arrayBuffer: async () => bytes.slice().buffer,
          }
        : null;
    },
    async put(key: string, value: ArrayBuffer | Uint8Array) {
      objects.set(
        key,
        new Uint8Array(value instanceof Uint8Array ? value : value)
      );
    },
    async delete(key: string) {
      objects.delete(key);
    },
  },
  SUPABASE_URL: "https://auth.example",
  SUPABASE_PUBLISHABLE_KEY: "test-only",
  OPENROUTER_API_KEY: "test-only",
  AI_CREDIT_ACCESS_EMAIL: "owner@example.com",
  AI_PROVENANCE_SIGNING_KEY: "test-provenance-key-at-least-32-characters",
  ASSETS: { fetch: () => new Response("static") },
};
let providerCalls = 0;
let providerGate: Promise<void> | undefined;
let providerFailure = false;
async function request(
  path: string,
  body?: unknown,
  owner = "owner@example.com"
) {
  return worker.fetch(
    new Request(`https://studio.example${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${owner}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    env as never
  );
}
const balance = () =>
  Number(
    sqlite
      .prepare(
        "SELECT included_balance + topup_balance AS balance FROM credit_accounts WHERE owner_email='owner@example.com'"
      )
      .get()?.balance
  );
const payload = (kind: "image" | "speech", requestId?: string) => ({
  ...(requestId ? { requestId } : {}),
  assetName: `Fixture ${kind}`,
  rightsConfirmed: true,
  ...(kind === "image"
    ? {
        prompt: "An original abstract landscape",
        aspectRatio: "1:1",
        resolution: "1K",
        referenceContainsRealPerson: false,
        realPersonConsentConfirmed: false,
      }
    : { text: "A short original narration.", voice: "English_Graceful_Lady" }),
});
const cost = (kind: "image" | "speech") =>
  kind === "image"
    ? imageCreditCost("1K")
    : speechCreditCost("A short original narration.".length);

beforeAll(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, init) => {
      const url = String(input);
      if (url.startsWith("https://auth.example"))
        return Response.json({
          email: new Headers(init?.headers)
            .get("Authorization")
            ?.replace("Bearer ", ""),
        });
      providerCalls++;
      if (providerGate) await providerGate;
      if (providerFailure)
        return Response.json(
          { error: { message: "Provider unavailable" } },
          { status: 503 }
        );
      if (url.endsWith("/images"))
        return Response.json({
          data: [
            {
              b64_json:
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC",
            },
          ],
        });
      if (url.endsWith("/audio/speech"))
        return new Response(
          new Uint8Array([0xff, 0xfb, 0x90, 0x64, 1, 2, 3, 4]),
          { headers: { "Content-Type": "audio/mpeg" } }
        );
      throw new Error(`Unexpected provider URL: ${url}`);
    })
  );
  await request("/api/billing/summary");
  sqlite
    .prepare(
      "UPDATE credit_accounts SET included_balance=10000 WHERE owner_email='owner@example.com'"
    )
    .run();
});
afterAll(() => {
  sqlite.close();
  vi.unstubAllGlobals();
});

describe("durable paid media request IDs on the actual worker", () => {
  it.each(["image", "speech"] as const)(
    "replays %s exactly with one provider call, one debit and payload collision rejection",
    async kind => {
      const before = balance();
      const calls = providerCalls;
      const body = payload(kind, `repeat-${kind}-0123456789`);
      const first = await request(`/api/ai/${kind}`, body);
      expect(first.status).toBe(201);
      const result = await first.json();
      expect(balance()).toBe(before - cost(kind));
      const reversed = Object.fromEntries(Object.entries(body).reverse());
      const second = await request(`/api/ai/${kind}`, reversed);
      expect(second.status).toBe(201);
      expect(await second.json()).toEqual(result);
      expect(providerCalls).toBe(calls + 1);
      expect(balance()).toBe(before - cost(kind));
      const collision = await request(`/api/ai/${kind}`, {
        ...body,
        ...(kind === "image"
          ? { prompt: "Different image" }
          : { text: "Different narration" }),
      });
      expect(collision.status).toBe(409);
      expect(providerCalls).toBe(calls + 1);
      expect(balance()).toBe(before - cost(kind));
    }
  );
  it.each(["image", "speech"] as const)(
    "rejects a concurrent %s purchase for the same action",
    async kind => {
      let release!: () => void;
      providerGate = new Promise<void>(resolve => {
        release = resolve;
      });
      const calls = providerCalls;
      const before = balance();
      const body = payload(kind, `concurrent-${kind}-0123456789`);
      const first = request(`/api/ai/${kind}`, body);
      await vi.waitFor(() => expect(providerCalls).toBe(calls + 1));
      const duplicate = await request(`/api/ai/${kind}`, body);
      expect(duplicate.status).toBe(409);
      expect(await duplicate.json()).toMatchObject({ requestInProgress: true });
      release();
      providerGate = undefined;
      expect((await first).status).toBe(201);
      expect(providerCalls).toBe(calls + 1);
      expect(balance()).toBe(before - cost(kind));
    }
  );
  it.each(["image", "speech"] as const)(
    "recovers a prepared %s response after final cache-write failure without buying it again",
    async kind => {
      const calls = providerCalls;
      const before = balance();
      failFinalCacheWrite = true;
      const body = payload(kind, `recover-${kind}-0123456789`);
      expect((await request(`/api/ai/${kind}`, body)).status).toBe(500);
      expect(balance()).toBe(before - cost(kind));
      const recovered = await request(`/api/ai/${kind}`, body);
      expect(recovered.status).toBe(201);
      const result = (await recovered.json()) as { asset: { id: string } };
      expect(result.asset.id).toBeTruthy();
      expect(providerCalls).toBe(calls + 1);
      expect(balance()).toBe(before - cost(kind));
    }
  );
  it("does not replay a failed provider request automatically or retain its credit debit", async () => {
    const calls = providerCalls;
    const before = balance();
    providerFailure = true;
    const body = payload("speech", "failed-speech-0123456789");
    const failed = await request("/api/ai/speech", body);
    expect(failed.status).toBeGreaterThanOrEqual(400);
    providerFailure = false;
    const retry = await request("/api/ai/speech", body);
    expect(retry.status).toBe(failed.status);
    expect(providerCalls).toBe(calls + 1);
    expect(balance()).toBe(before);
  });
  it("isolates owners and routes while preserving legacy calls without IDs", async () => {
    const calls = providerCalls;
    const before = balance();
    const shared = "shared-action-0123456789";
    const image = await request("/api/ai/image", payload("image", shared));
    expect(image.status).toBe(201);
    const speech = await request("/api/ai/speech", payload("speech", shared));
    expect(speech.status).toBe(201);
    const foreign = await request(
      "/api/ai/image",
      payload("image", shared),
      "stranger@example.com"
    );
    expect(foreign.status).toBe(503);
    expect(await foreign.json()).not.toHaveProperty("asset");
    for (const kind of ["image", "speech"] as const) {
      const first = await request(`/api/ai/${kind}`, payload(kind));
      const second = await request(`/api/ai/${kind}`, payload(kind));
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(
        ((await first.json()) as { asset: { id: string } }).asset.id
      ).not.toBe(((await second.json()) as { asset: { id: string } }).asset.id);
    }
    expect(providerCalls).toBe(calls + 6);
    expect(balance()).toBe(before - 3 * cost("image") - 3 * cost("speech"));
  });
  it("rejects invalid optional IDs before buying generation", async () => {
    const calls = providerCalls;
    const before = balance();
    expect(
      (
        await request("/api/ai/image", {
          ...payload("image"),
          requestId: "bad",
        })
      ).status
    ).toBe(422);
    expect(providerCalls).toBe(calls);
    expect(balance()).toBe(before);
  });
});
