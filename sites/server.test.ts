import { describe, expect, it } from "vitest";
import worker from "./server";

const env = {
  ASSETS: {
    fetch: async () => new Response("not found", { status: 404 }),
  },
  DB: {},
  BUCKET: {},
};

describe("Sites worker", () => {
  it("serves the SPA entry for the production root route", async () => {
    const requestedPaths: string[] = [];
    const response = await worker.fetch(
      new Request("https://studio.example/", {
        headers: { accept: "text/html" },
      }),
      {
        ...env,
        ASSETS: {
          fetch: async (request: Request) => {
            const pathname = new URL(request.url).pathname;
            requestedPaths.push(pathname);
            return pathname === "/index.html"
              ? new Response("<!doctype html><title>REELassati</title>", {
                  headers: { "content-type": "text/html" },
                })
              : new Response("not found", { status: 404 });
          },
        },
      } as never
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("REELassati");
    expect(requestedPaths).toEqual(["/", "/index.html"]);
  });

  it("reports storage bindings without exposing secrets", async () => {
    const response = await worker.fetch(
      new Request("https://studio.example/api/health"),
      env as never
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      storage: { d1: true, r2: true },
    });
  });

  it("uses the forwarded workspace identity for the session", async () => {
    const response = await worker.fetch(
      new Request("https://studio.example/api/session", {
        headers: {
          "oai-authenticated-user-email": "creator@example.com",
          "oai-authenticated-user-full-name": "Ada%20Creator",
          "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
        },
      }),
      env as never
    );
    const body = (await response.json()) as {
      user: { email: string; name: string };
      capabilities: { missing: string[] };
    };

    expect(response.status).toBe(200);
    expect(body.user).toEqual({
      email: "creator@example.com",
      name: "Ada Creator",
      role: "owner",
    });
    expect(body.capabilities.missing).toContain("OPENROUTER_API_KEY");
    expect(body.capabilities.missing).toContain("ZERNIO_API_KEY");
  });

  it("rejects unauthenticated hosted API requests", async () => {
    const response = await worker.fetch(
      new Request("https://studio.example/api/workspace"),
      env as never
    );

    expect(response.status).toBe(401);
  });

  it("rejects oversized streamed JSON even without a content-length header", async () => {
    const response = await worker.fetch(
      new Request("https://studio.example/api/ai/script", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "creator@example.com",
        },
        body: JSON.stringify({ topic: "x".repeat(2_000_100) }),
      }),
      env as never
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: "Request body is too large",
    });
  });

  it("returns a controlled error for malformed JSON", async () => {
    const response = await worker.fetch(
      new Request("https://studio.example/api/ai/script", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "creator@example.com",
        },
        body: '{"topic":',
      }),
      env as never
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Request body is not valid JSON",
    });
  });

  it("routes only default text generation through Kimi subscription test mode", async () => {
    const originalFetch = globalThis.fetch;
    let providerUrl = "";
    let providerBody: Record<string, unknown> = {};
    globalThis.fetch = async (input, init) => {
      providerUrl = String(input);
      providerBody = JSON.parse(String(init?.body || "{}"));
      return Response.json({
        choices: [
          {
            message: {
              content:
                '{"title":"Test","hook":"Hook","body":"Body","cta":"CTA","fullScript":"Hook\\nBody\\nCTA"}',
            },
          },
        ],
      });
    };

    try {
      const response = await worker.fetch(
        new Request("https://studio.example/api/ai/script", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "oai-authenticated-user-email": "creator@example.com",
          },
          body: JSON.stringify({ topic: "A useful test" }),
        }),
        {
          ...env,
          KIMI_TEST_MODE: "enabled",
          KIMI_CODE_API_KEY: "test-kimi-key",
          KIMI_CODE_MODEL: "k3-256k",
          OPENROUTER_API_KEY: "test-openrouter-key",
        } as never
      );

      expect(response.status).toBe(200);
      expect(providerUrl).toBe(
        "https://api.kimi.com/coding/v1/chat/completions"
      );
      expect(providerBody.model).toBe("k3-256k");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("keeps explicitly selected non-Kimi analysis models on OpenRouter", async () => {
    const originalFetch = globalThis.fetch;
    let providerUrl = "";
    let providerBody: Record<string, unknown> = {};
    globalThis.fetch = async (input, init) => {
      providerUrl = String(input);
      providerBody = JSON.parse(String(init?.body || "{}"));
      return Response.json({
        choices: [
          {
            message: {
              content:
                '{"summary":"Reviewed","hook":{"score":70},"pacing":{"score":75},"retention":[],"changes":[]}',
            },
          },
        ],
      });
    };

    try {
      const response = await worker.fetch(
        new Request("https://studio.example/api/ai/analyze", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "oai-authenticated-user-email": "creator@example.com",
          },
          body: JSON.stringify({
            publicUrl: "https://media.example.com/test.mp4",
          }),
        }),
        {
          ...env,
          KIMI_TEST_MODE: "enabled",
          KIMI_CODE_API_KEY: "test-kimi-key",
          OPENROUTER_API_KEY: "test-openrouter-key",
          OPENROUTER_ANALYSIS_MODEL: "google/gemini-2.5-flash",
        } as never
      );

      expect(response.status).toBe(200);
      expect(providerUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
      expect(providerBody.model).toBe("google/gemini-2.5-flash");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
