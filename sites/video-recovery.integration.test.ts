import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import worker from "./server";
import { inspectMediaProvenanceMarker } from "./media-provenance";

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
  execute() {
    const result = sqlite.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes) } };
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
      const result = statements.map(s => s.execute());
      sqlite.exec("COMMIT");
      return result;
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  },
};
const objects = new Map<
  string,
  { bytes: Uint8Array; etag: string; httpMetadata?: unknown }
>();
let etag = 0;
const BUCKET = {
  async get(key: string) {
    const value = objects.get(key);
    if (!value) return null;
    return {
      ...value,
      size: value.bytes.length,
      body: new Response(value.bytes).body,
      arrayBuffer: async () => value.bytes.slice().buffer,
    };
  },
  async put(
    key: string,
    value: Uint8Array,
    options?: { httpMetadata?: unknown }
  ) {
    if (value instanceof ReadableStream)
      throw new TypeError("Provided readable stream must have a known length");
    objects.set(key, {
      bytes: new Uint8Array(value),
      etag: String(++etag),
      ...options,
    });
    return { size: value.length };
  },
  async delete(key: string) {
    objects.delete(key);
  },
  async createMultipartUpload(
    key: string,
    options?: { httpMetadata?: unknown }
  ) {
    const parts: Uint8Array[] = [];
    return {
      uploadId: `upload-${++etag}`,
      async uploadPart(partNumber: number, part: Uint8Array) {
        parts[partNumber - 1] = part;
        return { partNumber, etag: String(partNumber) };
      },
      async complete() {
        const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
        let at = 0;
        for (const part of parts) {
          bytes.set(part, at);
          at += part.length;
        }
        objects.set(key, { bytes, etag: String(++etag), ...options });
        return { size: bytes.length };
      },
      async abort() {},
    };
  },
};
const env = {
  DB,
  BUCKET,
  SUPABASE_URL: "https://auth.example",
  SUPABASE_PUBLISHABLE_KEY: "test-only",
  OPENROUTER_API_KEY: "test-only-provider-key",
  AI_PROVENANCE_SIGNING_KEY: "test-only-video-recovery-signing-key",
  ASSETS: { fetch: () => new Response("static") },
};
const providerBytes = new Uint8Array(9137).map((_, i) => i % 251);
const providerStates = new Map<string, string>();
const providerCalls: { url: string; method: string }[] = [];
const providerResponses = new Map<
  string,
  Array<Promise<Response> | Response>
>();
async function request(
  path: string,
  options: {
    owner?: string;
    method?: string;
    brand?: string;
    anonymous?: boolean;
  } = {}
) {
  return worker.fetch(
    new Request(`https://studio.example${path}`, {
      method: options.method || "GET",
      headers: {
        ...(options.anonymous
          ? {}
          : {
              Authorization: `Bearer ${options.owner || "owner@example.com"}`,
            }),
        "X-Reelassati-Brand": options.brand || "default",
        "Content-Type": "application/json",
      },
    }),
    env as never
  );
}
function failedJob(
  id: string,
  code = "output_marking_or_storage_failure",
  brand = "default"
) {
  const now = new Date().toISOString();
  const invocationId = `invocation-${id}`;
  const payload = {
    invocationId,
    rightsConfirmed: true,
    model: "kwaivgi/kling-v3.0-std",
    assetName: "Recovered launch.mp4",
    creditReservation: {
      id: `credit-${id}`,
      operationKey: `video:${id}`,
      cost: 25,
    },
  };
  sqlite
    .prepare(
      `INSERT INTO generation_jobs(id,owner_email,provider_job_id,prompt,status,progress,error,payload,created_at,updated_at,brand_id) VALUES(?,'owner@example.com',?,'A product launch','failed',100,'The generated output could not be marked and verified',?,?,?,?)`
    )
    .run(id, `provider-${id}`, JSON.stringify(payload), now, now, brand);
  sqlite
    .prepare(
      `INSERT INTO ai_invocations(id,owner_email,purpose,provider,model,policy_version,input_sha256,status,error_code,created_at,completed_at) VALUES(?,'owner@example.com','video-generation','OpenRouter','kwaivgi/kling-v3.0-std','test','test','failed',?,?,?)`
    )
    .run(invocationId, code, now, now);
  sqlite
    .prepare(
      `INSERT INTO credit_ledger(id,owner_email,operation_key,category,description,amount,included_amount,topup_amount,status,created_at,settled_at) VALUES(?,'owner@example.com',?,'video','Video generation',-25,-25,0,'released',?,?)`
    )
    .run(`credit-${id}`, `video:${id}`, now, now);
  providerStates.set(`provider-${id}`, "completed");
}
beforeAll(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://auth.example/"))
        return Response.json({
          email: new Headers(init?.headers)
            .get("Authorization")
            ?.replace("Bearer ", ""),
        });
      providerCalls.push({ url, method: init?.method || "GET" });
      const queued =
        providerResponses.get(url.split("/").slice(-2).join("/"))?.shift() ||
        providerResponses.get(url.split("/").at(-1)!)?.shift();
      if (queued) return queued;
      if (url.endsWith("/content"))
        return new Response(
          new ReadableStream({
            start(c) {
              for (let i = 0; i < providerBytes.length; i += 71)
                c.enqueue(providerBytes.slice(i, i + 71));
              c.close();
            },
          }),
          { headers: { "Content-Type": "video/mp4" } }
        );
      return Response.json({
        status: providerStates.get(url.split("/").at(-1)!) || "failed",
      });
    })
  );
  await request("/api/billing/summary");
  sqlite
    .prepare(
      "UPDATE credit_accounts SET included_balance = 985 WHERE owner_email = 'owner@example.com'"
    )
    .run();
});
afterAll(() => {
  sqlite.close();
  vi.unstubAllGlobals();
});

