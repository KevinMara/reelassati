import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleSupport } from "../api/support";

const originalEnvironment = { ...process.env };

beforeEach(() => {
  process.env.SUPABASE_URL = "https://product.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-test";
  delete process.env.RESEND_API_KEY;
});

afterEach(() => {
  process.env = { ...originalEnvironment };
  vi.unstubAllGlobals();
});

describe("Vercel support function", () => {
  it("stores an anonymous ticket in Supabase and reports pending email setup", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        requests.push({ url, init });
        if (url.includes("/rpc/claim_support_rate_limit")) {
          return Response.json(true);
        }
        if (url.endsWith("/rest/v1/support_tickets")) {
          return new Response(null, { status: 201 });
        }
        if (url.includes("/rest/v1/support_tickets?id=eq.")) {
          return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected request: ${url}`);
      })
    );

    const response = await handleSupport(
      new Request("https://www.reelassati.app/api/support", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.4",
        },
        body: JSON.stringify({
          action: "ticket",
          email: "customer@example.com",
          name: "Customer",
          category: "billing",
          priority: "high",
          subject: "Invoice needs review",
          description: "The invoice total does not match my plan.",
          conversation: [{ role: "user", content: "Please help." }],
        }),
      })
    );

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.ticket).toMatchObject({
      emailStatus: "configuration_required",
      supportEmail: "reelassati@gmail.com",
    });
    const insert = requests.find(request =>
      request.url.endsWith("/rest/v1/support_tickets")
    );
    expect(JSON.parse(String(insert?.init?.body))).toMatchObject({
      requester_email: "customer@example.com",
      category: "billing",
      priority: "high",
      status: "open",
    });
  });

  it("sends a ticket email with a stable idempotency key", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        requests.push({ url, init });
        if (url.includes("/rpc/claim_support_rate_limit")) {
          return Response.json(true);
        }
        if (url.endsWith("/rest/v1/support_tickets")) {
          return new Response(null, { status: 201 });
        }
        if (url === "https://api.resend.com/emails") {
          return Response.json({ id: "email_123" });
        }
        if (url.includes("/rest/v1/support_tickets?id=eq.")) {
          return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected request: ${url}`);
      })
    );

    const response = await handleSupport(
      new Request("https://www.reelassati.app/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "customer@example.com",
          category: "bug",
          subject: "Publisher is blocked",
          description: "Publishing remains blocked after retrying twice.",
        }),
      })
    );

    const payload = await response.json();
    expect(payload.ticket.emailStatus).toBe("sent");
    const emailRequest = requests.find(
      request => request.url === "https://api.resend.com/emails"
    );
    const headers = new Headers(emailRequest?.init?.headers);
    expect(headers.get("Idempotency-Key")).toMatch(/^support-ticket-RA-/);
    expect(JSON.parse(String(emailRequest?.init?.body))).toMatchObject({
      to: ["reelassati@gmail.com"],
      reply_to: "customer@example.com",
    });
  });

  it("lets Kimi request automatic escalation without creating a duplicate Sites ticket", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        requests.push({ url, init });
        if (url.endsWith("/api/support/chat")) {
          return Response.json({
            reply: "I prepared the ticket.",
            resolved: false,
            needsHuman: true,
            suggestedActions: [],
            autoCreateTicket: true,
            ticketDraft: {
              category: "account",
              priority: "high",
              subject: "Account access failure",
              description:
                "The customer cannot access the account after recovery.",
            },
            ticket: null,
            supportEmail: "reelassati@gmail.com",
          });
        }
        if (url.endsWith("/auth/v1/user")) {
          return Response.json({
            id: "00000000-0000-0000-0000-000000000001",
            email: "member@example.com",
            user_metadata: { full_name: "Member" },
          });
        }
        if (url.includes("/rpc/claim_support_rate_limit")) {
          return Response.json(true);
        }
        if (url.endsWith("/rest/v1/support_tickets")) {
          return new Response(null, { status: 201 });
        }
        if (url.includes("/rest/v1/support_tickets?id=eq.")) {
          return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected request: ${url}`);
      })
    );

    const response = await handleSupport(
      new Request("https://www.reelassati.app/api/support", {
        method: "POST",
        headers: {
          authorization: "Bearer member-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "chat",
          messages: [{ role: "user", content: "Open a ticket for me." }],
        }),
      })
    );

    const payload = await response.json();
    expect(payload.ticketDraft).toBeNull();
    expect(payload.ticket.id).toMatch(/^RA-/);
    const upstream = requests.find(request =>
      request.url.endsWith("/api/support/chat")
    );
    expect(
      new Headers(upstream?.init?.headers).get("X-Support-Ticket-Owner")
    ).toBe("vercel");
  });

  it("returns the feedback inbox only to an allowed owner", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        requests.push({ url, init });
        if (url.endsWith("/auth/v1/user")) {
          return Response.json({
            id: "00000000-0000-0000-0000-000000000002",
            email: "reelassati@gmail.com",
          });
        }
        if (url.includes("/rest/v1/support_tickets?")) {
          return Response.json([
            {
              id: "RA-20260823-ABC12345",
              requester_user_id: null,
              requester_email: "customer@example.com",
              requester_name: "Customer",
              category: "feedback",
              priority: "normal",
              subject: "Add a caption preset",
              description: "Reusable caption presets would save time.",
              status: "open",
              email_status: "sent",
              created_at: "2026-08-23T12:00:00.000Z",
              updated_at: "2026-08-23T12:00:00.000Z",
            },
          ]);
        }
        throw new Error(`Unexpected request: ${url}`);
      })
    );

    const response = await handleSupport(
      new Request("https://www.reelassati.app/api/support", {
        method: "POST",
        headers: {
          authorization: "Bearer owner-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "feedback_list" }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      owner: true,
      feedback: [
        {
          id: "RA-20260823-ABC12345",
          type: "feedback",
          requesterEmail: "customer@example.com",
        },
      ],
    });
    expect(
      requests.some(request =>
        request.url.includes("category=in.%28bug%2Cfeedback%29")
      )
    ).toBe(true);
  });

  it("denies the feedback inbox to regular members", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/auth/v1/user")) {
          return Response.json({
            id: "00000000-0000-0000-0000-000000000003",
            email: "member@example.com",
          });
        }
        throw new Error(`Unexpected request: ${url}`);
      })
    );

    const response = await handleSupport(
      new Request("https://www.reelassati.app/api/support", {
        method: "POST",
        headers: {
          authorization: "Bearer member-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "feedback_list" }),
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "This feedback inbox is restricted to the owner.",
    });
  });
});
