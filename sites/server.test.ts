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
});
