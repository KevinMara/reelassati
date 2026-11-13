import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { catalogVisualEvidence } from "./catalog-visual-evidence";
import { catalogEvidenceKey, catalogSoundKey } from "./catalog-evidence";
import {
  handleCatalogAdmin,
  handleCatalogPublic,
  initializeSharedCatalog,
  searchSharedCatalog,
  sharedCatalogCandidates,
  copySharedCatalogMedia,
  catalogChunkStream,
  type CatalogEnvironment,
} from "./shared-media-catalog";
import {
  normalizeSharedCatalogItem,
  CATALOG_CHUNK_BYTES,
  catalogChunkLength,
  sharedCatalogPlacement,
  type SharedMediaCatalogItem,
} from "../contracts/shared-media-catalog";

const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const media = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]),
  poster = new Uint8Array([10, 11, 12]);
const object = (
  bytes: Uint8Array,
  extension: string,
  contentType: "video/mp4" | "image/png"
) => ({
  file: `media/${digest(bytes)}.${extension}`,
  sha256: digest(bytes),
  bytes: bytes.length,
  contentType,
});
const item: SharedMediaCatalogItem = {
  id: `stock-${digest(media).slice(0, 24)}`,
  name: "Quiet frame",
  group: "Film frames",
  designId: "design-film-frame",
  variant: "1920 × 1080",
  kind: "video",
  tags: ["film", "frame"],
  duration: 1,
  width: 1920,
  height: 1080,
  blendMode: "screen",
  media: object(media, "mp4", "video/mp4"),
  poster: object(poster, "png", "image/png"),
  license: "platform-licensed",
  credits: 0,
};
let sqlite: DatabaseSync, env: CatalogEnvironment;
let worker: (typeof import("./server"))["default"];
let objects: Map<
  string,
  { data: Uint8Array; metadata?: Record<string, string> }
