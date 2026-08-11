import { describe, expect, it, vi } from "vitest";
import worker, {
  appendReleaseDisclosure,
  jobFromRow,
  publicationReviewFromInput,
  providerPostState,
  submitZernioPost,
} from "./server";
import {
  AI_COMPLIANCE_POLICY_VERSION,
  appendTextProvenanceMarker,
  type PublicationComplianceReview,
} from "../contracts/compliance";
import type { ScheduledPost } from "../contracts/workspace";

function createD1Stub() {
  const statement = {
    bind: () => statement,
    run: async () => ({ success: true, meta: {} }),
    first: async () => null,
    all: async () => ({ success: true, results: [], meta: {} }),
    raw: async () => [],
  };
  return {
    prepare: () => statement,
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  };
}

function createD1StubWithOperatorRow() {
  const prepare = (query: string) => {
    const statement = {
      bind: () => statement,
      run: async () => ({ success: true, meta: {} }),
      first: async () =>
        /SELECT \* FROM operator_compliance/i.test(query)
          ? {
              owner_email: "creator@example.com",
              legal_name: "Should Not Be Used",
              entity_type: "individual",
              release_status: "public",
              first_eu_availability_date: "2026-08-04",
              creative_scope_confirmed_at: "2026-08-04T00:00:00.000Z",
              ai_literacy_acknowledged_at: "2026-08-04T00:00:00.000Z",
              updated_at: "2026-08-04T00:00:00.000Z",
            }
          : null,
      all: async () => ({ success: true, results: [], meta: {} }),
      raw: async () => [],
    };
    return statement;
  };
  return {
    prepare,
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  };
}

function createStatefulD1Stub() {
  const provenanceRows: Array<Record<string, unknown>> = [];
  const prepare = (query: string) => {
    let bindings: unknown[] = [];
    const statement = {
      bind: (...values: unknown[]) => {
        bindings = values;
        return statement;
      },
      run: async () => {
        if (/INSERT INTO ai_provenance_records/i.test(query)) {
          const [
            id,
            publicToken,
            ownerEmail,
            entityType,
            entityId,
            origin,
            operation,
            provider,
            model,
            policyVersion,
            signingKeyId,
            markingMethod,
            markingStatus,
            contentSha256,
            metadataJson,
            createdAt,
          ] = bindings;
          provenanceRows.push({
            id,
            public_token: publicToken,
            owner_email: ownerEmail,
            entity_type: entityType,
            entity_id: entityId,
            origin,
            operation,
            provider,
            model,
            policy_version: policyVersion,
            signing_key_id: signingKeyId,
            marking_method: markingMethod,
            marking_status: markingStatus,
            content_sha256: contentSha256,
            metadata_json: metadataJson,
            created_at: createdAt,
            deleted_at: null,
          });
        }
        return { success: true, meta: { changes: 1 } };
      },
      first: async () => {
        if (/FROM ai_provenance_records/i.test(query)) {
          if (/public_token = \?/i.test(query)) {
            return (
              provenanceRows.find(
                row => row.public_token === bindings.at(-1)
              ) || null
            );
          }
          if (/content_sha256 = \?/i.test(query)) {
            return (
              provenanceRows.find(
                row =>
                  row.content_sha256 === bindings[0] &&
                  row.marking_status === "verified"
              ) || null
            );
          }
          if (
            /owner_email = \?.*entity_type = \?.*entity_id = \?/is.test(query)
          ) {
            return (
              provenanceRows.find(
                row =>
                  row.owner_email === bindings[0] &&
                  row.entity_type === bindings[1] &&
                  row.entity_id === bindings[2]
              ) || null
            );
          }
          if (/WHERE id = \?.*owner_email = \?/is.test(query)) {
            return (
              provenanceRows.find(
                row => row.id === bindings[0] && row.owner_email === bindings[1]
              ) || null
            );
          }
        }
        return null;
      },
      all: async () => ({
        success: true,
        results: /FROM ai_provenance_records/i.test(query)
          ? provenanceRows.filter(
              row => !bindings.length || row.owner_email === bindings[0]
            )
          : [],
        meta: {},
      }),
      raw: async () => [],
    };
    return statement;
  };
  return {
    prepare,
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  };
}

