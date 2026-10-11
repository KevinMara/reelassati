import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  SOUND_EFFECT_MODEL,
  soundEffectCredits,
} from "../contracts/audio-generation";
import { finishSoundEffectAudio } from "./music-generation";
import worker from "./server";
import {
  imageCreditCost,
  speechCreditCost,
  ELEVENLABS_LAUNCH_END_MS,
} from "../contracts/billing";

const sqlite = new DatabaseSync(":memory:");
let failFinalCacheWrite = false;
let failMeasuredSettlement = false;
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
      failMeasuredSettlement &&
      /UPDATE credit_ledger SET\s+amount = \?/i.test(this.sql)
    ) {
      failMeasuredSettlement = false;
      throw new Error("Simulated measured settlement failure");
    }
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
const providerRequests: Array<Record<string, unknown>> = [];
let providerGate: Promise<void> | undefined;
let providerFailure = false;
let soundResponse: (() => Response) | undefined;
const soundBytes = new Uint8Array(
  readFileSync(new URL("./__fixtures__/music-mp3-vbr.mp3", import.meta.url))
);
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
    : speechCreditCost(
        "A short original narration.".length,
        "English_Graceful_Lady"
      );

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
      providerRequests.push(JSON.parse(String(init?.body || "{}")));
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
      if (url.endsWith("/audio/transcriptions"))
        return Response.json({
          text: "Hello there",
          words: [
            { word: "Hello", start: 0.1, end: 0.4, speaker_label: "speaker_0" },
            { word: "there", start: 0.5, end: 0.9, speaker_label: "speaker_0" },
          ],
        });
      if (url.endsWith("/audio/speech"))
        if (providerRequests.at(-1)?.model === SOUND_EFFECT_MODEL)
          return soundResponse
            ? soundResponse()
            : new Response(soundBytes.slice(), {
                headers: { "Content-Type": "audio/mpeg" },
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
  it("bills Scribe from measured PCM duration and preserves actual word timestamps", async () => {
    const bytes = new Uint8Array(44 + 32000 * 61),
      v = new DataView(bytes.buffer);
    const label = (offset: number, text: string) =>
      bytes.set(new TextEncoder().encode(text), offset);
    label(0, "RIFF");
    v.setUint32(4, bytes.length - 8, true);
    label(8, "WAVE");
    label(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, 16000, true);
    v.setUint32(28, 32000, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    label(36, "data");
    v.setUint32(40, bytes.length - 44, true);
    objects.set("fixture-scribe.wav", bytes);
    sqlite
      .prepare(
        "INSERT INTO assets (id,owner_email,name,kind,content_type,bytes,r2_key,created_at) VALUES (?,?,?,?,?,?,?,?)"
      )
      .run(
        "scribe-source",
        "owner@example.com",
        "speech.wav",
        "audio",
        "audio/wav",
        bytes.length,
        "fixture-scribe.wav",
        new Date().toISOString()
      );
    const before = balance(),
      calls = providerCalls;
    const response = await request("/api/ai/transcribe", {
      assetId: "scribe-source",
      language: "en",
    });
    expect(response.status).toBe(200);
    expect(providerRequests.at(-1)).toMatchObject({
      model: "elevenlabs/scribe-v2",
      timestamp_granularities: ["word"],
      provider: {
        options: { elevenlabs: { diarize: true, tag_audio_events: false } },
      },
    });
    expect(balance()).toBe(before - 4);
    const result = (await response.json()) as {
      segments: Array<{ speaker: string; words: unknown }>;
    };
    expect(result.segments[0].words).toEqual([
      { text: "Hello", start: 0.1, end: 0.4 },
      { text: "there", start: 0.5, end: 0.9 },
    ]);
    expect(result.segments[0].speaker).toBe("speaker_0");
    expect(
      (
        await request("/api/ai/transcribe", {
          assetId: "scribe-source",
          audioAssetIds: ["scribe-source", "scribe-source"],
        })
      ).status
    ).toBe(422);
    sqlite
      .prepare(
        "UPDATE assets SET content_type='audio/mpeg' WHERE id='scribe-source'"
      )
      .run();
    expect(
      (await request("/api/ai/transcribe", { assetId: "scribe-source" })).status
    ).toBe(422);
    expect(providerCalls).toBe(calls + 1);
    expect(balance()).toBe(before - 4);
  });
  it("routes ElevenLabs voices to v4 Turbo at the shown price and replays without a second charge", async () => {
    const before = balance(),
      calls = providerCalls;
    const body = {
      ...payload("speech", "elevenlabs-speech-0123456789"),
      text: "x".repeat(1_000),
      voice: "sarah",
      acceptedCredits: speechCreditCost(1_000, "sarah"),
    };
    const first = await request("/api/ai/speech", body);
    expect(first.status).toBe(201);
    expect(providerRequests.at(-1)).toMatchObject({
      model: "elevenlabs/eleven-v4-turbo",
      voice: "sarah",
      response_format: "mp3",
    });
    expect(balance()).toBe(before - body.acceptedCredits);
    const output = await first.json();
    const again = await request("/api/ai/speech", body);
    expect(await again.json()).toEqual(output);
    expect(providerCalls).toBe(calls + 1);
    expect(balance()).toBe(before - body.acceptedCredits);
    const legacy = await request("/api/ai/speech", {
      ...payload("speech"),
      text: "x".repeat(1_000),
      acceptedCredits: 30,
    });
    expect(legacy.status).toBe(201);
    expect(providerRequests.at(-1)).toMatchObject({
      model: "minimax/speech-2.8-turbo",
      voice: "English_Graceful_Lady",
    });
    expect(balance()).toBe(before - body.acceptedCredits - 30);
  });
  it("rejects unpriced voices and stale quotes before provider usage or credit debit", async () => {
    const before = balance(),
      calls = providerCalls;
    expect(
      (
        await request("/api/ai/speech", {
          ...payload("speech"),
          voice: "sarah",
          acceptedCredits: 30,
        })
      ).status
    ).toBe(409);
    expect(
      (
        await request("/api/ai/speech", {
          ...payload("speech"),
          voice: "unknown-private-voice",
        })
      ).status
    ).toBe(422);
    expect(providerCalls).toBe(calls);
    expect(balance()).toBe(before);
  });

  it("rejects an expired launch quote before spending and accepts the reviewed regular rate", async () => {
    const before = balance(),
      calls = providerCalls;
    const clock = vi
      .spyOn(Date, "now")
      .mockReturnValue(ELEVENLABS_LAUNCH_END_MS);
    try {
      const body = {
        ...payload("speech"),
        text: "x".repeat(1_000),
        voice: "sarah",
        acceptedCredits: 10,
      };
      expect((await request("/api/ai/speech", body)).status).toBe(409);
      expect(providerCalls).toBe(calls);
      expect(balance()).toBe(before);
      const response = await request("/api/ai/speech", {
        ...body,
        acceptedCredits: 20,
      });
      expect(response.status).toBe(201);
      expect(providerCalls).toBe(calls + 1);
      expect(balance()).toBe(before - 20);
    } finally {
      clock.mockRestore();
    }
  });

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

const sfxPayload = (id: string) => ({
  kind: "sfx",
  seconds: 0.5,
  text: "A crisp original camera shutter",
  rightsConfirmed: true,
  requestId: id,
  acceptedCredits: 150,
});
describe("OpenRouter custom sound effects on the actual worker", () => {
  it("requires the accepted maximum balance before any paid provider call", async () => {
    const before = balance(),
      calls = providerCalls;
    const buckets = sqlite
      .prepare(
        "SELECT included_balance, topup_balance FROM credit_accounts WHERE owner_email='owner@example.com'"
      )
      .get()!;
    sqlite
      .prepare(
        "UPDATE credit_accounts SET included_balance=10, topup_balance=0 WHERE owner_email='owner@example.com'"
      )
      .run();
    try {
      expect(
        (
          await request(
            "/api/ai/audio",
            sfxPayload("seed-sfx-insufficient-0123456789")
          )
        ).status
      ).toBe(402);
      expect(providerCalls).toBe(calls);
      expect(balance()).toBe(10);
    } finally {
      sqlite
        .prepare(
          "UPDATE credit_accounts SET included_balance=?, topup_balance=? WHERE owner_email='owner@example.com'"
        )
        .run(buckets.included_balance, buckets.topup_balance);
    }
    expect(balance()).toBe(before);
  });
  it("quotes a maximum hold with an honest requested-duration estimate without calling a provider", async () => {
    const before = balance(),
      calls = providerCalls;
    const response = await request("/api/ai/audio/quote", {
      kind: "sfx",
      seconds: 5,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      credits: 150,
      estimatedCredits: 7,
      billing: "measured",
    });
    expect(providerCalls).toBe(calls);
    expect(balance()).toBe(before);
  });
  it("uses the existing key, omits voice/provider options, measures before trimming and returns the unused hold", async () => {
    const before = balance(),
      calls = providerCalls;
    const expected = soundEffectCredits(
      finishSoundEffectAudio(soundBytes.slice().buffer, 0.5).providerDuration
    );
    const body = sfxPayload("seed-sfx-success-0123456789");
    const response = await request("/api/ai/audio", body);
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result).toMatchObject({
      creditsCharged: expected,
      reservedCredits: 150,
      asset: {
        kind: "audio",
        contentType: "audio/mpeg",
        duration: 0.5,
        provenance: { origin: "ai-generated" },
      },
    });
    expect(providerRequests.at(-1)).toEqual({
      model: SOUND_EFFECT_MODEL,
      input: expect.stringContaining(body.text),
      response_format: "mp3",
    });
    expect(balance()).toBe(before - expected);
    expect((await request("/api/ai/audio", body)).status).toBe(409);
    expect(providerCalls).toBe(calls + 1);
    expect(balance()).toBe(before - expected);
    const asset = sqlite
      .prepare("SELECT owner_email, r2_key FROM assets WHERE id=?")
      .get(result.asset.id)!;
    expect(asset.owner_email).toBe("owner@example.com");
    expect(objects.has(String(asset.r2_key))).toBe(true);
    const ledger = sqlite
      .prepare(
        "SELECT amount, status, metadata_json FROM credit_ledger WHERE operation_key=?"
      )
      .get(`audio:owner@example.com:${body.requestId}`)!;
    expect(ledger.amount).toBe(-expected);
    expect(ledger.status).toBe("settled");
    expect(JSON.parse(String(ledger.metadata_json))).toMatchObject({
      reservedCredits: 150,
      measuredCredits: expected,
    });
  });
  it("rejects stale accepted cost and oversized prompts before spending", async () => {
    const before = balance(),
      calls = providerCalls;
    expect(
      (
        await request("/api/ai/audio", {
          ...sfxPayload("seed-sfx-stale-0123456789"),
          acceptedCredits: 7,
        })
      ).status
    ).toBe(409);
    expect(
      (
        await request("/api/ai/audio", {
          ...sfxPayload("seed-sfx-long-0123456789"),
          text: "x".repeat(2701),
        })
      ).status
    ).toBe(422);
    expect(providerCalls).toBe(calls);
    expect(balance()).toBe(before);
  });
  it.each(["provider", "invalid", "settlement"])(
    "returns the entire hold and releases no asset after %s failure",
    async failure => {
      const before = balance(),
        count = Number(
          sqlite.prepare("SELECT COUNT(*) AS n FROM assets").get()!.n
        );
      providerFailure = failure === "provider";
      soundResponse =
        failure === "invalid"
          ? () =>
              new Response("invalid", {
                headers: { "Content-Type": "audio/mpeg" },
              })
          : undefined;
      failMeasuredSettlement = failure === "settlement";
      try {
        const response = await request(
          "/api/ai/audio",
          sfxPayload(`seed-sfx-${failure}-0123456789`)
        );
        expect(response.status).toBeGreaterThanOrEqual(500);
        expect(balance()).toBe(before);
        expect(
          Number(sqlite.prepare("SELECT COUNT(*) AS n FROM assets").get()!.n)
        ).toBe(count);
      } finally {
        providerFailure = false;
        soundResponse = undefined;
        failMeasuredSettlement = false;
      }
    }
  );
  it("claims a duplicate concurrent request once while holding the full maximum", async () => {
    const before = balance(),
      calls = providerCalls;
    let resolve!: () => void;
    providerGate = new Promise<void>(r => {
      resolve = r;
    });
    const body = sfxPayload("seed-sfx-concurrent-0123456789");
    const first = request("/api/ai/audio", body);
    try {
      await vi.waitFor(() => expect(providerCalls).toBe(calls + 1));
      expect(balance()).toBe(before - 150);
      expect((await request("/api/ai/audio", body)).status).toBe(409);
      resolve();
      expect((await first).status).toBe(201);
      expect(providerCalls).toBe(calls + 1);
    } finally {
      resolve();
      providerGate = undefined;
    }
  });
});
