import { afterEach, describe, expect, it, vi } from "vitest";
import { serviceDiagnostics } from "./service-diagnostics";
import worker from "./server";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const configured = {
  OPENROUTER_API_KEY: " test-only-server-key ",
  ELEVENLABS_API_KEY: " test-only-sound-key ",
  ELEVENLABS_COMMERCIAL_ENABLED: "true",
  ELEVENLABS_SFX_USD_PER_SECOND: "0.01",
};

function keyResponse(remaining: unknown) {
  return Response.json({
    data: {
      limit_remaining: remaining,
      label: "PRIVATE_KEY_LABEL",
      creator_user_id: "PRIVATE_ACCOUNT_ID",
      usage: 12345,
    },
  });
}

describe("read-only service diagnostics", () => {
  it("reports missing server configuration without making a provider request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const result = await serviceDiagnostics({}, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ai: { status: "not-configured" },
      soundEffects: {
        configured: false,
        missing: [
          "ELEVENLABS_API_KEY",
          "ELEVENLABS_COMMERCIAL_ENABLED",
          "ELEVENLABS_SFX_USD_PER_SECOND",
        ],
      },
      generationTested: false,
    });
    expect(Number.isFinite(Date.parse(result.checkedAt))).toBe(true);
  });

  it("checks only GET /key and returns no private key/account/usage metadata", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(keyResponse(10));
    const result = await serviceDiagnostics(configured, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("https://openrouter.ai/api/v1/key", {
      method: "GET",
      headers: { Authorization: "Bearer test-only-server-key" },
      redirect: "error",
      signal: expect.any(AbortSignal),
    });
    expect(result).toMatchObject({
      ai: { status: "authenticated" },
      soundEffects: { configured: true, missing: [] },
      generationTested: false,
    });
    expect(result.ai.note).toContain("funding");
    expect(result.ai.note).toContain("have not been tested");
    const serialized = JSON.stringify(result);
    for (const privateValue of [
      "test-only-server-key",
      "test-only-sound-key",
      "PRIVATE_KEY_LABEL",
      "PRIVATE_ACCOUNT_ID",
      "12345",
    ])
      expect(serialized).not.toContain(privateValue);
  });

  it("accepts an unlimited key without claiming funded generation", async () => {
    const result = await serviceDiagnostics(
      configured,
      vi.fn<typeof fetch>().mockResolvedValue(keyResponse(null))
    );
    expect(result.ai.status).toBe("authenticated");
    expect(result.generationTested).toBe(false);
  });

  it.each([0, -1])(
    "reports an exhausted key allowance of %s",
    async remaining => {
      const result = await serviceDiagnostics(
        configured,
        vi.fn<typeof fetch>().mockResolvedValue(keyResponse(remaining))
      );
      expect(result.ai.status).toBe("key-limit-reached");
    }
  );

  it.each([401, 403])(
    "reports authorization rejection for HTTP %s without exposing error text",
    async status => {
      let cancelled = false;
      const body = new ReadableStream({
        cancel() {
          cancelled = true;
        },
      });
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(body, { status }));
      const result = await serviceDiagnostics(configured, fetcher);
      expect(result.ai.status).toBe("authorization-rejected");
      expect(cancelled).toBe(true);
    }
  );

  it.each([429, 500])(
    "reports a generic temporary failure for HTTP %s",
    async status => {
      const result = await serviceDiagnostics(
        configured,
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response("PRIVATE_PROVIDER_ERROR", { status }))
      );
      expect(result.ai.status).toBe("temporarily-unavailable");
      expect(JSON.stringify(result)).not.toContain("PRIVATE_PROVIDER_ERROR");
    }
  );

  it("rejects invalid JSON and invalid limit metadata", async () => {
    const bodies = [
      "not-json",
      JSON.stringify({ data: {} }),
      JSON.stringify({ data: { limit_remaining: "10" } }),
      JSON.stringify({ data: { limit_remaining: true } }),
      '{"data":{"limit_remaining":1e999}}',
    ];
    for (const body of bodies) {
      const result = await serviceDiagnostics(
        configured,
        vi.fn<typeof fetch>().mockResolvedValue(new Response(body))
      );
      expect(result.ai.status).toBe("invalid-response");
    }
  });

  it("returns a generic result for timeout or network failure", async () => {
    for (const cause of [
      new DOMException("PRIVATE_TIMEOUT", "TimeoutError"),
      new Error("PRIVATE_NETWORK"),
    ]) {
      const result = await serviceDiagnostics(
        configured,
        vi.fn<typeof fetch>().mockRejectedValue(cause)
      );
      expect(result.ai.status).toBe("temporarily-unavailable");
      expect(JSON.stringify(result)).not.toContain("PRIVATE_");
    }
  });

  it("bounds streamed response bytes and cancels oversized data", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(16 * 1024 + 1));
      },
      cancel() {
        cancelled = true;
      },
    });
    const result = await serviceDiagnostics(
      configured,
      vi.fn<typeof fetch>().mockResolvedValue(new Response(body))
    );
    expect(result.ai.status).toBe("temporarily-unavailable");
    expect(cancelled).toBe(true);
  });

  it("cancels a declared oversized response before reading it", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
    });
    const result = await serviceDiagnostics(
      configured,
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(body, { headers: { "content-length": "16385" } })
        )
    );
    expect(result.ai.status).toBe("temporarily-unavailable");
    expect(cancelled).toBe(true);
  });

  it("requires a real sound key, commercial flag, and finite positive account rate", async () => {
    const invalidRates = [
      undefined,
      "",
      "0",
      "-1",
      "Infinity",
      "NaN",
      "not-a-rate",
    ];
    for (const rate of invalidRates) {
      const fetcher = vi.fn<typeof fetch>();
      const result = await serviceDiagnostics(
        {
          ...configured,
          OPENROUTER_API_KEY: " ",
          ELEVENLABS_SFX_USD_PER_SECOND: rate,
        },
        fetcher
      );
      expect(result.soundEffects).toMatchObject({
        configured: false,
        missing: ["ELEVENLABS_SFX_USD_PER_SECOND"],
      });
      expect(fetcher).not.toHaveBeenCalled();
    }
    const result = await serviceDiagnostics(
      {
        ...configured,
        OPENROUTER_API_KEY: undefined,
        ELEVENLABS_API_KEY: " ",
        ELEVENLABS_COMMERCIAL_ENABLED: "TRUE",
      },
      vi.fn<typeof fetch>()
    );
    expect(result.soundEffects.missing).toEqual([
      "ELEVENLABS_API_KEY",
      "ELEVENLABS_COMMERCIAL_ENABLED",
    ]);
  });
});

