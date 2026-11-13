import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import type { CatalogEvidence } from "../contracts/catalog-evidence";
import type { SharedMediaCatalogItem } from "../contracts/shared-media-catalog";
import type { AnalysisControl } from "./analyzer-request";
import {
  initializeSharedCatalog,
  handleCatalogAdmin,
  searchSharedCatalog,
  type CatalogEnvironment,
} from "./shared-media-catalog";
import {
  catalogEvidenceKey,
  catalogVisualKey,
  normalizeCatalogVisual,
  readCatalogVisual,
  uploadCatalogEvidence,
} from "./catalog-evidence";
import { reviewCatalogVisuals } from "./catalog-visual-review";
import { catalogVisualEvidence } from "./catalog-visual-evidence";

const hash = (v: Uint8Array) => createHash("sha256").update(v).digest("hex");
const jpg = Uint8Array.from([255, 216, 1, 2, 3, 4, 255, 217]);
const sourceSha = "a".repeat(64);
const item: SharedMediaCatalogItem = {
  id: `stock-${sourceSha.slice(0, 24)}`,
  kind: "video",
  name: "Overlay 017",
  group: "Overlays",
  designId: "design-overlay-017",
  variant: "Portrait",
  tags: ["overlay"],
  duration: 2,
  width: 1080,
  height: 1920,
  blendMode: "screen",
  credits: 0,
  license: "platform-licensed",
  media: {
    file: `media/${sourceSha}.mp4`,
    sha256: sourceSha,
    bytes: 200,
    contentType: "video/mp4",
  },
  poster: {
    file: `media/${hash(jpg)}.jpg`,
    sha256: hash(jpg),
    bytes: jpg.length,
    contentType: "image/jpeg",
  },
};
const packet: CatalogEvidence = {
  schemaVersion: 1,
  catalogId: item.id,
  mediaSha256: sourceSha,
  kind: "video",
  duration: 2,
  visual: {
    data: Buffer.from(jpg).toString("base64"),
    bytes: jpg.length,
    sha256: hash(jpg),
    contentType: "image/jpeg",
    width: 480,
    height: 320,
    columns: 2,
    frameTimes: [0, 1],
    sourceWidth: 1080,
    sourceHeight: 1920,
    coverage: "sampled-motion",
  },
};
const observation = {
  id: item.id,
  description: "Amber sparks around a dark center",
  visibleElements: ["Small gold particles"],
  sampledChanges: [
    "At 1.0 seconds the particles occupy more of the right edge",
  ],
  composition: "Particles concentrate at the edges",
  suitableUses: ["Warm celebratory accents"],
  avoidUses: ["Clinical diagrams"],
  visibleText: [],
  confidence: 0.9,
};
let sqlite: DatabaseSync,
  env: CatalogEnvironment,
  abort: AbortController,
  control: AnalysisControl;
let objects: Map<string, Uint8Array>, failPublication: boolean;
beforeEach(async () => {
  sqlite = new DatabaseSync(":memory:");
  objects = new Map();
  failPublication = false;
  abort = new AbortController();
  control = {
    signal: abort.signal,
    deadlineAt: Date.now() + 60000,
    onAbort: () => {},
  };
  class Statement {
    values: unknown[] = [];
    constructor(public sql: string) {}
    bind(...values: unknown[]) {
      this.values = values;
      return this;
    }
    async first<T>() {
      return (sqlite.prepare(this.sql).get(...(this.values as never[])) ??
        null) as T;
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
      return {
        success: true,
        meta: {
          changes: Number(
            sqlite.prepare(this.sql).run(...(this.values as never[])).changes
          ),
        },
      };
    }
  }
  env = {
    DB: {
      prepare: sql => new Statement(sql),
      batch: async statements => {
        if (failPublication) throw new Error("Temporary database interruption");
        sqlite.exec("BEGIN");
        try {
          const results = [];
          for (const statement of statements)
            results.push(await statement.run());
          sqlite.exec("COMMIT");
          return results;
        } catch (e) {
          sqlite.exec("ROLLBACK");
          throw e;
        }
      },
    },
    BUCKET: {
      get: async key => {
        const data = objects.get(key);
        return data
          ? { size: data.length, body: new Response(data).body! }
          : null;
      },
      put: async (key, body) => {
        objects.set(
          key,
          new Uint8Array(await new Response(body as BodyInit).arrayBuffer())
        );
      },
    },
  } as CatalogEnvironment;
  await initializeSharedCatalog(env);
  sqlite
    .prepare(
      "INSERT INTO shared_media_catalog(id,name,group_name,design_id,kind,search_text,payload,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)"
    )
    .run(
      item.id,
      item.name,
      item.group,
      item.designId,
      item.kind,
      "overlay",
      JSON.stringify(item),
      "ready",
      ""
    );
  sqlite
    .prepare(
      "INSERT INTO shared_catalog_evidence(id,media_sha,evidence_ready) VALUES(?,?,1)"
    )
    .run(item.id, sourceSha);
  objects.set(
    catalogEvidenceKey(sourceSha),
    new TextEncoder().encode(JSON.stringify(packet))
  );
});
afterEach(() => sqlite.close());
const inspect = () => vi.fn(async () => ({ visuals: [observation] }));

