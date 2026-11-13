import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  normalizeCatalogEvidence,
  type CatalogEvidence,
  type CatalogSoundObservation,
  type CatalogVisualObservation,
} from "../contracts/catalog-evidence";
import type { SharedMediaCatalogItem } from "../contracts/shared-media-catalog";
import { normalizeSharedCatalogItem } from "../contracts/shared-media-catalog";
import type { CatalogEnvironment } from "./shared-media-catalog";

export const catalogEvidenceKey = (sha: string) =>
  `catalog-evidence/v1/${sha}.json`;
export const catalogSoundKey = (sha: string) =>
  `catalog-evidence/v1/${sha}.sound.json`;
export const catalogVisualKey = (sha: string) =>
  `catalog-evidence/v1/${sha}.visual.json`;
export function catalogContentSearchText(
  item: SharedMediaCatalogItem,
  sound?: CatalogSoundObservation,
  visual?: CatalogVisualObservation
) {
  return [
    item.name,
    item.group,
    item.variant,
    ...item.tags,
    ...(sound && sound.confidence >= 0.6
      ? [
          sound.character,
          sound.role,
          sound.intensity,
          ...sound.audibleEvents,
          ...sound.suitableUses,
        ]
      : []),
    ...(visual && visual.confidence >= 0.6
      ? [
          visual.description,
          visual.composition,
          ...visual.visibleElements,
          ...visual.sampledChanges,
          ...visual.suitableUses,
          ...visual.visibleText,
        ]
      : []),
  ]
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();
}
export async function publishCatalogSound(
  env: CatalogEnvironment,
  item: SharedMediaCatalogItem,
  packet: CatalogEvidence,
  observation: CatalogSoundObservation
) {
  const results = await env.DB.batch([
    env.DB.prepare(
      "UPDATE shared_catalog_evidence SET sound_reviewed=1 WHERE id=? AND media_sha=? AND sample_sha=?"
    ).bind(item.id, packet.mediaSha256, packet.audio!.sha256),
    env.DB.prepare(
      "UPDATE shared_media_catalog SET search_text=? WHERE id=? AND EXISTS (SELECT 1 FROM shared_catalog_evidence e WHERE e.id=? AND e.media_sha=? AND e.sample_sha=?)"
    ).bind(
      catalogContentSearchText(item, observation),
      item.id,
      item.id,
      packet.mediaSha256,
      packet.audio!.sha256
    ),
  ]);
  if (!Array.isArray(results) || !results[0]?.meta?.changes)
    throw new Error("Sound evidence changed during review.");
}
export function evidenceBytes(data: string) {
  return Uint8Array.from(atob(data), c => c.charCodeAt(0));
}
export function verifyEvidenceBlobs(packet: CatalogEvidence) {
  for (const blob of [packet.visual, packet.audio])
    if (blob) {
      const bytes = evidenceBytes(blob.data);
      if (
        bytes.length !== blob.bytes ||
        bytesToHex(sha256(bytes)) !== blob.sha256
      )
        throw new Error("Evidence media failed verification.");
      if (
        blob.contentType === "image/jpeg" &&
        (bytes[0] !== 255 ||
          bytes[1] !== 216 ||
          bytes[bytes.length - 2] !== 255 ||
          bytes[bytes.length - 1] !== 217)
      )
        throw new Error("Evidence image is not JPEG.");
      if (
        blob.contentType === "audio/mpeg" &&
        !(bytes[0] === 73 && bytes[1] === 68 && bytes[2] === 51) &&
        !(bytes[0] === 255 && (bytes[1] & 224) === 224)
      )
        throw new Error("Evidence sound is not MP3.");
    }
}
export async function readCatalogEvidence(
  env: CatalogEnvironment,
  item: SharedMediaCatalogItem,
  signal: AbortSignal
) {
  signal.throwIfAborted();
  const stored = await env.BUCKET.get(catalogEvidenceKey(item.media.sha256));
  if (!stored) return;
  if (stored.size > 2 * 1024 * 1024) {
    await stored.body.cancel();
    return;
  }
  try {
    const packet = normalizeCatalogEvidence(
      await new Response(stored.body).json(),
      item
    );
    verifyEvidenceBlobs(packet);
    signal.throwIfAborted();
    return packet;
  } catch {
    signal.throwIfAborted();
    return;
  }
}
export async function readCatalogSound(
  env: CatalogEnvironment,
  packet: CatalogEvidence,
  signal: AbortSignal
) {
  if (!packet.audio) return;
  const stored = await env.BUCKET.get(catalogSoundKey(packet.mediaSha256));
  if (!stored) return;
  if (stored.size > 16000) {
    await stored.body.cancel();
    return;
  }
  try {
    const value = await new Response(stored.body).json();
    signal.throwIfAborted();
    return normalizeCatalogSound(value, packet);
  } catch {
    signal.throwIfAborted();
    return;
  }
}
export function normalizeCatalogSound(
  value: unknown,
  packet: CatalogEvidence
): CatalogSoundObservation {
  const v = value as CatalogSoundObservation;
  const text = (s: unknown) => {
    if (
      typeof s !== "string" ||
      !s.trim() ||
      s.length > 600 ||
      /[\u0000-\u001f]/.test(s)
    )
      throw new Error("Invalid sound observation.");
    return s.trim();
  };
  const texts = (s: unknown) => {
    if (!Array.isArray(s) || s.length > 8)
      throw new Error("Invalid sound observations.");
    return s.map(text);
  };
  if (
    !v ||
    !packet.audio ||
    v.schemaVersion !== 1 ||
    v.mediaSha256 !== packet.mediaSha256 ||
    v.sampleSha256 !== packet.audio.sha256 ||
    !["music", "effect", "ambience", "speech", "mixed", "unclear"].includes(
      v.role
    ) ||
    !["subtle", "moderate", "strong"].includes(v.intensity) ||
    typeof v.containsSpeech !== "boolean" ||
    !Number.isFinite(v.confidence) ||
    v.confidence < 0 ||
    v.confidence > 1 ||
    v.coverage !== packet.audio.coverage
  )
    throw new Error("Sound observation does not match its sample.");
  return {
    schemaVersion: 1,
    mediaSha256: v.mediaSha256,
    sampleSha256: v.sampleSha256,
    character: text(v.character),
    role: v.role,
    audibleEvents: texts(v.audibleEvents),
    suitableUses: texts(v.suitableUses),
    avoidUses: texts(v.avoidUses),
    containsSpeech: v.containsSpeech,
    intensity: v.intensity,
    confidence: v.confidence,
    coverage: v.coverage,
  };
}
export function normalizeCatalogVisual(
  value: unknown,
  packet: CatalogEvidence
): CatalogVisualObservation {
  const v = value as CatalogVisualObservation;
  const text = (s: unknown) => {
    if (
      typeof s !== "string" ||
      !s.trim() ||
      s.length > 600 ||
      /[\u0000-\u001f]/.test(s)
    )
      throw new Error("Invalid visual observation.");
    return s.trim();
  };
  const texts = (s: unknown) => {
    // A contact sheet can contain 30 frames. Retain complete observations
    // instead of rejecting valid per-frame descriptions at eight entries.
    if (!Array.isArray(s) || s.length > 32)
      throw new Error("Invalid visual observations.");
    return s.map(text);
  };
  if (
    !v ||
    !packet.visual ||
    v.schemaVersion !== 1 ||
    v.mediaSha256 !== packet.mediaSha256 ||
    v.sampleSha256 !== packet.visual.sha256 ||
    v.coverage !== packet.visual.coverage ||
    !Number.isFinite(v.confidence) ||
    v.confidence < 0 ||
    v.confidence > 1
  )
    throw new Error("Visual observation does not match its frames.");
  const sampledChanges = texts(v.sampledChanges);
  if (packet.visual.coverage === "complete-image" && sampledChanges.length)
    throw new Error("A still image cannot establish motion.");
  const observation: CatalogVisualObservation = {
    schemaVersion: 1,
    mediaSha256: v.mediaSha256,
    sampleSha256: v.sampleSha256,
    description: text(v.description),
    visibleElements: texts(v.visibleElements),
    sampledChanges,
    composition: text(v.composition),
    suitableUses: texts(v.suitableUses),
    avoidUses: texts(v.avoidUses),
    visibleText: texts(v.visibleText),
    confidence: v.confidence,
    coverage: v.coverage,
  };
  if (new TextEncoder().encode(JSON.stringify(observation)).byteLength > 32000)
    throw new Error("Invalid visual observations.");
  return observation;
}
export async function readCatalogVisual(
  env: CatalogEnvironment,
  packet: CatalogEvidence,
  signal: AbortSignal
) {
  signal.throwIfAborted();
  if (!packet.visual) return;
  const stored = await env.BUCKET.get(catalogVisualKey(packet.mediaSha256));
  if (!stored) return;
  if (stored.size > 32000) {
    await stored.body.cancel();
    return;
  }
  try {
    const value = await new Response(stored.body).json();
    signal.throwIfAborted();
    return normalizeCatalogVisual(value, packet);
  } catch {
    signal.throwIfAborted();
    return;
  }
}
/** Owner route only; immutable source identity is verified against published DB rows. */
export async function uploadCatalogEvidence(
  request: Request,
  env: CatalogEnvironment
) {
  if (Number(request.headers.get("content-length") || 0) > 8 * 1024 * 1024)
    return Response.json(
      { error: "Evidence batch is too large." },
      { status: 413 }
    );
  const reader = request.body?.getReader();
  if (!reader)
    return Response.json({ error: "Missing evidence." }, { status: 422 });
  let length = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    length += next.value.length;
    if (length > 8 * 1024 * 1024) {
      await reader.cancel();
      return Response.json(
        { error: "Evidence batch is too large." },
        { status: 413 }
      );
    }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(length);
  let cursor = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, cursor);
    cursor += chunk.length;
  }
  let values: unknown;
  try {
    values = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return Response.json({ error: "Invalid evidence batch." }, { status: 422 });
  }
  if (!Array.isArray(values) || !values.length || values.length > 20)
    return Response.json(
      { error: "Choose up to 20 evidence records." },
      { status: 422 }
    );
  const ids = values.map(v => v?.catalogId);
  if (
    ids.some(
      id => typeof id !== "string" || !/^stock-[a-f0-9]{24}$/.test(id)
    ) ||
    new Set(ids).size !== ids.length
  )
    return Response.json(
      { error: "Invalid evidence identities." },
      { status: 422 }
    );
  const records = await env.DB.prepare(
    `SELECT payload FROM shared_media_catalog WHERE status='ready' AND id IN (${ids.map(() => "?").join(",")})`
  )
    .bind(...ids)
    .all<{ payload: string }>();
  const items = new Map(
    records.results.map(r => {
      const i = normalizeSharedCatalogItem(JSON.parse(r.payload));
      return [i.id, i];
    })
  );
  const prepared: CatalogEvidence[] = [];
  try {
    for (const value of values) {
      const item = items.get(value.catalogId);
      if (!item) throw new Error();
      const packet = normalizeCatalogEvidence(value, item);
      verifyEvidenceBlobs(packet);
      prepared.push(packet);
    }
  } catch {
    return Response.json(
      { error: "Evidence does not match the published catalog." },
      { status: 422 }
    );
  }
  const statements = [];
  for (let offset = 0; offset < prepared.length; offset += 3) {
    request.signal.throwIfAborted();
    // Only three object writes at once; publish readiness in one DB batch after
    // every object succeeds. A partial upload remains safely resumable.
    const results = await Promise.allSettled(
      prepared.slice(offset, offset + 3).map(async packet => {
        // Preserve a listening result only when it still describes these exact samples.
        const sound = packet.audio
          ? await readCatalogSound(env, packet, request.signal)
          : undefined;
        const visual = packet.visual
          ? await readCatalogVisual(env, packet, request.signal)
          : undefined;
        await env.BUCKET.put(
          catalogEvidenceKey(packet.mediaSha256),
          new TextEncoder().encode(JSON.stringify(packet)),
          {
            httpMetadata: { contentType: "application/json" },
            customMetadata: { mediaSha256: packet.mediaSha256 },
          }
        );
        request.signal.throwIfAborted();
        return [
          env.DB.prepare(
            "INSERT INTO shared_catalog_evidence(id,media_sha,sample_sha,evidence_ready,sound_reviewed) VALUES(?,?,?,1,?) ON CONFLICT(id) DO UPDATE SET media_sha=excluded.media_sha,sample_sha=excluded.sample_sha,evidence_ready=1,sound_reviewed=excluded.sound_reviewed"
          ).bind(
            packet.catalogId,
            packet.mediaSha256,
            packet.audio?.sha256 || packet.visual?.sha256 || "",
            sound ? 1 : 0
          ),
          env.DB.prepare(
            "UPDATE shared_media_catalog SET search_text=? WHERE id=?"
          ).bind(
            catalogContentSearchText(
              items.get(packet.catalogId)!,
              sound,
              visual
            ),
            packet.catalogId
          ),
          ...(!visual
            ? [
                env.DB.prepare(
                  "DELETE FROM shared_catalog_visual_reviews WHERE id=?"
                ).bind(packet.catalogId),
              ]
            : []),
        ];
      })
    );
    const failure = results.find(result => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
    for (const result of results)
      if (result.status === "fulfilled") statements.push(...result.value);
  }
  request.signal.throwIfAborted();
  await env.DB.batch(statements);
  return Response.json({ saved: prepared.map(p => p.catalogId) });
}