describe("authenticated recovery of existing generated videos", () => {
  it("enforces sign-in, ownership and the active brand before contacting the provider", async () => {
    failedJob("private-video");
    failedJob(
      "brand-video",
      "output_marking_or_storage_failure",
      "other-brand"
    );
    const calls = providerCalls.length;
    expect(
      (
        await request("/api/video/jobs/private-video/recover", {
          method: "POST",
          anonymous: true,
        })
      ).status
    ).toBe(401);
    expect(
      (
        await request("/api/video/jobs/private-video/recover", {
          method: "POST",
          owner: "stranger@example.com",
        })
      ).status
    ).toBe(404);
    expect(
      (await request("/api/video/jobs/brand-video/recover", { method: "POST" }))
        .status
    ).toBe(404);
    expect(providerCalls).toHaveLength(calls);
  });
  it("does not bypass a provider rejection or an existing failed provenance record", async () => {
    failedJob("rejected-video", "provider_failed");
    failedJob("failed-proof");
    const now = new Date().toISOString();
    sqlite
      .prepare(
        `INSERT INTO ai_provenance_records(id,public_token,owner_email,entity_type,entity_id,origin,operation,provider,model,policy_version,signing_key_id,marking_method,marking_status,content_sha256,metadata_json,created_at) VALUES('failed-proof-record','proof-token','owner@example.com','asset','video-failed-proof','ai-generated','video-generation','OpenRouter','test','test','test','test','failed','test','{}',?)`
      )
      .run(now);
    const calls = providerCalls.length;
    expect(
      (
        await request("/api/video/jobs/rejected-video/recover", {
          method: "POST",
        })
      ).status
    ).toBe(409);
    expect(
      (
        await request("/api/video/jobs/failed-proof/recover", {
          method: "POST",
        })
      ).status
    ).toBe(409);
    expect(providerCalls).toHaveLength(calls);
    expect(
      sqlite
        .prepare(
          "SELECT marking_status FROM ai_provenance_records WHERE id='failed-proof-record'"
        )
        .get()
    ).toMatchObject({ marking_status: "failed" });
  });
  it("requires a completed provider output and leaves an expired job unchanged", async () => {
    failedJob("expired-video");
    providerStates.set("provider-expired-video", "expired");
    expect(
      (
        await request("/api/video/jobs/expired-video/recover", {
          method: "POST",
        })
      ).status
    ).toBe(409);
    expect(
      sqlite
        .prepare("SELECT status FROM generation_jobs WHERE id='expired-video'")
        .get()
    ).toMatchObject({ status: "failed" });
    expect(
      sqlite
        .prepare(
          "SELECT status FROM credit_ledger WHERE id='credit-expired-video'"
        )
        .get()
    ).toMatchObject({ status: "released" });
  });
  it("recovers to Library with full signed marking and no new generation or debit, then returns the same saved asset", async () => {
    failedJob("recover-video");
    const current = await request("/api/video/jobs/recover-video");
    expect(
      ((await current.json()) as { job: { canRecover: boolean } }).job
        .canRecover
    ).toBe(true);
    const before = sqlite
      .prepare(
        "SELECT included_balance,topup_balance FROM credit_accounts WHERE owner_email='owner@example.com'"
      )
      .get();
    const response = await request("/api/video/jobs/recover-video/recover", {
      method: "POST",
    });
    expect(response.status).toBe(200);
    const recovered = (await response.json()) as {
      job: { status: string; canRecover: boolean };
      asset: {
        id: string;
        name: string;
        provenance: { marking: { status: string } };
      };
    };
    expect(recovered.job).toMatchObject({
      status: "completed",
      canRecover: false,
    });
    expect(recovered.asset).toMatchObject({
      id: "video-recover-video",
      name: "Recovered launch.mp4",
      provenance: { marking: { status: "verified" } },
    });
    expect(
      sqlite
        .prepare(
          "SELECT included_balance,topup_balance FROM credit_accounts WHERE owner_email='owner@example.com'"
        )
        .get()
    ).toEqual(before);
    expect(
      sqlite
        .prepare(
          "SELECT status FROM credit_ledger WHERE id='credit-recover-video'"
        )
        .get()
    ).toMatchObject({ status: "released" });
    expect(
      sqlite
        .prepare(
          "SELECT status,error_code FROM ai_invocations WHERE id='invocation-recover-video'"
        )
        .get()
    ).toMatchObject({ status: "completed", error_code: null });
    const key = "users/owner%40example.com/generated/video-recover-video.mp4";
    const media = objects.get(key)!.bytes;
    expect(
      inspectMediaProvenanceMarker(media.slice().buffer)?.unmarkedBytes
    ).toEqual(providerBytes.buffer);
    expect(objects.has(`${key}.source`)).toBe(false);
    const calls = providerCalls.length;
    const again = await request("/api/video/jobs/recover-video/recover", {
      method: "POST",
    });
    expect(((await again.json()) as { asset: { id: string } }).asset.id).toBe(
      recovered.asset.id
    );
    expect(providerCalls).toHaveLength(calls);
    expect(providerCalls.every(call => call.method === "GET")).toBe(true);
    expect(
      providerCalls.filter(call =>
        call.url.endsWith("provider-recover-video/content")
      )
    ).toHaveLength(1);
  });
  it("deduplicates concurrent recovery requests into one saved provider output", async () => {
    failedJob("concurrent-video");
    const responses = await Promise.all([
      request("/api/video/jobs/concurrent-video/recover", { method: "POST" }),
      request("/api/video/jobs/concurrent-video/recover", { method: "POST" }),
    ]);
    expect(responses.every(response => response.ok)).toBe(true);
    expect(
      providerCalls.filter(call =>
        call.url.endsWith("provider-concurrent-video/content")
      )
    ).toHaveLength(1);
    expect(
      sqlite
        .prepare(
          "SELECT status,result_asset_id FROM generation_jobs WHERE id='concurrent-video'"
        )
        .get()
    ).toMatchObject({
      status: "completed",
      result_asset_id: "video-concurrent-video",
    });
  });
  it.each(["in_progress", "failed"])(
    "does not let an old %s provider poll overwrite a completed video",
    async staleStatus => {
      const id = `stale-${staleStatus}`;
      failedJob(id);
      sqlite
        .prepare(
          "UPDATE generation_jobs SET status='in_progress',error=NULL WHERE id=?"
        )
        .run(id);
      sqlite
        .prepare(
          "UPDATE ai_invocations SET status='in_progress',error_code=NULL WHERE id=?"
        )
        .run(`invocation-${id}`);
      let release!: (response: Response) => void;
      let reached!: () => void;
      const reachedProvider = new Promise<void>(resolve => {
        reached = resolve;
      });
      const blocked = new Promise<Response>(resolve => {
        release = resolve;
      });
      providerResponses.set(`provider-${id}`, [blocked]);
      const fetchMock = vi.mocked(fetch);
      const original = fetchMock.getMockImplementation()!;
      fetchMock.mockImplementation(async (input, init) => {
        const result = original(input, init);
        if (String(input).endsWith(`provider-${id}`)) reached();
        return result;
      });
      const stale = request(`/api/video/jobs/${id}`);
      await reachedProvider;
      fetchMock.mockImplementation(original);
      const completed = await request(`/api/video/jobs/${id}`);
      expect(completed.status).toBe(200);
      release(Response.json({ status: staleStatus }));
      await stale;
      expect(
        sqlite
          .prepare(
            "SELECT status,result_asset_id FROM generation_jobs WHERE id=?"
          )
          .get(id)
      ).toMatchObject({ status: "completed", result_asset_id: `video-${id}` });
    }
  );
  it("cleans up an interrupted recovery download and permits a later retry without a new debit", async () => {
    failedJob("interrupted-video");
    providerResponses.set("provider-interrupted-video/content", [
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(providerBytes.slice(0, 50));
            controller.error(new Error("Interrupted test download"));
          },
        })
      ),
    ]);
    const before = sqlite
      .prepare(
        "SELECT included_balance,topup_balance FROM credit_accounts WHERE owner_email='owner@example.com'"
      )
      .get();
    const failed = await request("/api/video/jobs/interrupted-video/recover", {
      method: "POST",
    });
    expect(failed.status).toBeGreaterThanOrEqual(500);
    expect(
      [...objects.keys()].some(key => key.includes("video-interrupted-video"))
    ).toBe(false);
    expect(
      sqlite
        .prepare(
          "SELECT status FROM generation_jobs WHERE id='interrupted-video'"
        )
        .get()
    ).toMatchObject({ status: "failed" });
    expect(
      sqlite
        .prepare(
          "SELECT status,error_code FROM ai_invocations WHERE id='invocation-interrupted-video'"
        )
        .get()
    ).toMatchObject({
      status: "failed",
      error_code: "video_store_source_failure",
    });
    const refreshed = await request("/api/video/jobs/interrupted-video");
    expect(
      ((await refreshed.json()) as { job: { canRecover: boolean } }).job
        .canRecover
    ).toBe(true);
    const recovered = await request(
      "/api/video/jobs/interrupted-video/recover",
      { method: "POST" }
    );
    expect(recovered.status).toBe(200);
    expect(
      sqlite
        .prepare(
          "SELECT included_balance,topup_balance FROM credit_accounts WHERE owner_email='owner@example.com'"
        )
        .get()
    ).toEqual(before);
  });
});
