import type { BillingEnvironment } from "./billing";

export interface PaidMediaRequestControl {
  operationKey: string;
  prepareResponse(response: Response): Promise<void>;
}
type CachedMediaRequest = {
  fingerprint: string;
  status: string;
  body: string | null;
  http_status: number | null;
};
const json = (value: unknown, status: number) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
const cachedResponse = (row: CachedMediaRequest) =>
  new Response(row.body, {
    status: row.http_status || 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-REELassati-Replayed": "true",
    },
  });
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
async function hash(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(bytes), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

/** A durable claim prevents two tabs from purchasing the same generation, even before either receives its result. */
export async function runPaidMediaRequest(input: {
  db: BillingEnvironment["DB"];
  ownerKey: string;
  ownerEmail: string;
  route: "image" | "speech";
  requestId: unknown;
  payload: unknown;
  settle(reservation: {
    id: string;
    operationKey: string;
    cost: number;
  }): Promise<void>;
  execute(control: PaidMediaRequestControl): Promise<Response>;
}): Promise<Response> {
  const { db, ownerKey, ownerEmail, route } = input;
  if (
    typeof input.requestId !== "string" ||
    !/^[A-Za-z0-9-]{16,80}$/.test(input.requestId)
  )
    return json({ error: "A valid generation request ID is required." }, 422);
  const requestId = input.requestId;
  const fingerprint = await hash(stableJson(input.payload));
  const operationKey = `paid-media:${route}:${await hash(`${ownerKey}:${requestId}`)}`;
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS paid_media_requests (
    owner_key TEXT NOT NULL, route TEXT NOT NULL, request_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
    status TEXT NOT NULL, body TEXT, http_status INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY(owner_key, route, request_id)
  )`
    )
    .run();
  const now = new Date().toISOString();
  const claimed = await db
    .prepare(
      `INSERT INTO paid_media_requests
    (owner_key,route,request_id,fingerprint,status,created_at,updated_at) VALUES (?,?,?,?,'running',?,?) ON CONFLICT DO NOTHING`
    )
    .bind(ownerKey, route, requestId, fingerprint, now, now)
    .run();
  const complete = async (body: string, status: number) => {
    await db
      .prepare(
        `UPDATE paid_media_requests SET status='completed',body=?,http_status=?,updated_at=?
      WHERE owner_key=? AND route=? AND request_id=? AND fingerprint=?`
      )
      .bind(
        body,
        status,
        new Date().toISOString(),
        ownerKey,
        route,
        requestId,
        fingerprint
      )
      .run();
  };
  if (!claimed.meta?.changes) {
    const row = await db
      .prepare(
        "SELECT fingerprint,status,body,http_status FROM paid_media_requests WHERE owner_key=? AND route=? AND request_id=?"
      )
      .bind(ownerKey, route, requestId)
      .first<CachedMediaRequest>();
    if (!row || row.fingerprint !== fingerprint)
      return json(
        {
          error:
            "This generation request ID was already used with different input.",
        },
        409
      );
    if (row.status === "completed" && row.body) return cachedResponse(row);
    // The output is persisted before settlement. A lost final response can finalize the same debit without regenerating.
    if (row.body) {
      const reservation = await db
        .prepare(
          "SELECT id,amount,status FROM credit_ledger WHERE owner_email=? AND operation_key=?"
        )
        .bind(ownerEmail, operationKey)
        .first<{ id: string; amount: number; status: string }>();
      if (
        reservation &&
        Number.isSafeInteger(reservation.amount) &&
        reservation.amount < 0 &&
        ["reserved", "settled"].includes(reservation.status)
      ) {
        if (reservation.status === "reserved")
          await input.settle({
            id: reservation.id,
            operationKey,
            cost: -reservation.amount,
          });
        await complete(row.body, row.http_status || 201);
        return cachedResponse(row);
      }
    }
    return row.status === "running"
      ? json(
          {
            error:
              "This generation is already running. Check its saved result without starting another generation.",
            requestInProgress: true,
          },
          409
        )
      : json(
          {
            error:
              "This generation request did not complete. Check Library before starting a new request. No automatic retry was made.",
            previousRequestFailed: true,
          },
          409
        );
  }
  try {
    const response = await input.execute({
      operationKey,
      prepareResponse: async response => {
        if (!response.ok) return;
        await db
          .prepare(
            `UPDATE paid_media_requests SET body=?,http_status=?,updated_at=?
        WHERE owner_key=? AND route=? AND request_id=? AND fingerprint=? AND status='running'`
          )
          .bind(
            await response.clone().text(),
            response.status,
            new Date().toISOString(),
            ownerKey,
            route,
            requestId,
            fingerprint
          )
          .run();
      },
    });
    await complete(await response.clone().text(), response.status);
    return response;
  } catch (cause) {
    if (cause instanceof Response) {
      await complete(await cause.clone().text(), cause.status);
      return cause;
    }
    await db
      .prepare(
        `UPDATE paid_media_requests SET status='failed',updated_at=? WHERE owner_key=? AND route=? AND request_id=? AND fingerprint=?`
      )
      .bind(new Date().toISOString(), ownerKey, route, requestId, fingerprint)
      .run()
      .catch(() => undefined);
    throw cause;
  }
}
