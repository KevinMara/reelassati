const SUPPORT_EMAIL = "reelassati@gmail.com";
const SUPPORT_API_ORIGIN = "https://reelassati.kevinbiz.chatgpt.site";
const SUPPORT_CATEGORIES = new Set([
  "account",
  "billing",
  "studio",
  "generation",
  "publishing",
  "privacy",
  "bug",
  "other",
]);
const SUPPORT_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

interface SupportMessage {
  role: "user" | "assistant";
  content: string;
}

interface TicketInput {
  email?: unknown;
  name?: unknown;
  category?: unknown;
  priority?: unknown;
  subject?: unknown;
  description?: unknown;
  conversation?: unknown;
}

interface SupabaseUser {
  id: string;
  email: string;
  user_metadata?: { full_name?: unknown; name?: unknown };
}

interface RuntimeConfig {
  supabaseUrl: string;
  serviceKey: string;
  publishableKey: string;
  resendKey: string;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function validEmail(value: unknown): string {
  const email = stringValue(value).trim().toLowerCase().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function cleanMessages(value: unknown): SupportMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(message => {
      if (!message || typeof message !== "object") return null;
      const candidate = message as Record<string, unknown>;
      const role = candidate.role === "assistant" ? "assistant" : "user";
      const content = stringValue(candidate.content).trim().slice(0, 4000);
      return content ? ({ role, content } satisfies SupportMessage) : null;
    })
    .filter((message): message is SupportMessage => Boolean(message))
    .slice(-10);
}

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function runtimeConfig(): RuntimeConfig | null {
  const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, "") || "";
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    "";
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    serviceKey;
  if (!supabaseUrl || !serviceKey || !publishableKey) return null;
  return {
    supabaseUrl,
    serviceKey,
    publishableKey,
    resendKey: process.env.RESEND_API_KEY?.trim() || "",
  };
}

async function requestBody(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 64_000) throw new Error("REQUEST_TOO_LARGE");
  const body = (await request.json()) as unknown;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("INVALID_BODY");
  }
  return body as Record<string, unknown>;
}

async function authenticatedUser(
  request: Request,
  config: RuntimeConfig
): Promise<SupabaseUser | null> {
  const authorization = request.headers.get("authorization")?.trim() || "";
  if (!authorization) return null;
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    throw new Error("INVALID_SESSION");
  }
  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: config.publishableKey,
      Authorization: authorization,
    },
  });
  if (!response.ok) throw new Error("INVALID_SESSION");
  const user = (await response.json()) as Partial<SupabaseUser>;
  if (!user.id || !user.email) throw new Error("INVALID_SESSION");
  return user as SupabaseUser;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function claimRateLimit(
  request: Request,
  config: RuntimeConfig,
  user: SupabaseUser | null
): Promise<boolean> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  const hour = new Date().toISOString().slice(0, 13);
  const key = await sha256(`support:${hour}:${user?.id || ip}`);
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/rpc/claim_support_rate_limit`,
    {
      method: "POST",
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_key: key,
        p_limit: user ? 60 : 25,
        p_window_started_at: `${hour}:00:00.000Z`,
      }),
    }
  );
  if (!response.ok) throw new Error("DATABASE_UNAVAILABLE");
  return (await response.json()) === true;
}

async function updateDelivery(
  config: RuntimeConfig,
  id: string,
  status: string,
  providerMessageId: string | null
): Promise<void> {
  await fetch(
    `${config.supabaseUrl}/rest/v1/support_tickets?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        email_status: status,
        provider_message_id: providerMessageId,
        updated_at: new Date().toISOString(),
      }),
    }
  );
}

async function sendTicketEmail(
  config: RuntimeConfig,
  ticket: {
    id: string;
    email: string;
    name: string;
    category: string;
    priority: string;
    subject: string;
    description: string;
    conversation: SupportMessage[];
  }
): Promise<{ status: string; providerMessageId: string | null }> {
  if (!config.resendKey) {
    return { status: "configuration_required", providerMessageId: null };
  }
  const transcript = ticket.conversation
    .map(
      message =>
        `<p><strong>${message.role === "user" ? "Customer" : "Assistant"}:</strong> ${htmlEscape(message.content)}</p>`
    )
    .join("");
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `support-ticket-${ticket.id}`,
      },
      body: JSON.stringify({
        from:
          process.env.SUPPORT_EMAIL_FROM?.trim() ||
          "REELassati Support <onboarding@resend.dev>",
        to: [SUPPORT_EMAIL],
        reply_to: ticket.email,
        subject: `[${ticket.priority.toUpperCase()}] ${ticket.id} · ${ticket.subject}`,
        html: `<h1>REELassati support ticket</h1><p><strong>ID:</strong> ${ticket.id}</p><p><strong>Customer:</strong> ${htmlEscape(ticket.name)} &lt;${htmlEscape(ticket.email)}&gt;</p><p><strong>Category:</strong> ${htmlEscape(ticket.category)}</p><p><strong>Priority:</strong> ${htmlEscape(ticket.priority)}</p><h2>${htmlEscape(ticket.subject)}</h2><p>${htmlEscape(ticket.description).replace(/\n/g, "<br>")}</p>${transcript ? `<hr><h3>Conversation</h3>${transcript}` : ""}`,
      }),
    });
    if (!response.ok) return { status: "failed", providerMessageId: null };
    const payload = (await response.json()) as { id?: unknown };
    return {
      status: "sent",
      providerMessageId: stringValue(payload.id).slice(0, 160) || null,
    };
  } catch {
    return { status: "failed", providerMessageId: null };
  }
}