function routeFixture() {
  const queries: string[] = [];
  const statement = {
    bind: () => statement,
    run: async () => ({ success: true, meta: {} }),
    first: async () => null,
    all: async () => ({ success: true, results: [], meta: {} }),
    raw: async () => [],
  };
  const env = {
    ...configured,
    COMPLIANCE_OPERATOR_OWNER_EMAIL: "creator@example.com",
    AI_PROVENANCE_SIGNING_KEY:
      "test-only-signing-key-with-at-least-24-characters",
    DB: {
      prepare: (query: string) => {
        queries.push(query);
        return statement;
      },
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 }),
    },
    BUCKET: {},
    ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
  };
  const request = (email?: string, method = "POST") =>
    new Request("https://studio.example/api/operations/services", {
      method,
      headers: email ? { "oai-authenticated-user-email": email } : {},
    });
  return { env, queries, request };
}

describe("owner service diagnostics route", () => {
  it("rejects an anonymous caller before contacting the provider", async () => {
    const fixture = routeFixture(),
      fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    const response = await worker.fetch(
      fixture.request(),
      fixture.env as never
    );
    expect(response.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects a different account without a provider request", async () => {
    const fixture = routeFixture(),
      fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    const response = await worker.fetch(
      fixture.request("member@example.com"),
      fixture.env as never
    );
    expect(response.status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects owner checks when no authorized operator is configured", async () => {
    const fixture = routeFixture(),
      fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    const response = await worker.fetch(
      fixture.request("creator@example.com"),
      { ...fixture.env, COMPLIANCE_OPERATOR_OWNER_EMAIL: "" } as never
    );
    expect(response.status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requires POST and leaves GET free of provider side effects", async () => {
    const fixture = routeFixture(),
      fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    const response = await worker.fetch(
      fixture.request("creator@example.com", "GET"),
      fixture.env as never
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns a no-store owner check without generation or credit-ledger writes", async () => {
    const fixture = routeFixture(),
      fetcher = vi.fn<typeof fetch>().mockResolvedValue(keyResponse(10));
    vi.stubGlobal("fetch", fetcher);
    const response = await worker.fetch(
      fixture.request("creator@example.com"),
      fixture.env as never
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      ai: { status: "authenticated" },
      generationTested: false,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://openrouter.ai/api/v1/key");
    expect(
      fixture.queries.some(query =>
        /(?:INSERT INTO|UPDATE) (?:credit_ledger|ai_invocations|generation_jobs)/i.test(
          query
        )
      )
    ).toBe(false);
  });

  it("never marks sound generation ready with an infinite rate or whitespace key", async () => {
    const fixture = routeFixture();
    for (const changed of [
      { ELEVENLABS_SFX_USD_PER_SECOND: "Infinity" },
      { ELEVENLABS_API_KEY: " " },
    ]) {
      const response = await worker.fetch(
        new Request("https://studio.example/api/capabilities", {
          headers: { "oai-authenticated-user-email": "creator@example.com" },
        }),
        { ...fixture.env, ...changed } as never
      );
      expect(await response.json()).toMatchObject({
        capabilities: { soundGeneration: false },
      });
    }
  });
});