describe("content-grounded visual catalog review", () => {
  it("uses actual frames without source names, indexes positive observations and verifies them at selection", async () => {
    const model = inspect();
    expect(await reviewCatalogVisuals(env, [item.id], control, model)).toEqual({
      reviewed: [item.id],
      skipped: [],
    });
    const [direction, parts] = model.mock.calls[0] as unknown as [
      string,
      unknown[],
    ];
    expect(direction).toContain("sampledChanges MUST be empty");
    expect(JSON.stringify(parts)).toContain(packet.visual!.data);
    expect(JSON.stringify(parts)).not.toContain(item.name);
    expect(
      (await searchSharedCatalog(env, { query: "amber" })).items.map(x => x.id)
    ).toContain(item.id);
    expect((await searchSharedCatalog(env, { query: "clinical" })).total).toBe(
      0
    );
    const result = await catalogVisualEvidence(env, [item], abort.signal);
    expect(JSON.stringify(result.parts)).toContain("Amber sparks");
    expect(JSON.stringify(result.parts)).toContain(
      "Gaps between frames are unobserved"
    );
    const url = new URL(
      `https://studio.test/api/catalog/admin/evidence-status?ids=${item.id}`
    );
    const status = await handleCatalogAdmin(new Request(url), env, url, true);
    expect(await status.json()).toMatchObject({
      items: [{ id: item.id, ready: true, visualReviewed: true }],
    });
  });
  it("repairs an interrupted index publication without a second model call", async () => {
    failPublication = true;
    await expect(
      reviewCatalogVisuals(env, [item.id], control, inspect())
    ).rejects.toThrow("interruption");
    expect(objects.has(catalogVisualKey(sourceSha))).toBe(true);
    failPublication = false;
    const model = inspect();
    expect(await reviewCatalogVisuals(env, [item.id], control, model)).toEqual({
      reviewed: [],
      skipped: [item.id],
    });
    expect(model).not.toHaveBeenCalled();
    expect((await searchSharedCatalog(env, { query: "amber" })).total).toBe(1);
  });
  it("does not publish mismatched or incomplete responses, and releases its lease", async () => {
    for (const visuals of [
      [],
      [{ ...observation, id: "stock-" + "b".repeat(24) }],
      [{ ...observation, confidence: 2 }],
    ]) {
      const model = vi.fn(async () => ({ visuals }));
      await expect(
        reviewCatalogVisuals(env, [item.id], control, model)
      ).rejects.toThrow();
      expect(model).toHaveBeenCalledTimes(1);
      expect(objects.has(catalogVisualKey(sourceSha))).toBe(false);
      expect(
        sqlite
          .prepare("SELECT COUNT(*) AS n FROM shared_catalog_visual_leases")
          .get()?.n
      ).toBe(0);
    }
  });
  it("does not call a model for a held lease and does not commit after cancellation", async () => {
    sqlite
      .prepare("INSERT INTO shared_catalog_visual_leases VALUES(?,?,?)")
      .run(item.id, "other", Date.now() + 60000);
    const model = inspect();
    await expect(
      reviewCatalogVisuals(env, [item.id], control, model)
    ).rejects.toMatchObject({ status: 409 });
    expect(model).not.toHaveBeenCalled();
    sqlite.prepare("DELETE FROM shared_catalog_visual_leases").run();
    await expect(
      reviewCatalogVisuals(env, [item.id], control, async () => {
        abort.abort();
        return { visuals: [observation] };
      })
    ).rejects.toThrow();
    expect(objects.has(catalogVisualKey(sourceSha))).toBe(false);
  });
  it("invalidates observations and search when the actual samples change", async () => {
    await reviewCatalogVisuals(env, [item.id], control, inspect());
    const changed = structuredClone(packet);
    changed.visual!.frameTimes = [0, 1.5];
    const nextJpg = Uint8Array.from([255, 216, 4, 3, 2, 1, 255, 217]);
    Object.assign(changed.visual!, {
      data: Buffer.from(nextJpg).toString("base64"),
      sha256: hash(nextJpg),
    });
    const request = new Request("https://studio.test/upload", {
      method: "POST",
      body: JSON.stringify([changed]),
    });
    expect((await uploadCatalogEvidence(request, env)).status).toBe(200);
    expect(await readCatalogVisual(env, changed, abort.signal)).toBeUndefined();
    expect((await searchSharedCatalog(env, { query: "amber" })).total).toBe(0);
    expect(
      sqlite
        .prepare("SELECT COUNT(*) AS n FROM shared_catalog_visual_reviews")
        .get()?.n
    ).toBe(0);
  });
  it("never attributes motion to a still image or accepts a different sample", () => {
    const still = {
      ...packet,
      visual: { ...packet.visual!, coverage: "complete-image" as const },
    };
    const stored = {
      ...observation,
      schemaVersion: 1,
      mediaSha256: sourceSha,
      sampleSha256: packet.visual!.sha256,
      coverage: "complete-image",
    };
    expect(() => normalizeCatalogVisual(stored, still)).toThrow("still image");
    expect(() =>
      normalizeCatalogVisual(
        { ...stored, sampledChanges: [], sampleSha256: "b".repeat(64) },
        still
      )
    ).toThrow("frames");
  });
  it("cannot mark a replacement sample reviewed if it arrives during publication", async () => {
    const originalPut = env.BUCKET.put;
    env.BUCKET.put = async (key, body, options) => {
      await originalPut(key, body, options);
      if (key === catalogVisualKey(sourceSha))
        sqlite
          .prepare("UPDATE shared_catalog_evidence SET sample_sha=? WHERE id=?")
          .run("b".repeat(64), item.id);
    };
    await expect(
      reviewCatalogVisuals(env, [item.id], control, inspect())
    ).rejects.toThrow("changed during review");
    expect(
      sqlite
        .prepare("SELECT COUNT(*) AS n FROM shared_catalog_visual_reviews")
        .get()?.n
    ).toBe(0);
    expect((await searchSharedCatalog(env, { query: "amber" })).total).toBe(0);
    expect(
      sqlite
        .prepare("SELECT sample_sha FROM shared_catalog_evidence WHERE id=?")
        .get(item.id)?.sample_sha
    ).toBe("b".repeat(64));
  });
});
