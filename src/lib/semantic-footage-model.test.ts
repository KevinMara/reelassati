import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { env, pipeline } from "@huggingface/transformers";
import { cosineSimilarity } from "./semantic-search-protocol";

it("runs the pinned real MiniLM model locally and recognizes related text without literal overlap", async () => {
  const base = path.resolve("public/vendor/search/");
  const weights = await readFile(
    path.join(base, "Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx")
  );
  expect(weights.length).toBe(22_972_370);
  expect(createHash("sha256").update(weights).digest("hex")).toBe(
    "afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1"
  );
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = base + "/";
  env.useFSCache = false;
  type Extractor = ((
    texts: string[],
    options: { pooling: "mean"; normalize: boolean }
  ) => Promise<{ dims: number[]; data: ArrayLike<number> }>) & {
    dispose: () => Promise<unknown>;
  };
  const createExtractor = pipeline as unknown as (
    task: "feature-extraction",
    model: string,
    options: { dtype: "q8"; device: "cpu"; local_files_only: boolean }
  ) => Promise<Extractor>;
  const extractor = await createExtractor(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2",
    { dtype: "q8", device: "cpu", local_files_only: true }
  );
  try {
    const output = await extractor(
      [
        "Somebody enjoys a warm beverage.",
        "A person sips a hot cup of coffee.",
        "The white dog plays fetch outside.",
      ],
      { pooling: "mean", normalize: true }
    );
    expect(output.dims).toEqual([3, 384]);
    const rows = [0, 1, 2].map(i =>
      Float32Array.from(
        Array.prototype.slice.call(
          output.data,
          i * 384,
          (i + 1) * 384
        ) as number[]
      )
    );
    const related = cosineSimilarity(rows[0], rows[1]),
      unrelated = cosineSimilarity(rows[0], rows[2]);
    expect(related).toBeGreaterThan(0.28);
    expect(related).toBeGreaterThan(unrelated + 0.2);
  } finally {
    await extractor.dispose();
  }
}, 30_000);
