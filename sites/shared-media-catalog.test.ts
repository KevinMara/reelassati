import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import {
  handleCatalogAdmin,
  handleCatalogPublic,
  initializeSharedCatalog,
  searchSharedCatalog,
  sharedCatalogCandidates,
  copySharedCatalogMedia,
  type CatalogEnvironment,
} from "./shared-media-catalog";
import {
  normalizeSharedCatalogItem,
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
let worker: typeof import("./server")["default"];
let objects: Map<
  string,
  { data: Uint8Array; metadata?: Record<string, string> }
>;
beforeEach(async () => {
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
