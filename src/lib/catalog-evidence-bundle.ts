import type { CatalogEvidence } from "@contracts/catalog-evidence";

export const EVIDENCE_BUNDLE_SCHEMA = "reelassati-catalog-evidence/v1";
type EvidenceSource = Blob & { name: string };

async function* lines(file: EvidenceSource, signal?: AbortSignal) {
  let stream: ReadableStream<BufferSource> = file.stream();
  if (file.name.endsWith(".gz"))
    stream = stream.pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let buffered = "";
  try {
    for (;;) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      buffered += value;
      let end: number;
      while ((end = buffered.indexOf("\n")) >= 0) {
        if (end > 2 * 1024 * 1024)
          throw new Error("An evidence record exceeds the size limit.");
        const line = buffered.slice(0, end).trim();
        buffered = buffered.slice(end + 1);
        if (line) yield line;
      }
      if (buffered.length > 2 * 1024 * 1024)
        throw new Error("An evidence record exceeds the size limit.");
    }
    if (buffered.trim()) yield buffered.trim();
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function header(line: string | undefined) {
  if (!line) throw new Error("The evidence bundle is empty.");
  const value = JSON.parse(line);
  if (
    value.schema !== EVIDENCE_BUNDLE_SCHEMA ||
    !Number.isSafeInteger(value.count) ||
    value.count < 1 ||
    value.count > 100_000
  )
    throw new Error("Choose a prepared evidence bundle.");
  return value.count as number;
}

export async function inspectEvidenceBundle(file: EvidenceSource) {
  const iterator = lines(file);
  try {
    const first = await iterator.next();
    return header(first.done ? undefined : first.value);
  } finally {
    await iterator.return();
  }
}

export function evidencePacket(value: unknown): CatalogEvidence {
  const p = value as CatalogEvidence;
  if (!p || p.schemaVersion !== 1 || !/^stock-[a-f0-9]{24}$/.test(p.catalogId))
    throw new Error("Choose prepared catalog evidence.");
  return p;
}

export async function* readEvidenceBundle(
  file: EvidenceSource,
  signal?: AbortSignal
) {
  let expected = 0,
    count = 0;
  const seen = new Set<string>();
  for await (const line of lines(file, signal)) {
    if (!expected) {
      expected = header(line);
      continue;
    }
    const packet = evidencePacket(JSON.parse(line));
    if (seen.has(packet.catalogId))
      throw new Error("The evidence bundle contains a duplicate asset.");
    seen.add(packet.catalogId);
    if (++count > expected)
      throw new Error(
        "The evidence bundle contains more records than declared."
      );
    yield packet;
  }
  if (!expected || count !== expected)
    throw new Error("The evidence bundle is incomplete.");
}
