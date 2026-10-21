import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("jose", async importOriginal => ({
  ...(await importOriginal<typeof import("jose")>()),
  jwtVerify: vi.fn(async () => ({
    payload: {
      repository_id: "1248417952",
      repository_owner_id: "208570955",
      repository: "KevinMara/reelassati",
      ref: "refs/heads/main",
      workflow_ref:
        "KevinMara/reelassati/.github/workflows/maintenance.yml@refs/heads/main",
      event_name: "schedule",
    },
  })),
}));

import worker from "./server";

function environment() {
  const queries: string[] = [];
  const statement = {
    bind: () => statement,
    run: async () => ({ success: true, meta: { changes: 1 } }),
    first: async () => null,
    all: async () => ({ success: true, results: [] }),
  };
  return {
    queries,
    env: {
      DB: {
        prepare: (query: string) => {
          queries.push(query);
          return statement;
        },
        batch: async () => [],
        exec: async () => ({ count: 0, duration: 0 }),
      },
      BUCKET: {},
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
      OPENROUTER_API_KEY: "configured-but-must-never-be-used",
      TREND_REFRESH_TOKEN: "old-refresh-token-".repeat(4),
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("manual-only background work", () => {
  it("retires old research requests even with an existing configured credential", async () => {
    const { env, queries } = environment();
    const network = vi.fn(() => {
      throw new Error("Background provider calls are forbidden");
    });
    vi.stubGlobal("fetch", network);
    for (const method of ["GET", "POST"]) {
      const response = await worker.fetch(
        new Request("https://studio.example/api/internal/trends/weekly", {
          method,
          headers: { Authorization: `Bearer ${env.TREND_REFRESH_TOKEN}` },
        }),
        env as never
      );
      expect(response.status).toBe(410);
      expect(await response.json()).toMatchObject({
        code: "automatic-research-disabled",
      });
    }
    expect(network).not.toHaveBeenCalled();
    expect(queries).toEqual([]);
  });

  it("scheduled bookkeeping cannot initiate research or resume a generation", async () => {
    const { env, queries } = environment();
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    const pending: Promise<unknown>[] = [];
    await worker.scheduled(undefined, env as never, {
      waitUntil: promise => pending.push(promise),
    });
    await Promise.all(pending);
    expect(network).not.toHaveBeenCalled();
    expect(queries.join("\n")).not.toMatch(
      /FROM (?:generation_jobs|trend_snapshots)|INSERT INTO ai_invocations/i
    );
    expect(queries.join("\n")).toContain("billing_accounts");
  });

  it("an old authenticated maintenance schedule cannot spend on research or video recovery", async () => {
    const { env, queries } = environment();
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    const response = await worker.fetch(
      new Request("https://studio.example/api/internal/maintenance", {
        method: "POST",
        headers: { Authorization: "Bearer existing-scheduler-identity" },
      }),
      env as never
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      tasks: [{ task: "monthly credit renewals", ok: true }],
    });
    expect(network).not.toHaveBeenCalled();
    expect(queries.join("\n")).not.toMatch(
      /FROM (?:generation_jobs|trend_snapshots)|INSERT INTO ai_invocations/i
    );
  });
});
