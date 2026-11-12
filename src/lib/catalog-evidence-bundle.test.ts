import { describe, expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import {
  EVIDENCE_BUNDLE_SCHEMA,
  inspectEvidenceBundle,
  readEvidenceBundle,
} from "./catalog-evidence-bundle";
const packet = {
  schemaVersion: 1,
  catalogId: "stock-0123456789abcdef01234567",
};
function bundle(records: unknown[], count = records.length, gzip = false) {
  const text = [
    JSON.stringify({ schema: EVIDENCE_BUNDLE_SCHEMA, count }),
    ...records.map(r => JSON.stringify(r)),
  ].join("\n");
  return Object.assign(new Blob([gzip ? gzipSync(text) : text]), {
    name: gzip ? "evidence.jsonl.gz" : "evidence.jsonl",
  });
}
async function collect(file: ReturnType<typeof bundle>, signal?: AbortSignal) {
  const records = [];
  for await (const record of readEvidenceBundle(file, signal))
    records.push(record);
  return records;
}
describe("streamed catalog evidence bundles", () => {
  it.each([false, true])(
    "reads declared records without requiring a folder picker (gzip=%s)",
    async gzip => {
      const file = bundle([packet], 1, gzip);
      expect(await inspectEvidenceBundle(file)).toBe(1);
      expect(await collect(file)).toEqual([packet]);
    }
  );
  it("rejects truncation, extra records and duplicate identities", async () => {
    await expect(collect(bundle([packet], 2))).rejects.toThrow("incomplete");
    await expect(
      collect(
        bundle(
          [packet, { ...packet, catalogId: "stock-1123456789abcdef01234567" }],
          1
        )
      )
    ).rejects.toThrow("more records");
    await expect(collect(bundle([packet, packet]))).rejects.toThrow(
      "duplicate"
    );
  });
  it("stops reading when the foreground request is cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      collect(bundle([packet]), controller.signal)
    ).rejects.toThrow();
  });
});