function createReferralD1Stub() {
  const claim = {
    id: "claim-1",
    referral_code: "REEL-ABC123",
    referrer_email: "referrer@example.com",
    referred_email: "buyer@example.com",
    status: "pending" as "pending" | "verified",
    credits_awarded: 0,
    value_cents: 0,
    qualified_at: null as string | null,
    payment_event_id: null as string | null,
    plan_id: null as string | null,
    created_at: "2026-08-06T00:00:00.000Z",
  };
  const prepare = (query: string) => {
    let bindings: unknown[] = [];
    const statement = {
      bind: (...values: unknown[]) => {
        bindings = values;
        return statement;
      },
      run: async () => {
        if (/UPDATE referral_claims\s+SET status = 'verified'/i.test(query)) {
          if (claim.status === "verified") {
            return { success: true, meta: { changes: 0 } };
          }
          claim.status = "verified";
          claim.credits_awarded = Number(bindings[0]);
          claim.value_cents = Number(bindings[1]);
          claim.qualified_at = String(bindings[2]);
          claim.payment_event_id = String(bindings[3]);
          claim.plan_id = String(bindings[4]);
        }
        return { success: true, meta: { changes: 1 } };
      },
      first: async () => {
        if (/FROM referral_claims\s+WHERE referred_email = \?/i.test(query)) {
          return bindings[0] === claim.referred_email ? { ...claim } : null;
        }
        if (/FROM referral_claims WHERE id = \?/i.test(query)) {
          return bindings[0] === claim.id ? { ...claim } : null;
        }
        return null;
      },
      all: async () => ({ success: true, results: [], meta: {} }),
      raw: async () => [],
    };
    return statement;
  };
  return {
    claim,
    database: {
      prepare,
      batch: async (statements: Array<{ run(): Promise<unknown> }>) =>
        Promise.all(statements.map(statement => statement.run())),
      exec: async () => ({ count: 0, duration: 0 }),
    },
  };
}

