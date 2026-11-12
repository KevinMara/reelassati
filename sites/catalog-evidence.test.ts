import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  normalizeCatalogEvidence,
  type CatalogEvidence,
} from "../contracts/catalog-evidence";
import {
  verifyEvidenceBlobs,
  normalizeCatalogSound,
  readCatalogEvidence,
} from "./catalog-evidence";
import { catalogVisualEvidence } from "./catalog-visual-evidence";
import type { SharedMediaCatalogItem } from "../contracts/shared-media-catalog";
import type { CatalogEnvironment } from "./shared-media-catalog";
const sha = "a".repeat(64),
  sound = Buffer.from([73, 68, 51, 0, 0, 0, 0, 0]);
const audioItem = {
  id: "stock-" + sha.slice(0, 24),
  kind: "audio",
  duration: 2,
  media: { sha256: sha },
} as SharedMediaCatalogItem;
const packet: CatalogEvidence = {
  schemaVersion: 1,
  catalogId: audioItem.id,
  mediaSha256: sha,
  kind: "audio",
  duration: 2,
  audio: {
    data: sound.toString("base64"),
    bytes: sound.length,
    sha256: createHash("sha256").update(sound).digest("hex"),
    contentType: "audio/mpeg",
    coverage: "complete-audio",
    segments: [{ sourceStart: 0, sourceEnd: 2, sampleStart: 0 }],
    measured: {
      duration: 2,
      peakDb: -1,
      rmsDb: -12,
      activeStart: 0.1,
      activeEnd: 1.8,
      onsets: [0.1],
      envelope: Array(64).fill(0.1),
    },
  },
};
const observation = {
  schemaVersion: 1,
  mediaSha256: sha,
  sampleSha256: packet.audio!.sha256,
  character: "A soft bell with a short decay",
  role: "effect",
  audibleEvents: ["One bell"],
  suitableUses: ["Quiet completion"],
  avoidUses: ["Dramatic impact"],
  containsSpeech: false,
  intensity: "subtle",
  confidence: 0.9,
  coverage: "complete-audio",
};
const env = (records: Record<string, unknown>) =>
  ({
    BUCKET: {
      get: async (key: string) => {
        const record = records[key];
        if (!record) return null;
        const data = JSON.stringify(record);
        return {
          body: new Response(data).body,
          size: new TextEncoder().encode(data).length,
        };
      },
    },
  }) as CatalogEnvironment;
const signal = () => new AbortController().signal;
describe("content-grounded catalog evidence", () => {
  it("binds measured audio to immutable source bytes and verifies sampled bytes", () => {
    expect(normalizeCatalogEvidence(packet, audioItem)).toEqual(packet);
    expect(() => verifyEvidenceBlobs(packet)).not.toThrow();
    expect(() =>
      normalizeCatalogEvidence(
        { ...packet, mediaSha256: "b".repeat(64) },
        audioItem
      )
    ).toThrow("immutable");
    expect(() =>
      normalizeCatalogEvidence(
        { ...packet, sourcePath: "private/original.wav" },
        audioItem
      )
    ).toThrow("Unsupported");
    expect(() =>
      verifyEvidenceBlobs({
        ...packet,
        audio: { ...packet.audio!, data: Buffer.alloc(8).toString("base64") },
      })
    ).toThrow("verification");
  });
  it("rejects false whole-track coverage, overlapping segments and oversize envelopes", () => {
    const variant = (patch: any) => ({
      ...packet,
      audio: { ...packet.audio!, ...patch },
    });
    expect(() =>
      normalizeCatalogEvidence(
        variant({
          segments: [{ sourceStart: 0, sourceEnd: 1, sampleStart: 0 }],
        }),
        audioItem
      )
    ).toThrow("coverage");
    expect(() =>
      normalizeCatalogEvidence(
        variant({
          coverage: "sampled-audio",
          segments: [
            { sourceStart: 0, sourceEnd: 1.2, sampleStart: 0 },
            { sourceStart: 1, sourceEnd: 2, sampleStart: 1.2 },
          ],
        }),
        audioItem
      )
    ).toThrow("mapping");
    expect(() =>
      normalizeCatalogEvidence(
        variant({
          measured: {
            ...packet.audio!.measured,
            envelope: Array(10000).fill(1),
          },
        }),
        audioItem
      )
    ).toThrow("samples");
  });
  it("requires matching listening observations before offering a sound to Reel", async () => {
    const key = `catalog-evidence/v1/${sha}.json`,
      soundKey = `catalog-evidence/v1/${sha}.sound.json`;
    expect(
      (
        await catalogVisualEvidence(
          env({ [key]: packet }),
          [audioItem],
          signal()
        )
      ).items
    ).toEqual([]);
    const result = await catalogVisualEvidence(
      env({ [key]: packet, [soundKey]: observation }),
      [audioItem],
      signal()
    );
    expect(result.items).toEqual([audioItem]);
    expect(result.parts).toEqual([
      { type: "text", text: expect.stringContaining("A soft bell") },
    ]);
    expect(
      (
        await catalogVisualEvidence(
          env({
            [key]: packet,
            [soundKey]: { ...observation, sampleSha256: "b".repeat(64) },
          }),
          [audioItem],
          signal()
        )
      ).items
    ).toEqual([]);
    expect(() =>
      normalizeCatalogSound({ ...observation, confidence: 3 }, packet)
    ).toThrow();
  });
  it("does not accept stale source identities or canceled evidence reads", async () => {
    expect(
      await readCatalogEvidence(
        env({
          [`catalog-evidence/v1/${sha}.json`]: { ...packet, duration: 20 },
        }),
        audioItem,
        signal()
      )
    ).toBeUndefined();
    await expect(
      readCatalogEvidence(env({}), audioItem, AbortSignal.abort())
    ).rejects.toThrow();
  });
});