async function createTicket(
  request: Request,
  config: RuntimeConfig,
  input: TicketInput
): Promise<{ id: string; emailStatus: string; supportEmail: string }> {
  const user = await authenticatedUser(request, config);
  if (!(await claimRateLimit(request, config, user))) {
    throw new Error("RATE_LIMITED");
  }
  const email = user?.email || validEmail(input.email);
  if (!email) throw new Error("EMAIL_REQUIRED");
  const metadataName = stringValue(
    user?.user_metadata?.full_name || user?.user_metadata?.name
  );
  const name = (
    metadataName || stringValue(input.name).trim() || "Customer"
  ).slice(0, 120);
  const requestedCategory = stringValue(input.category).trim().toLowerCase();
  const category = SUPPORT_CATEGORIES.has(requestedCategory)
    ? requestedCategory
    : "other";
  const requestedPriority = stringValue(input.priority).trim().toLowerCase();
  const priority = SUPPORT_PRIORITIES.has(requestedPriority)
    ? requestedPriority
    : "normal";
  const subject = stringValue(input.subject).trim().slice(0, 180);
  const description = stringValue(input.description).trim().slice(0, 8000);
  const conversation = cleanMessages(input.conversation);
  if (subject.length < 4) throw new Error("SUBJECT_REQUIRED");
  if (description.length < 10) throw new Error("DESCRIPTION_REQUIRED");

  const id = `RA-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();
  const insert = await fetch(`${config.supabaseUrl}/rest/v1/support_tickets`, {
    method: "POST",
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      id,
      requester_user_id: user?.id || null,
      requester_email: email,
      requester_name: name,
      category,
      priority,
      subject,
      description,
      conversation,
      ai_summary: `${category}: ${subject}. ${description}`.slice(0, 1200),
      status: "open",
      email_status: "pending",
      created_at: now,
      updated_at: now,
    }),
  });
  if (!insert.ok) throw new Error("DATABASE_UNAVAILABLE");

  const delivery = await sendTicketEmail(config, {
    id,
    email,
    name,
    category,
    priority,
    subject,
    description,
    conversation,
  });
  await updateDelivery(config, id, delivery.status, delivery.providerMessageId);
  return { id, emailStatus: delivery.status, supportEmail: SUPPORT_EMAIL };
}

async function proxySupportChat(
  request: Request,
  config: RuntimeConfig,
  body: Record<string, unknown>
): Promise<Response> {
  const authorization = request.headers.get("authorization")?.trim() || "";
  const upstream = await fetch(`${SUPPORT_API_ORIGIN}/api/support/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Support-Ticket-Owner": "vercel",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify({ messages: body.messages }),
  });
  const payload = (await upstream.json().catch(() => null)) as
    | (Record<string, unknown> & {
        autoCreateTicket?: unknown;
        ticketDraft?: TicketInput | null;
      })
    | null;
  if (!upstream.ok || !payload) {
    return json(
      payload || { error: "Support could not respond. Try again shortly." },
      upstream.status || 502
    );
  }
  if (payload.autoCreateTicket === true && payload.ticketDraft) {
    const ticket = await createTicket(request, config, {
      ...payload.ticketDraft,
      conversation: body.messages,
    });
    return json({ ...payload, ticketDraft: null, ticket });
  }
  return json(payload);
}

function errorResponse(error: unknown): Response {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const errors: Record<string, [string, number]> = {
    REQUEST_TOO_LARGE: ["The support request is too large.", 413],
    INVALID_BODY: ["Send a valid support request.", 400],
    INVALID_SESSION: ["Your session expired. Sign in again and retry.", 401],
    RATE_LIMITED: [
      `Too many support requests. Try again in an hour or email ${SUPPORT_EMAIL}.`,
      429,
    ],
    EMAIL_REQUIRED: ["Add a valid email so support can reply.", 400],
    SUBJECT_REQUIRED: ["Add a short ticket subject.", 400],
    DESCRIPTION_REQUIRED: [
      "Describe what happened and what you expected.",
      400,
    ],
    DATABASE_UNAVAILABLE: [
      `Ticket storage is temporarily unavailable. Email ${SUPPORT_EMAIL}.`,
      503,
    ],
  };
  const [message, status] = errors[code] || [
    `Support could not complete that request. Email ${SUPPORT_EMAIL}.`,
    500,
  ];
  return json({ error: message, supportEmail: SUPPORT_EMAIL }, status);
}

export async function handleSupport(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  const config = runtimeConfig();
  if (!config) {
    return json(
      { error: "Support configuration is incomplete.", supportEmail: SUPPORT_EMAIL },
      503
    );
  }
  try {
    const body = await requestBody(request);
    if (body.action === "chat") {
      return await proxySupportChat(request, config, body);
    }
    const ticket = await createTicket(request, config, body);
    return json({ ticket }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export default { fetch: handleSupport };