async function referralSignature(rawBody: string, secret: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp},${rawBody}`)
  );
  const signature = Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `t=${timestamp},v1=${signature}`;
}

const env = {
  ASSETS: {
    fetch: async () => new Response("not found", { status: 404 }),
  },
  DB: createD1Stub(),
  BUCKET: {},
};

const disclosureReview: PublicationComplianceReview = {
  policyVersion: AI_COMPLIANCE_POLICY_VERSION,
  reviewedAt: "2026-08-04T00:00:00.000Z",
  disclosureLanguage: "en",
  classificationAnswers: {
    aiGeneratedText: "yes",
    realisticSyntheticMedia: "not-applicable",
    depictsRealPersonOrVoice: "not-applicable",
    creativeOrFictionalWork: "not-applicable",
    publicInterestText: "yes",
  },
  intendedUseConfirmed: true,
  rightsConfirmed: true,
  rightsBasis: "not-applicable",
  containsAiGeneratedText: true,
  containsRealisticSyntheticMedia: false,
  depictsRealPersonOrVoice: false,
  creativeOrFictionalWork: false,
  publicInterestText: true,
  substantiveHumanReview: false,
  materialAiEditsAfterReview: false,
  visibleDisclosure: {
    required: true,
    reason: "public-interest-text",
    method: "caption",
    text: "Public-interest text created or materially edited with AI.",
    language: "en",
  },
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

  it("qualifies referral rewards only from a signed, idempotent billing event", async () => {
    const secret = "billing-webhook-secret-at-least-24-characters";
    const rawBody = JSON.stringify({
      type: "paid_plan_purchased",
      eventId: "payment-event-123",
      customerEmail: "buyer@example.com",
      planId: "creator-pro",
      paymentStatus: "paid",
    });
    const referral = createReferralD1Stub();
    const request = (signature: string) =>
      new Request("https://studio.example/api/referrals/billing-webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-reelassati-signature": signature,
        },
        body: rawBody,
      });
    const referralEnv = {
      ...env,
      DB: referral.database,
      REFERRAL_BILLING_WEBHOOK_SECRET: secret,
    };

    const rejected = await worker.fetch(
      request("t=0,v1=invalid"),
      referralEnv as never
    );
    expect(rejected.status).toBe(401);
    expect(referral.claim.status).toBe("pending");

    const accepted = await worker.fetch(
      request(await referralSignature(rawBody, secret)),
      referralEnv as never
    );
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({
      verified: true,
      alreadyQualified: false,
      creditsAwarded: 500,
    });
    expect(referral.claim).toMatchObject({
      status: "verified",
      credits_awarded: 500,
      value_cents: 500,
      payment_event_id: "payment-event-123",
      plan_id: "creator-pro",
    });

    const replay = await worker.fetch(
      request(await referralSignature(rawBody, secret)),
      referralEnv as never
    );
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({
      verified: true,
      alreadyQualified: true,
      creditsAwarded: 500,
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
      user: { id: string; email: string; name: string };
      capabilities: { missing: string[] };
    };

    expect(response.status).toBe(200);
    expect(body.user).toEqual({
      id: "creator@example.com",
      email: "creator@example.com",
      name: "Ada Creator",
      role: "member",
    });
    expect(body.capabilities.missing).toContain("OPENROUTER_API_KEY");
    expect(body.capabilities.missing).toContain("ZERNIO_API_KEY");
  });

  it("verifies a Supabase bearer session before returning workspace identity", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async request => {
      expect(String(request)).toBe("https://auth.example/auth/v1/user");
      return Response.json({
        email: "member@example.com",
        user_metadata: { full_name: "Public Member" },
      });
    }) as typeof fetch;

    try {
      const response = await worker.fetch(
        new Request("https://studio.example/api/session", {
          headers: { Authorization: "Bearer verified-token" },
        }),
        {
          ...env,
          SUPABASE_URL: "https://auth.example",
          SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        } as never
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        user: {
          email: "member@example.com",
          name: "Public Member",
          role: "member",
        },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns edge country localization before authentication and permits public app CORS", async () => {
    const request = new Request("https://studio.example/api/localization", {
      headers: { Origin: "https://reelassati.app" },
    });
    Object.defineProperty(request, "cf", { value: { country: "IT" } });
    const response = await worker.fetch(request, env as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ country: "IT" });
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://reelassati.app"
    );
  });

  it("provides public Kimi-powered support without requiring an account", async () => {
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
              content: JSON.stringify({
                reply: "Open Settings and reconnect the publishing account.",
                resolved: false,
                needsHuman: false,
                suggestedActions: ["Open Settings", "Reconnect the account"],
                ticketDraft: null,
              }),
            },
          },
        ],
      });
    };

    try {
      const response = await worker.fetch(
        new Request("https://studio.example/api/support/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: "Publishing is disconnected" }],
          }),
        }),
        { ...env, OPENROUTER_API_KEY: "test-openrouter-key" } as never
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        reply: "Open Settings and reconnect the publishing account.",
        suggestedActions: ["Open Settings", "Reconnect the account"],
        supportEmail: "reelassati@gmail.com",
      });
      expect(providerUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
      expect(providerBody.model).toBe("moonshotai/kimi-k2.5");
      expect(providerBody).not.toHaveProperty("response_format");
      expect(
        (providerBody.messages as Array<{ role: string; content: unknown }>)[1]
          .content
      ).toBeTypeOf("string");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("creates a public support ticket and sends an idempotent support email", async () => {
    const originalFetch = globalThis.fetch;
    let emailRequest: { url: string; headers: Headers; body: Record<string, unknown> } | null = null;
    globalThis.fetch = async (input, init) => {
      emailRequest = {
        url: String(input),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body || "{}")),
      };
      return Response.json({ id: "email_123" });
    };

    try {
      const response = await worker.fetch(
        new Request("https://studio.example/api/support/tickets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: "customer@example.com",
            name: "Customer",
            category: "bug",
            priority: "high",
            subject: "Editor export is stuck",
            description: "The export remains at zero percent after a retry.",
            conversation: [
              { role: "user", content: "My editor export is stuck." },
            ],
          }),
        }),
        { ...env, RESEND_API_KEY: "re_test_key" } as never
      );
      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({
        ticket: {
          id: expect.stringMatching(/^RA-\d{8}-[A-F0-9]{8}$/),
          emailStatus: "sent",
          supportEmail: "reelassati@gmail.com",
        },
      });
      expect(emailRequest?.url).toBe("https://api.resend.com/emails");
      expect(emailRequest?.headers.get("authorization")).toBe(
        "Bearer re_test_key"
      );
      expect(emailRequest?.headers.get("idempotency-key")).toMatch(
        /^support-ticket-RA-/
      );
      expect(emailRequest?.body).toMatchObject({
        to: ["reelassati@gmail.com"],
        reply_to: "customer@example.com",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("accepts CDN country headers when runtime geolocation metadata is absent", async () => {
    const response = await worker.fetch(
      new Request("https://studio.example/api/localization", {
        headers: { "cf-ipcountry": "fr" },
      }),
      env as never
    );
    expect(await response.json()).toEqual({ country: "FR" });
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

  it("fails closed before generation when output marking is unavailable", async () => {
    const response = await worker.fetch(
      new Request("https://studio.example/api/ai/script", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "creator@example.com",
        },
        body: JSON.stringify({ topic: "A creator workflow" }),
      }),
      {
        ...env,
        KIMI_TEST_MODE: "enabled",
        KIMI_CODE_API_KEY: "test-kimi-key",
      } as never
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error:
        "AI output marking is not configured, so generation is blocked rather than returning an unmarked output.",
      missing: ["AI_PROVENANCE_SIGNING_KEY"],
    });
  });

  it("blocks high-impact person scoring at the server boundary", async () => {
    const response = await worker.fetch(
      new Request("https://studio.example/api/ai/script", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "creator@example.com",
        },
        body: JSON.stringify({ topic: "Rank candidates for a job" }),
      }),
      {
        ...env,
        KIMI_TEST_MODE: "enabled",
        KIMI_CODE_API_KEY: "test-kimi-key",
        AI_PROVENANCE_SIGNING_KEY:
          "test-only-provenance-signing-key-32-characters",
      } as never
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "INTENDED_USE_BLOCKED",
    });
  });

  it("blocks sexual exploitation and non-consensual intimate generation", async () => {
    const response = await worker.fetch(
      new Request("https://studio.example/api/ai/script", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "creator@example.com",
        },
        body: JSON.stringify({
          topic: "Create a non-consensual intimate deepfake",
        }),
      }),
      {
        ...env,
        KIMI_TEST_MODE: "enabled",
        KIMI_CODE_API_KEY: "test-kimi-key",
        AI_PROVENANCE_SIGNING_KEY:
          "test-only-provenance-signing-key-32-characters",
      } as never
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "INTENDED_USE_BLOCKED",
    });
  });

  it("blocks high-impact decision prompts in Italian", async () => {
    const response = await worker.fetch(
      new Request("https://studio.example/api/ai/script", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "creator@example.com",
        },
        body: JSON.stringify({
          topic: "Classifica i candidati e seleziona il migliore per il lavoro",
        }),
      }),
      {
        ...env,
        OPENROUTER_API_KEY: "test-openrouter-key",
        AI_PROVENANCE_SIGNING_KEY:
          "test-only-provenance-signing-key-32-characters",
      } as never
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "INTENDED_USE_BLOCKED",
    });
  });

  it("requires a versioned release review before any provider publication", async () => {
    const response = await worker.fetch(
      new Request("https://studio.example/api/publishing/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "creator@example.com",
        },
        body: JSON.stringify({
          post: {
            id: "post_without_release_review",
            caption: "Ready to publish",
            hashtags: [],
            accountIds: [],
          },
          publishNow: true,
        }),
      }),
      env as never
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "RELEASE_REVIEW_REQUIRED",
    });
  });

  it("rejects a release review whose factual classifications were never answered", async () => {
    const response = await worker.fetch(
      new Request("https://studio.example/api/publishing/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "creator@example.com",
        },
        body: JSON.stringify({
          post: {
            id: "post_ambiguous_classification",
            caption: "Ready to publish",
            hashtags: [],
            accountIds: ["account_1"],
            complianceReview: {
              policyVersion: AI_COMPLIANCE_POLICY_VERSION,
              reviewedAt: new Date().toISOString(),
              intendedUseConfirmed: true,
              rightsConfirmed: true,
              rightsBasis: "not-applicable",
            },
          },
          publishNow: true,
        }),
      }),
      env as never
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "RELEASE_CLASSIFICATION_INCOMPLETE",
    });
  });

  it("puts the canonical release disclosure first even when the phrase appears later", () => {
    const disclosure = disclosureReview.visibleDisclosure.text as string;
    const caption = `Launch notes\n\n${disclosure}\n#creator`;

    expect(appendReleaseDisclosure(caption, disclosureReview)).toBe(
      `${disclosure}\n\n${caption}`
    );
  });

  it("normalizes one leading disclosure without duplicating it", () => {
    const disclosure = disclosureReview.visibleDisclosure.text as string;
    const alreadyLeading = `${disclosure}\nCaption body`;

    expect(appendReleaseDisclosure(alreadyLeading, disclosureReview)).toBe(
      `${disclosure}\n\nCaption body`
    );
    expect(
      appendReleaseDisclosure(`${disclosure}\n\nCaption body`, disclosureReview)
    ).toBe(`${disclosure}\n\nCaption body`);
  });

  it("requires an explicit audience disclosure language for every release", async () => {
    const input = {
      ...disclosureReview,
      reviewedAt: new Date().toISOString(),
      disclosureLanguage: undefined,
    };

    try {
      publicationReviewFromInput(input, { hasMedia: false });
      throw new Error("Expected the release review to be rejected");
    } catch (cause) {
      expect(cause).toBeInstanceOf(Response);
      const response = cause as Response;
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        code: "DISCLOSURE_LANGUAGE_REQUIRED",
      });
    }
  });

  it("uses the per-release audience language instead of a conflicting UI projection", () => {
    const review = publicationReviewFromInput(
      {
        ...disclosureReview,
        reviewedAt: new Date().toISOString(),
        disclosureLanguage: "it",
        visibleDisclosure: {
          ...disclosureReview.visibleDisclosure,
          language: "en",
          text: "Forged English client preview",
        },
      },
      { hasMedia: false }
    );

    expect(review.disclosureLanguage).toBe("it");
    expect(review.visibleDisclosure).toMatchObject({
      language: "it",
      text: "Testo di interesse pubblico creato o modificato in modo sostanziale con IA.",
    });
  });

  it("server-canonicalizes English disclosure copy instead of trusting client text", () => {
    const review = publicationReviewFromInput(
      {
        ...disclosureReview,
        reviewedAt: new Date().toISOString(),
        disclosureLanguage: "en",
        visibleDisclosure: {
          ...disclosureReview.visibleDisclosure,
          language: "it",
          text: "Client-supplied replacement",
        },
      },
      { hasMedia: false }
    );

    expect(review.visibleDisclosure).toMatchObject({
      language: "en",
      text: "Public-interest text created or materially edited with AI.",
    });
  });

  it("does not infer generated versus manipulated media from real-person presence", () => {
    const withoutRealPerson = publicationReviewFromInput(
      {
        ...disclosureReview,
        reviewedAt: new Date().toISOString(),
        disclosureLanguage: "en",
        classificationAnswers: {
          aiGeneratedText: "no",
          realisticSyntheticMedia: "yes",
          depictsRealPersonOrVoice: "no",
          creativeOrFictionalWork: "yes",
          publicInterestText: "no",
        },
        rightsBasis: "owned-or-licensed",
      },
      { hasMedia: true }
    );
    const withRealPerson = publicationReviewFromInput(
      {
        ...disclosureReview,
        reviewedAt: new Date().toISOString(),
        disclosureLanguage: "en",
        classificationAnswers: {
          aiGeneratedText: "no",
          realisticSyntheticMedia: "yes",
          depictsRealPersonOrVoice: "yes",
          creativeOrFictionalWork: "yes",
          publicInterestText: "no",
        },
        rightsBasis: "documented-consent",
      },
      { hasMedia: true }
    );

    for (const review of [withoutRealPerson, withRealPerson]) {
      expect(review.visibleDisclosure.text).toBe(
        "AI-generated or AI-manipulated media."
      );
    }
  });

  it("places the exact Italian disclosure before the provider caption and hashtags", () => {
    const review = publicationReviewFromInput(
      {
        ...disclosureReview,
        reviewedAt: new Date().toISOString(),
        disclosureLanguage: "it",
      },
      { hasMedia: false }
    );
    const disclosure = review.visibleDisclosure.text as string;

    expect(appendReleaseDisclosure("Caption body\n\n#creator", review)).toBe(
      `${disclosure}\n\nCaption body\n\n#creator`
    );
  });

  it("keeps readiness blocked when no compliance operator is configured", async () => {
    const response = await worker.fetch(
      new Request("https://studio.example/api/compliance/status", {
        headers: {
          "oai-authenticated-user-email": "creator@example.com",
        },
      }),
      {
        ...env,
        DB: createD1StubWithOperatorRow(),
      } as never
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: {
        operatorIdentityConfigured: false,
        publicLaunchReady: false,
        blockers: expect.arrayContaining([
          "Configure the authorized compliance operator account",
        ]),
      },
    });
  });

  it("rejects compliance record updates when operator authorization is absent", async () => {
    const response = await worker.fetch(
      new Request("https://studio.example/api/compliance/operator", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "creator@example.com",
        },
        body: JSON.stringify({
          legalName: "Example Operator",
          entityType: "individual",
          releaseStatus: "public",
          firstEuAvailabilityDate: "2026-08-04",
          creativeScopeConfirmed: true,
        }),
      }),
      env as never
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Compliance operator authorization is not configured",
      missing: ["COMPLIANCE_OPERATOR_OWNER_EMAIL"],
    });
  });

  it("rejects compliance updates from anyone but the configured operator", async () => {
    const response = await worker.fetch(
      new Request("https://studio.example/api/compliance/ai-literacy", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "member@example.com",
        },
        body: JSON.stringify({ acknowledged: true }),
      }),
      {
        ...env,
        COMPLIANCE_OPERATOR_OWNER_EMAIL: "creator@example.com",
      } as never
    );

    expect(response.status).toBe(403);
  });

  it("rejects an implausible future first-EU-availability date", async () => {
    const response = await worker.fetch(
      new Request("https://studio.example/api/compliance/operator", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "creator@example.com",
        },
        body: JSON.stringify({
          legalName: "Example Operator",
          entityType: "individual",
          releaseStatus: "public",
          firstEuAvailabilityDate: "2099-01-01",
          creativeScopeConfirmed: true,
        }),
      }),
      {
        ...env,
        COMPLIANCE_OPERATOR_OWNER_EMAIL: "creator@example.com",
      } as never
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Enter a valid first EU availability date",
    });
  });

  it("exposes a public detector without inferring that unmatched content is human", async () => {
    const response = await worker.fetch(
      new Request("https://studio.example/api/provenance/detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sha256: "a".repeat(64) }),
      }),
      {
        ...env,
        AI_PROVENANCE_SIGNING_KEY:
          "test-only-provenance-signing-key-32-characters",
      } as never
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      matched: false,
      verification: "unmatched",
    });
    expect(response.headers.get("X-REELassati-Retention")).toBe("none");
  });

  it("requires server-recorded authorization before video analysis", async () => {
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
        OPENROUTER_API_KEY: "test-openrouter-key",
        AI_PROVENANCE_SIGNING_KEY:
          "test-only-provenance-signing-key-32-characters",
      } as never
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("submit this video"),
    });
  });

  it("strips forged workspace provenance instead of persisting it", async () => {
    const fakeToken = "copied_foreign_token_0123456789";
    const response = await worker.fetch(
      new Request("https://studio.example/api/workspace", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "creator@example.com",
        },
        body: JSON.stringify({
          workspace: {
            version: 1,
            revision: 0,
            profile: { email: "creator@example.com", name: "Creator" },
            scripts: [
              {
                id: "manual-script",
                title: "Manual",
                hook: "Hook",
                body: "Body",
                cta: "CTA",
                fullScript: appendTextProvenanceMarker("Human copy", fakeToken),
                platform: "tiktok",
                tone: "direct",
                duration: 20,
                language: "en",
                createdAt: new Date().toISOString(),
                provenance: {
                  recordId: "foreign-record",
                  origin: "ai-generated",
                  operation: "script-generation",
                  provider: "forged",
                  model: "forged",
                  generatedAt: new Date().toISOString(),
                  policyVersion: AI_COMPLIANCE_POLICY_VERSION,
                  marking: {
                    scheme: "reelassati-provenance-v1",
                    method: "signed-record+sha256-fingerprint+text-token",
                    status: "verified",
                    publicToken: fakeToken,
                  },
                },
              },
            ],
          },
        }),
      }),
      {
        ...env,
        DB: createStatefulD1Stub(),
      } as never
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      workspace: {
        scripts: Array<{ fullScript: string; provenance?: unknown }>;
      };
    };
    expect(body.workspace.scripts[0].fullScript).toBe("Human copy");
    expect(body.workspace.scripts[0].provenance).toBeUndefined();
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
          KIMI_TEST_OWNER_EMAIL: "creator@example.com",
          KIMI_CODE_API_KEY: "test-kimi-key",
          KIMI_CODE_MODEL: "k3-256k",
          OPENROUTER_API_KEY: "test-openrouter-key",
          AI_PROVENANCE_SIGNING_KEY:
            "test-only-provenance-signing-key-32-characters",
        } as never
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        script: { provenance?: { marking?: { status?: string } } };
      };
      expect(body.script.provenance?.marking?.status).toBe("verified");
      expect(providerUrl).toBe(
        "https://api.kimi.com/coding/v1/chat/completions"
      );
      expect(providerBody.model).toBe("k3-256k");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("keeps Kimi subscription mode owner-only", async () => {
    const originalFetch = globalThis.fetch;
    let providerUrl = "";
    globalThis.fetch = async input => {
      providerUrl = String(input);
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
            "oai-authenticated-user-email": "member@example.com",
          },
          body: JSON.stringify({ topic: "A useful owner-isolation test" }),
        }),
        {
          ...env,
          DB: createStatefulD1Stub(),
          KIMI_TEST_MODE: "enabled",
          KIMI_TEST_OWNER_EMAIL: "creator@example.com",
          KIMI_CODE_API_KEY: "test-kimi-key",
          OPENROUTER_API_KEY: "test-openrouter-key",
          AI_PROVENANCE_SIGNING_KEY:
            "test-only-provenance-signing-key-32-characters",
        } as never
      );

      expect(response.status).toBe(200);
      expect(providerUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("round-trips generated marked text and rejects altered artifacts", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      Response.json({
        choices: [
          {
            message: {
              content:
                '{"title":"Test","hook":"Hook","body":"Body","cta":"CTA","fullScript":"Hook\\nBody\\nCTA"}',
            },
          },
        ],
      });
    const DB = createStatefulD1Stub();
    const signingKey = "test-only-provenance-signing-key-32-characters";
    const workerEnv = {
      ...env,
      DB,
      OPENROUTER_API_KEY: "test-openrouter-key",
      AI_PROVENANCE_SIGNING_KEY: signingKey,
      AI_PROVENANCE_SIGNING_KEY_ID: "test-v1",
    };

    try {
      const generated = await worker.fetch(
        new Request("https://studio.example/api/ai/script", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "oai-authenticated-user-email": "creator@example.com",
          },
          body: JSON.stringify({ topic: "A provenance round trip" }),
        }),
        workerEnv as never
      );
      const generatedBody = (await generated.json()) as {
        script: { fullScript: string };
      };

      const exact = await worker.fetch(
        new Request("https://studio.example/api/provenance/detect", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: generatedBody.script.fullScript }),
        }),
        workerEnv as never
      );
      expect(await exact.json()).toMatchObject({
        matched: true,
        verification: "artifact-verified",
      });

      const altered = await worker.fetch(
        new Request("https://studio.example/api/provenance/detect", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text: generatedBody.script.fullScript.replace("Body", "Changed"),
          }),
        }),
        workerEnv as never
      );
      expect(await altered.json()).toMatchObject({
        matched: false,
        recordFound: true,
        verification: "artifact-mismatch",
      });

      const rotated = await worker.fetch(
        new Request("https://studio.example/api/provenance/detect", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: generatedBody.script.fullScript }),
        }),
        {
          ...workerEnv,
          AI_PROVENANCE_SIGNING_KEY:
            "new-test-signing-key-at-least-32-characters",
          AI_PROVENANCE_SIGNING_KEY_ID: "test-v2",
          AI_PROVENANCE_VERIFICATION_KEYS_JSON: JSON.stringify({
            "test-v1": signingKey,
          }),
        } as never
      );
      expect(await rotated.json()).toMatchObject({
        matched: true,
        verification: "artifact-verified",
      });
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
            sourceRightsConfirmed: true,
          }),
        }),
        {
          ...env,
          KIMI_TEST_MODE: "enabled",
          KIMI_CODE_API_KEY: "test-kimi-key",
          OPENROUTER_API_KEY: "test-openrouter-key",
          OPENROUTER_ANALYSIS_MODEL: "google/gemini-2.5-flash",
          AI_PROVENANCE_SIGNING_KEY:
            "test-only-provenance-signing-key-32-characters",
        } as never
      );

      expect(response.status).toBe(200);
      expect(providerUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
      expect(providerBody.model).toBe("google/gemini-2.5-flash");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("never exposes provider-supplied publication or legacy video errors", () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const basePost: ScheduledPost = {
      id: "post_provider_failure",
      caption: "Caption",
      hashtags: [],
      accountIds: ["account_1"],
      platforms: ["tiktok"],
      status: "publishing",
      createdAt: "2026-08-04T00:00:00.000Z",
    };

    try {
      const post = providerPostState(
        basePost,
        {
          status: "failed",
          error: "secret upstream diagnostic with bearer-token material",
          platforms: [
            {
              platform: "tiktok",
              message: "private account-level provider diagnostic",
            },
          ],
        },
        "2026-08-04T00:01:00.000Z"
      );
      expect(post.failureReason).toMatch(
        /^The publishing provider reported a delivery failure\. Reference: [0-9a-f-]{36}\.$/i
      );
      expect(post.failureReason).not.toContain("secret upstream");
      expect(post.failureReason).not.toContain("private account-level");

      const videoJob = jobFromRow({
        id: "video_provider_failure",
        owner_email: "creator@example.com",
        provider_job_id: "provider_job_1",
        project_id: null,
        prompt: "A clip",
        status: "failed",
        progress: 100,
        result_asset_id: null,
        error: "provider body contained private diagnostic details",
        payload: "{}",
        finalizing_at: null,
        created_at: "2026-08-04T00:00:00.000Z",
        updated_at: "2026-08-04T00:01:00.000Z",
      });
      expect(videoJob.error).toBe(
        "The video job could not be completed. Retry once; if it continues, contact support."
      );
      expect(videoJob.error).not.toContain("private diagnostic");
      expect(errorLog).toHaveBeenCalledWith(
        "REELassati provider operation failed",
        expect.objectContaining({
          reference: expect.any(String),
          provider: "Zernio",
          operation: "publication-delivery-status",
        })
      );
    } finally {
      errorLog.mockRestore();
    }
  });

  it("recovers a Zernio 409 from the consumed provider body without duplicating the post", async () => {
    const originalFetch = globalThis.fetch;
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const requests: Array<{ url: string; method: string }> = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      const method = stringMethod(init?.method);
      requests.push({ url, method });
      if (method === "POST") {
        return Response.json(
          {
            message: "private provider conflict detail",
            details: { existingPostId: "existing_post_123" },
          },
          { status: 409 }
        );
      }
      return Response.json({ id: "existing_post_123", status: "scheduled" });
    };

    try {
      const result = await submitZernioPost(
        { ZERNIO_API_KEY: "test-zernio-key" } as never,
        "stable_intent_123",
        JSON.stringify({ content: "Ready" })
      );

      expect(result).toEqual({
        id: "existing_post_123",
        status: "scheduled",
      });
      expect(requests).toEqual([
        { url: "https://zernio.com/api/v1/posts", method: "POST" },
        {
          url: "https://zernio.com/api/v1/posts/existing_post_123",
          method: "GET",
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
      errorLog.mockRestore();
    }
  });
});

function stringMethod(value: string | undefined): string {
  return value || "GET";
}