>;
beforeEach(async () => {
  // Node needs a length-enforcing stand-in. The separate workerd regression
  // exercises the native FixedLengthStream brand required by the real R2 API.
  vi.stubGlobal(
    "FixedLengthStream",
    class extends TransformStream<Uint8Array, Uint8Array> {
      constructor(length: number) {
        let received = 0;
        super({
          transform(chunk, controller) {
            received += chunk.byteLength;
            if (received > length)
              throw new TypeError("Stream exceeds its declared length.");
            controller.enqueue(chunk);
          },
          flush() {
            if (received !== length)
              throw new TypeError(
                "Stream is shorter than its declared length."
              );
          },
        });
      }
    }
  );
  // Each fixture owns a fresh database; reset the worker's one-binding schema
  // initialization cache alongside it, as a new worker isolate would.
  vi.resetModules();
  worker = (await import("./server")).default;
  sqlite = new DatabaseSync(":memory:");
  objects = new Map();
  class Statement {
    values: unknown[] = [];
    sql: string;
    constructor(sql: string) {
      this.sql = sql;
    }
    bind(...values: unknown[]) {
      this.values = values;
      return this;
    }
    async first<T>() {
      return (sqlite.prepare(this.sql).get(...(this.values as never[])) ||
        null) as T | null;
    }
    async all<T>() {
      return {
        results: sqlite
          .prepare(this.sql)
          .all(...(this.values as never[])) as T[],
        success: true,
      };
    }
    async run() {
      const result = sqlite.prepare(this.sql).run(...(this.values as never[]));
      return { success: true, meta: { changes: Number(result.changes) } };
    }
  }
  env = {
    DB: {
      prepare: sql => new Statement(sql),
      batch: async statements => {
        sqlite.exec("BEGIN");
        try {
          const results = [];
          for (const statement of statements)
            results.push(await statement.run());
          sqlite.exec("COMMIT");
          return results;
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        }
      },
    },
    BUCKET: {
      put: async (key, body, options) => {
        const data = new Uint8Array(
          await new Response(body as BodyInit).arrayBuffer()
        );
        objects.set(key, { data, metadata: options?.customMetadata });
      },
      get: async (key, options) => {
        const value = objects.get(key);
        if (!value) return null;
        const range = options?.range;
        const data = range
          ? value.data.slice(
              range.offset,
              range.length ? range.offset + range.length : undefined
            )
          : value.data;
        return {
          body: new Blob([data]).stream(),
          size: value.data.length,
          httpEtag: '"test"',
          customMetadata: value.metadata,
        };
      },
      delete: async key => {
        objects.delete(key);
      },
    },
  };
  await initializeSharedCatalog(env);
});
afterEach(() => {
  sqlite.close();
  vi.unstubAllGlobals();
});
async function admin(
  path: string,
  method = "GET",
  body?: BodyInit,
  owner = true
) {
  const request = new Request(`https://studio.test/api/catalog/admin/${path}`, {
    method,
    ...(body ? { body } : {}),
  });
  try {
    return await handleCatalogAdmin(request, env, new URL(request.url), owner);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}
async function stage() {
  expect(
    (
      await admin(
        "manifest",
        "POST",
        JSON.stringify({ schemaVersion: 1, items: [item] })
      )
    ).status
  ).toBe(200);
}
async function publish() {
  await stage();
  expect((await admin(`object/${item.id}/media`, "PUT", media)).status).toBe(
    200
  );
  expect((await admin(`object/${item.id}/poster`, "PUT", poster)).status).toBe(
    200
  );
}
describe("verified chunked catalog import", () => {
  it("keeps evidence readiness unpublished after an interrupted batch and resumes from stored objects", async () => {
    await publish();
    const second = {
      ...item,
      id: `stock-${"b".repeat(24)}`,
      media: {
        ...item.media,
        sha256: "b".repeat(64),
        file: `media/${"b".repeat(64)}.mp4`,
      },
    };
    sqlite
      .prepare(
        "INSERT INTO shared_media_catalog(id,name,group_name,design_id,kind,search_text,payload,media_ready,poster_ready,status,created_at) SELECT ?,name,group_name,design_id,kind,search_text,?,1,1,'ready',created_at FROM shared_media_catalog WHERE id=?"
      )
      .run(second.id, JSON.stringify(second), item.id);
    const jpg = Uint8Array.from([255, 216, 0, 0, 0, 0, 255, 217]);
    const packets = [item, second].map(source => ({
      schemaVersion: 1,
      catalogId: source.id,
      mediaSha256: source.media.sha256,
      kind: "video",
      duration: 1,
      visual: {
        data: Buffer.from(jpg).toString("base64"),
        sha256: digest(jpg),
        contentType: "image/jpeg",
        bytes: jpg.length,
        width: 240,
        height: 180,
        columns: 1,
        frameTimes: [0, 0.2, 0.5, 0.9],
        sourceWidth: 1920,
        sourceHeight: 1080,
        coverage: "sampled-motion",
      },
    }));
    const put = env.BUCKET.put;
    env.BUCKET.put = async (key, body, options) => {
      if (key === `catalog-evidence/v1/${second.media.sha256}.json`)
        throw new Error("storage unavailable");
      return put(key, body, options);
    };
    await expect(
      admin("evidence", "POST", JSON.stringify(packets))
    ).rejects.toThrow("storage unavailable");
    expect(objects.has(`catalog-evidence/v1/${item.media.sha256}.json`)).toBe(
      true
    );
    expect(
      sqlite
        .prepare("SELECT COUNT(*) AS count FROM shared_catalog_evidence")
        .get()?.count
    ).toBe(0);
    env.BUCKET.put = put;
    expect(
      (await admin("evidence", "POST", JSON.stringify(packets))).status
    ).toBe(200);
    expect(
      sqlite
        .prepare(
          "SELECT COUNT(*) AS count FROM shared_catalog_evidence WHERE evidence_ready=1"
        )
        .get()?.count
    ).toBe(2);
  });
  it("keeps evidence owner-only and checks published identity and media digests before storing", async () => {
    await publish();
    const jpg = Uint8Array.from([255, 216, 0, 0, 0, 0, 255, 217]);
    const packet = {
      schemaVersion: 1,
      catalogId: item.id,
      mediaSha256: item.media.sha256,
      kind: "video",
      duration: 1,
      visual: {
        data: Buffer.from(jpg).toString("base64"),
        sha256: digest(jpg),
        contentType: "image/jpeg",
        bytes: jpg.length,
        width: 240,
        height: 180,
        columns: 1,
        frameTimes: [0, 0.2, 0.5, 0.9],
        sourceWidth: 1920,
        sourceHeight: 1080,
        coverage: "sampled-motion",
      },
    };
    expect(
      (await admin("evidence", "POST", JSON.stringify([packet]), false)).status
    ).toBe(403);
    expect(
      (
        await admin(
          "evidence",
          "POST",
          JSON.stringify([{ ...packet, mediaSha256: "b".repeat(64) }])
        )
      ).status
    ).toBe(422);
    expect(objects.has(`catalog-evidence/v1/${item.media.sha256}.json`)).toBe(
      false
    );
    expect(
      (await admin("evidence", "POST", JSON.stringify([packet]))).status
    ).toBe(200);
    expect((await admin(`evidence-status?ids=${item.id}`)).status).toBe(200);
    expect(
      await (await admin(`evidence-status?ids=${item.id}`)).json()
    ).toEqual({
      items: [
        {
          id: item.id,
          ready: true,
          soundReviewed: false,
          visualReviewed: false,
        },
      ],
    });
    expect(
      (
        await admin(
          "evidence",
          "POST",
          JSON.stringify([
            {
              ...packet,
              visual: {
                ...packet.visual,
                data: Buffer.alloc(8).toString("base64"),
              },
            },
          ])
        )
      ).status
    ).toBe(422);
  });
  it("keeps staged parts private and publishes only after full-file verification and poster completion", async () => {
    await stage();
    expect(
      (await admin(`object/${item.id}/media/chunks/0`, "PUT", media)).status
    ).toBe(200);
    expect(objects.has(`shared-catalog/${item.media.file}`)).toBe(false);
    expect(
      sqlite
        .prepare("SELECT status FROM shared_media_catalog WHERE id = ?")
        .get(item.id)
    ).toMatchObject({ status: "pending" });
    expect(
      (await admin(`object/${item.id}/media/complete`, "POST")).status
    ).toBe(200);
    expect(objects.get(`shared-catalog/${item.media.file}`)?.data).toEqual(
      media
    );
    expect(
      [...objects.keys()].some(key => key.startsWith("shared-catalog-parts/"))
    ).toBe(false);
    expect(
      sqlite
        .prepare("SELECT status FROM shared_media_catalog WHERE id = ?")
        .get(item.id)
    ).toMatchObject({ status: "pending" });
    expect(
      (await admin(`object/${item.id}/poster`, "PUT", poster)).status
    ).toBe(200);
    expect(
      sqlite
        .prepare("SELECT status FROM shared_media_catalog WHERE id = ?")
        .get(item.id)
    ).toMatchObject({ status: "ready" });
    // A lost completion response can be retried after the parts were removed.
    expect(
      (await admin(`object/${item.id}/media/complete`, "POST")).status
    ).toBe(200);
  });

  it("rejects missing, out-of-range and corrupt parts without marking the item ready", async () => {
    await stage();
    expect(
      (await admin(`object/${item.id}/media/complete`, "POST")).status
    ).toBe(409);
    expect(
      (await admin(`object/${item.id}/media/chunks/1`, "PUT", media)).status
    ).toBe(422);
    expect(
      (
        await admin(
          `object/${item.id}/media/chunks/0`,
          "PUT",
          new Uint8Array(media.length)
        )
      ).status
    ).toBe(200);
    expect(
      (await admin(`object/${item.id}/media/complete`, "POST")).status
    ).toBe(422);
    expect(objects.has(`shared-catalog/${item.media.file}`)).toBe(false);
    expect(
      sqlite
        .prepare(
          "SELECT media_ready, status FROM shared_media_catalog WHERE id = ?"
        )
        .get(item.id)
    ).toMatchObject({ media_ready: 0, status: "pending" });
    expect(
      (await admin(`object/${item.id}/media/chunks/0`, "PUT", media)).status
    ).toBe(200);
    expect(
      (await admin(`object/${item.id}/media/complete`, "POST")).status
    ).toBe(200);
  });

  it("assembles multiple parts in order with bounded reads and exact final length", async () => {
    const bytes = CATALOG_CHUNK_BYTES * 2 + 3;
    const staged = { ...item.media, bytes };
    const read: number[] = [];
    const streamingEnvironment = {
      ...env,
      BUCKET: {
        ...env.BUCKET,
        get: async (key: string) => {
          const index = Number(key.split("/").pop());
          read.push(index);
          const data = new Uint8Array(catalogChunkLength(bytes, index)).fill(
            index + 1
          );
          return {
            body: new Blob([data]).stream(),
            size: data.length,
            httpEtag: "test",
          };
        },
      },
    };
    const result = new Uint8Array(
      await new Response(
        catalogChunkStream(
          streamingEnvironment,
          staged,
          new AbortController().signal
        )
      ).arrayBuffer()
    );
    expect(read).toEqual([0, 1, 2]);
    expect(result.length).toBe(bytes);
    expect([result[0], result[CATALOG_CHUNK_BYTES], result[bytes - 1]]).toEqual(
      [1, 2, 3]
    );
  });

  it("checks cancellation before reading another stored part", async () => {
    const control = new AbortController();
    control.abort(new DOMException("Stopped", "AbortError"));
    const get = vi.spyOn(env.BUCKET, "get");
    await expect(
      new Response(
        catalogChunkStream(env, item.media, control.signal)
      ).arrayBuffer()
    ).rejects.toThrow("Stopped");
    expect(get).not.toHaveBeenCalled();
    await stage();
    expect(
      (await admin(`object/${item.id}/media/chunks/0`, "PUT", media, false))
        .status
    ).toBe(403);
    expect(
      (
        await admin(
          `object/${item.id}/media/complete`,
          "POST",
          undefined,
          false
        )
      ).status
    ).toBe(403);
  });
});
describe("shared catalog owner authorization", () => {
  const catalogOwner = "catalog@example.com";
  const operatorOwner = "operator@example.com";
  function setup(includeCatalogOwner = true) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        if (!String(url).startsWith("https://auth.test/auth/v1/user"))
          throw new Error(
            "Only the deterministic authentication stub is allowed"
          );
        return Response.json({
          email: (
            new Headers(init?.headers).get("Authorization") || ""
          ).replace("Bearer ", ""),
        });
      })
    );
    const environment = {
      ...env,
      SUPABASE_URL: "https://auth.test",
      SUPABASE_PUBLISHABLE_KEY: "test",
      COMPLIANCE_OPERATOR_OWNER_EMAIL: operatorOwner,
      ...(includeCatalogOwner
        ? { SHARED_CATALOG_OWNER_EMAIL: `  ${catalogOwner.toUpperCase()}  ` }
        : {}),
      ASSETS: { fetch: async () => new Response("static") },
    };
    return (path: string, email: string | null, init: RequestInit = {}) =>
      worker.fetch(
        new Request(`https://studio.test${path}`, {
          ...init,
          headers: {
            ...(email ? { Authorization: `Bearer ${email}` } : {}),
            ...Object.fromEntries(new Headers(init.headers)),
          },
        }),
        environment as never
      );
  }
  it("allows the dedicated catalog owner to publish without granting compliance operations", async () => {
    const request = setup();
    const capability = await request("/api/capabilities", catalogOwner);
    expect(capability.status).toBe(200);
    expect(await capability.json()).toMatchObject({
      capabilities: { sharedCatalogAdmin: true, operations: false },
    });
    expect(
      (await request(`/api/catalog/admin/status?ids=${item.id}`, catalogOwner))
        .status
    ).toBe(200);
    const manifest = await request(
      "/api/catalog/admin/manifest",
      catalogOwner,
      {
        method: "POST",
        body: JSON.stringify({ schemaVersion: 1, items: [item] }),
        headers: { "Content-Type": "application/json" },
      }
    );
    expect(manifest.status).toBe(200);
    expect(
      (
        await request(
          `/api/catalog/admin/object/${item.id}/media`,
          catalogOwner,
          { method: "PUT", body: media }
        )
      ).status
    ).toBe(200);
    expect(
      (
        await request(
          `/api/catalog/admin/object/${item.id}/poster`,
          catalogOwner,
          { method: "PUT", body: poster }
        )
      ).status
    ).toBe(200);
    expect(
      (await request(`/api/catalog/admin/status?ids=${item.id}`, catalogOwner))
        .status
    ).toBe(200);
    expect((await request("/api/operations", catalogOwner)).status).toBe(403);
    expect(
      (
        await request("/api/operations/services", catalogOwner, {
          method: "POST",
        })
      ).status
    ).toBe(403);
    expect(
      (
        await request("/api/compliance/ai-literacy", catalogOwner, {
          method: "POST",
          body: JSON.stringify({ acknowledged: true }),
          headers: { "Content-Type": "application/json" },
        })
      ).status
    ).toBe(403);
  });
  it.each([true, false])(
    "preserves the existing operator's catalog access with dedicated owner configured=%s",
    async configured => {
      const request = setup(configured);
      const capability = await request("/api/capabilities", operatorOwner);
      expect(await capability.json()).toMatchObject({
        capabilities: { sharedCatalogAdmin: true, operations: true },
      });
      expect(
        (
          await request(
            `/api/catalog/admin/status?ids=${item.id}`,
            operatorOwner
          )
        ).status
      ).toBe(200);
      expect(
        (
          await request("/api/catalog/admin/manifest", operatorOwner, {
            method: "POST",
            body: JSON.stringify({ schemaVersion: 1, items: [item] }),
          })
        ).status
      ).toBe(200);
    }
  );
  it.each(["member@example.com", null])(
    "denies catalog status and mutations to an ordinary or anonymous caller: %s",
    async email => {
      const request = setup();
      const denied = email ? 403 : 401;
      const capability = await request("/api/capabilities", email);
      if (email)
        expect(await capability.json()).toMatchObject({
          capabilities: { sharedCatalogAdmin: false, operations: false },
        });
      else expect(capability.status).toBe(401);
      expect(
        (await request(`/api/catalog/admin/status?ids=${item.id}`, email))
          .status
      ).toBe(denied);
      expect(
        (
          await request("/api/catalog/admin/manifest", email, {
            method: "POST",
            body: JSON.stringify({ schemaVersion: 1, items: [item] }),
          })
        ).status
      ).toBe(denied);
      expect(
        (
          await request(`/api/catalog/admin/object/${item.id}/media`, email, {
            method: "PUT",
            body: media,
          })
        ).status
      ).toBe(denied);
      expect(objects.size).toBe(0);
      expect(
        sqlite
          .prepare("SELECT COUNT(*) AS count FROM shared_media_catalog")
          .get()!.count
      ).toBe(0);
    }
  );
  it("uses the authenticated bearer identity rather than a claimed catalog-owner header", async () => {
    const request = setup();
    const response = await request(
      `/api/catalog/admin/status?ids=${item.id}`,
      "member@example.com",
      { headers: { "oai-authenticated-user-email": catalogOwner } }
    );
    expect(response.status).toBe(403);
  });
});
describe("shared catalog verified publication", () => {
  it("reserves candidate slots for current reviewed sounds before design and group balancing", async () => {
    const seed = (index: number, name: string, designId = `sound-${index}`) => {
      const hash = digest(new TextEncoder().encode(`sound-${index}`));
      const candidate = normalizeSharedCatalogItem({
        id: `stock-${hash.slice(0, 24)}`,
        name,
        group: "Signals",
        tags: ["bell"],
        designId,
        variant: "Original",
        kind: "audio",
        duration: 20,
        waveform: Array(64).fill(0.5),
        media: {
          file: `media/${hash}.wav`,
          sha256: hash,
          bytes: 16,
          contentType: "audio/wav",
        },
        license: "platform-licensed",
        credits: 0,
      });
      sqlite
        .prepare(
          "INSERT INTO shared_media_catalog (id,name,group_name,design_id,kind,search_text,payload,media_ready,poster_ready,status,created_at) VALUES (?,?,?,?,?,?,?,1,1,'ready','test')"
        )
        .run(
          candidate.id,
          name,
          candidate.group,
          designId,
          "audio",
          "bell",
          JSON.stringify(candidate)
        );
      return candidate;
    };
    // These rank ahead of the usable sound by name and previously fill all
    // sixty slots before the later evidence gate drops them without refill.
    for (let index = 0; index < 60; index++)
      seed(index, `A unreviewed ${index}`);
    const unavailableVariant = seed(
      60,
      "A unreviewed variant",
      "reviewed-design"
    );
    const usable = seed(61, "Z reviewed bell", "reviewed-design");
    const sample = new Uint8Array([73, 68, 51, 0, 0, 0, 0, 0]);
    const sampleSha = digest(sample);
    const putIndex = (
      candidate: SharedMediaCatalogItem,
      mediaSha = candidate.media.sha256,
      sampleHash = sampleSha,
      evidenceReady = 1,
      soundReviewed = 1
    ) =>
      sqlite
        .prepare(
          "INSERT INTO shared_catalog_evidence(id,media_sha,sample_sha,evidence_ready,sound_reviewed) VALUES(?,?,?,?,?)"
        )
        .run(candidate.id, mediaSha, sampleHash, evidenceReady, soundReviewed);
    putIndex(usable);
    putIndex(
      unavailableVariant,
      unavailableVariant.media.sha256,
      sampleSha,
      1,
      0
    );
    putIndex(seed(62, "A stale source"), "f".repeat(64));
    putIndex(seed(63, "A missing sample"), undefined, "");
    putIndex(seed(64, "A unfinished evidence"), undefined, undefined, 0);
    const audio = {
      data: Buffer.from(sample).toString("base64"),
      sha256: sampleSha,
      bytes: sample.length,
      contentType: "audio/mpeg",
      segments: [{ sourceStart: 0, sourceEnd: 20, sampleStart: 0 }],
      coverage: "complete-audio",
      measured: {
        duration: 20,
        peakDb: -3,
        rmsDb: -12,
        activeStart: 0,
        activeEnd: 20,
        onsets: [0],
        envelope: Array(64).fill(0.5),
      },
    };
    const save = (key: string, value: unknown) =>
      objects.set(key, {
        data: new TextEncoder().encode(JSON.stringify(value)),
      });
    save(catalogEvidenceKey(usable.media.sha256), {
      schemaVersion: 1,
      catalogId: usable.id,
      mediaSha256: usable.media.sha256,
      kind: "audio",
      duration: 20,
      audio,
    });
    save(catalogSoundKey(usable.media.sha256), {
      schemaVersion: 1,
      mediaSha256: usable.media.sha256,
      sampleSha256: sampleSha,
      character: "Soft bell",
      role: "effect",
      audibleEvents: ["Bell ring"],
      suitableUses: ["A quiet reveal"],
      avoidUses: [],
      containsSpeech: false,
      intensity: "subtle",
      confidence: 0.95,
      coverage: "complete-audio",
    });
    const readObject = vi.spyOn(env.BUCKET, "get");
    const candidates = await sharedCatalogCandidates(env, "bell");
    expect(readObject).not.toHaveBeenCalled();
    expect(candidates.map(candidate => candidate.id)).toEqual([usable.id]);
    const verified = await catalogVisualEvidence(
      env,
      candidates,
      new AbortController().signal
    );
    expect(verified.items).toEqual([usable]);
    // Eligibility is automatic-planning policy, never a manual library filter.
    const browse = await searchSharedCatalog(env, { kind: "audio" });
    expect(browse.total).toBe(64);
    expect(
      browse.items.some(candidate => candidate.name.startsWith("A unreviewed"))
    ).toBe(true);
  });

  it("grounds a long automatic command in source evidence and balances media kinds across a large look library", async () => {
    const seed = (
      number: number,
      kind: "audio" | "image" | "video" | "lut",
      name: string,
      group: string,
      tags: string[],
      designId = `design-${number}`,
      width = 1920,
      height = 1080
    ) => {
      const hash = digest(new TextEncoder().encode(String(number)));
      const extension = {
        audio: "wav",
        image: "png",
        video: "mp4",
        lut: "cube",
      }[kind];
      const contentType = {
        audio: "audio/wav",
        image: "image/png",
        video: "video/mp4",
        lut: "application/x-cube",
      }[kind];
      const candidate = normalizeSharedCatalogItem({
        id: `stock-${hash.slice(0, 24)}`,
        name,
        group,
        tags,
        designId,
        variant: kind === "lut" ? "3D · 2" : "Measured variant",
        kind,
        duration: kind === "lut" ? 0 : 1,
        media: {
          file: `media/${hash}.${extension}`,
          sha256: hash,
          bytes: 8,
          contentType,
        },
        ...(kind === "lut"
          ? {
              lut: {
                dimension: 3,
                size: 2,
                domainMin: [0, 0, 0],
                domainMax: [1, 1, 1],
              },
            }
          : kind === "audio"
            ? { waveform: Array.from({ length: 64 }, (_, i) => i % 2) }
            : { width, height, blendMode: "normal", poster: item.poster }),
        license: "platform-licensed",
        credits: 0,
      });
      sqlite
        .prepare(
          "INSERT INTO shared_media_catalog (id,name,group_name,design_id,kind,search_text,payload,media_ready,poster_ready,status,created_at) VALUES (?,?,?,?,?,?,?,1,1,'ready','test')"
        )
        .run(
          candidate.id,
          name,
          group,
          designId,
          kind,
          [name, group, ...tags].join(" ").toLowerCase(),
          JSON.stringify(candidate)
        );
      if (kind === "audio")
        sqlite
          .prepare(
            "INSERT INTO shared_catalog_evidence(id,media_sha,sample_sha,evidence_ready,sound_reviewed) VALUES(?,?,?,1,1)"
          )
          .run(candidate.id, hash, "a".repeat(64));
      return candidate;
    };
    for (let i = 0; i < 1500; i++)
      seed(i, "lut", `Lifestyle ${i}`, "Lifestyle color", ["lifestyle"]);
    for (let i = 1500; i < 1650; i++)
      seed(
        i,
        "video",
        `CRT ${i}`,
        "CRT graphics",
        ["crt"],
        `design-crt-${Math.floor(i / 3)}`
      );
    for (let i = 1650; i < 1680; i++)
      seed(i, "image", `Still ${i}`, "Clean stills", ["clean"]);
    for (let i = 1680; i < 1710; i++)
      seed(i, "audio", `Cue ${i}`, "Soft cues", ["soft"]);
    const sourceVideo = seed(
      1800,
      "video",
      "Brain scan",
      "Medical illustrations",
      ["brain", "scan"],
      "design-brain",
      720,
      1280
    );
    seed(
      1801,
      "video",
      "Brain scan wide",
      "Medical illustrations",
      ["brain", "scan"],
      "design-brain",
      1920,
      1080
    );
    const sourceImage = seed(
      1802,
      "image",
      "Balloon diagram",
      "Explanatory diagrams",
      ["balloon"]
    );
    const sourceSound = seed(1803, "audio", "Balloon pop", "Object sounds", [
      "balloon",
      "pop",
    ]);
    const preferredLook = seed(
      1804,
      "lut",
      "Warm editorial",
      "Editorial color",
      ["warm", "editorial"]
    );
    const candidates = await sharedCatalogCandidates(
      env,
      "Autonomous complete edit. Style: choose the treatment from actual footage speech audience. " +
        "Preserve every complete scene and produce a professional edit. ".repeat(
          30
        ),
      [],
      {
        sourceText: ["A balloon illustrates brain health scores."],
        styleText: ["Warm editorial"],
        aspectRatio: "9:16",
      }
    );
    const ids = candidates.map(candidate => candidate.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        sourceVideo.id,
        sourceImage.id,
        sourceSound.id,
        preferredLook.id,
      ])
    );
    expect(
      candidates.filter(candidate => candidate.designId === "design-brain")
    ).toEqual([sourceVideo]);
    const mediaCandidates = candidates.filter(
      candidate => candidate.kind !== "lut"
    );
    expect(
      new Set(mediaCandidates.map(candidate => candidate.designId)).size
    ).toBe(mediaCandidates.length);
    expect(
      mediaCandidates.filter(candidate => candidate.kind === "audio")
    ).toHaveLength(20);
    expect(
      mediaCandidates.filter(candidate => candidate.kind === "image")
    ).toHaveLength(20);
    expect(
      mediaCandidates.filter(candidate => candidate.kind === "video")
    ).toHaveLength(20);
    expect(candidates.find(candidate => candidate.kind === "lut")?.id).toBe(
      preferredLook.id
    );
  });
  it("retains catalog identity after an import response without a client save, and retries reuse that owned asset", async () => {
    await publish();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) =>
        Response.json({
          email: (
            new Headers(init?.headers).get("Authorization") || ""
          ).replace("Bearer ", ""),
        })
      )
    );
    const environment = {
      ...env,
      SUPABASE_URL: "https://auth.test",
      SUPABASE_PUBLISHABLE_KEY: "test",
      ASSETS: { fetch: async () => new Response("static") },
    };
    const request = (
      path: string,
      method = "GET",
      body?: unknown,
      email = "member@example.com"
    ) =>
      worker.fetch(
        new Request(`https://studio.test${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${email}`,
            "Content-Type": "application/json",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
        environment as never
      );
    const first = await request("/api/catalog/import", "POST", { id: item.id });
    expect(first.status).toBe(200);
    const asset = (await first.json()) as { id: string };
    // Simulate a disconnected client: deliberately omit PUT /api/workspace.
    const replay = await request("/api/catalog/import", "POST", {
      id: item.id,
    });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({
      id: asset.id,
      catalog: { id: item.id, blendMode: "screen" },
      duration: 1,
      width: 1920,
      height: 1080,
      variantGroupId: `shared-catalog:${item.id}`,
    });
    const workspace = await request("/api/workspace");
    expect(workspace.status).toBe(200);
    expect(
      ((await workspace.json()) as { workspace: { assets: unknown[] } })
        .workspace.assets
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: asset.id,
          catalog: expect.objectContaining({ id: item.id }),
          duration: 1,
        }),
      ])
    );
    expect(
      sqlite.prepare("SELECT COUNT(*) AS count FROM assets").get()!.count
    ).toBe(1);
    const other = await request(
      "/api/catalog/import",
      "POST",
      { id: item.id },
      "other@example.com"
    );
    expect(other.status).toBe(200);
    expect(((await other.json()) as { id: string }).id).not.toBe(asset.id);
  });
  it("requires the owner and rejects private provenance, unknown paths and forged media identities", async () => {
    for (const body of ["null", "[]", "42"])
      expect((await admin("manifest", "POST", body)).status).toBe(422);
    expect((await admin("manifest", "POST", "{}", false)).status).toBe(403);
    for (const invalid of [
      { ...item, sourceArchive: "private.zip" },
      { ...item, name: "Four Editors film" },
      { ...item, media: { ...item.media, file: "../../secret.mp4" } },
      { ...item, id: "stock-000000000000000000000000" },
    ])
      expect(
        (
          await admin(
            "manifest",
            "POST",
            JSON.stringify({ schemaVersion: 1, items: [invalid] })
          )
        ).status
      ).toBe(422);
    expect(objects.size).toBe(0);
  });
  it("returns mixed ready, pending and missing batch entries in the requested order", async () => {
    await stage();
    await admin(`object/${item.id}/media`, "PUT", media);
    await admin(`object/${item.id}/poster`, "PUT", poster);
    const secondMedia = new Uint8Array([81, 82, 83]);
    const pending = {
      ...item,
      id: `stock-${digest(secondMedia).slice(0, 24)}`,
      media: object(secondMedia, "mp4", "video/mp4"),
    };
    await admin(
      "manifest",
      "POST",
      JSON.stringify({ schemaVersion: 1, items: [pending] })
    );
    const missing = "stock-" + "c".repeat(24);
    expect(
      await (
        await admin(
          `status?ids=${pending.id},${missing},${item.id},${pending.id}`
        )
      ).json()
    ).toEqual({
      items: [
        { id: pending.id, status: "pending", missingObjects: ["media"] },
        { id: missing, status: "missing", missingObjects: ["media", "poster"] },
        { id: item.id, status: "ready", missingObjects: [] },
      ],
    });
    expect(await (await admin("status?ids=")).json()).toEqual({ items: [] });
  });
  it("groups a valid design named constructor without inheriting object properties", async () => {
    const publicItem = { ...item, designId: "constructor" };
    expect(
      (
        await admin(
          "manifest",
          "POST",
          JSON.stringify({ schemaVersion: 1, items: [publicItem] })
        )
      ).status
    ).toBe(200);
    await admin(`object/${item.id}/media`, "PUT", media);
    await admin(`object/${item.id}/poster`, "PUT", poster);
    expect((await searchSharedCatalog(env)).variants.constructor).toEqual([
      normalizeSharedCatalogItem(publicItem),
    ]);
  });
  it("publishes only after exact media and poster bytes, supports explicit resumption, and keeps originals immutable", async () => {
    await stage();
    expect((await searchSharedCatalog(env)).total).toBe(0);
    expect(
      (
        await admin(
          `object/${item.id}/media`,
          "PUT",
          new Uint8Array(media.length)
        )
      ).status
    ).toBe(422);
    expect(objects.size).toBe(0);
    await admin(`object/${item.id}/media`, "PUT", media);
    expect((await searchSharedCatalog(env)).total).toBe(0);
    expect(await (await admin(`status?ids=${item.id}`)).json()).toEqual({
      items: [{ id: item.id, status: "pending", missingObjects: ["poster"] }],
    });
    await admin(`object/${item.id}/poster`, "PUT", poster);
    expect((await searchSharedCatalog(env)).items).toEqual([
      normalizeSharedCatalogItem(item),
    ]);
    await stage();
    expect((await searchSharedCatalog(env)).total).toBe(1);
    expect(
      (
        await admin(
          "manifest",
          "POST",
          JSON.stringify({
            schemaVersion: 1,
            items: [{ ...item, duration: 99 }],
          })
        )
      ).status
    ).toBe(409);
    expect([...objects.keys()].some(key => key.includes("pending"))).toBe(
      false
    );
  });
  it("serves valid byte ranges, rejects malformed ranges, and uses the same ready-only records for search and Reel", async () => {
    await publish();
    expect(
      (
        await searchSharedCatalog(env, {
          query: "frame",
          group: "Film frames",
          pageSize: 1,
        })
      ).total
    ).toBe(1);
    expect((await searchSharedCatalog(env, { query: "missing" })).total).toBe(
      0
    );
    expect((await sharedCatalogCandidates(env, "Add a film frame"))[0].id).toBe(
      item.id
    );
    const request = new Request(
      `https://studio.test/api/catalog/media/${item.id}/media`,
      { headers: { Range: "bytes=2-4" } }
    );
    const result = await handleCatalogPublic(
      request,
      env,
      new URL(request.url)
    );
    expect(result.status).toBe(206);
    expect(result.headers.get("Content-Range")).toBe("bytes 2-4/8");
    expect([...new Uint8Array(await result.arrayBuffer())]).toEqual([2, 3, 4]);
    for (const range of [
      "bytes=8-",
      "bytes=-0",
      "bytes=4-2",
      "bytes=1-2,4-5",
    ]) {
      const invalid = new Request(request.url, { headers: { Range: range } });
      expect(
        (await handleCatalogPublic(invalid, env, new URL(invalid.url))).status
      ).toBe(416);
    }
    const imported = await copySharedCatalogMedia(
      env,
      item.id,
      "users/member/catalog/copy",
      new AbortController().signal
    );
    expect(imported.id).toBe(item.id);
    expect(objects.get("users/member/catalog/copy")!.data).toEqual(media);
  });
  it("keeps source and selected-range placement bounded, while still frames may be held", () => {
    expect(
      sharedCatalogPlacement(item, { start: 3 }, 10, { start: 3, end: 6 })
    ).toEqual({ start: 3, duration: 1 });
    expect(() =>
      sharedCatalogPlacement(item, { start: 3, duration: 2 }, 10)
    ).toThrow();
    expect(() =>
      sharedCatalogPlacement(item, { start: 2 }, 10, { start: 3, end: 6 })
    ).toThrow();
    expect(
      sharedCatalogPlacement(
        { ...item, kind: "image" },
        { start: 3, duration: 5 },
        10
      )
    ).toEqual({ start: 3, duration: 5 });
  });
  it("retrieves ready color looks separately from media and retains an already-applied look outside the ranked page", async () => {
    const looks: SharedMediaCatalogItem[] = Array.from(
      { length: 67 },
      (_, index) => {
        const sha256 = createHash("sha256")
          .update(`look-${index}`)
          .digest("hex");
        return {
          id: `stock-${sha256.slice(0, 24)}`,
          name: `Film look ${String(index).padStart(3, "0")}`,
          group: "Film color",
          designId: `design-look-${index}`,
          variant: "3D 16",
          kind: "lut",
          tags: ["film", "color"],
          duration: 0,
          lut: {
            dimension: 3,
            size: 16,
            domainMin: [0, 0, 0],
            domainMax: [1, 1, 1],
          },
          media: {
            file: `media/${sha256}.cube`,
            sha256,
            bytes: 100,
            contentType: "application/x-cube",
          },
          license: "platform-licensed",
          credits: 0,
        };
      }
    );
    for (let offset = 0; offset < looks.length; offset += 50)
      expect(
        (
          await admin(
            "manifest",
            "POST",
            JSON.stringify({
              schemaVersion: 1,
              items: looks.slice(offset, offset + 50),
            })
          )
        ).status
      ).toBe(200);
    sqlite
      .prepare(
        "UPDATE shared_media_catalog SET status = 'ready', media_ready = 1 WHERE id != ?"
      )
      .run(looks[66].id);
    const defaultIds = (await sharedCatalogCandidates(env, "film color")).map(
      row => row.id
    );
    expect(defaultIds).toHaveLength(60);
    expect(defaultIds).not.toContain(looks[65].id);
    const withApplied = await sharedCatalogCandidates(env, "film color", [
      looks[65].id,
      looks[66].id,
    ]);
    expect(withApplied.map(row => row.id)).toContain(looks[65].id);
    expect(withApplied.map(row => row.id)).not.toContain(looks[66].id);
    expect(withApplied.every(row => row.kind === "lut")).toBe(true);
    expect((await searchSharedCatalog(env, { kind: "media" })).total).toBe(0);
  });
});
