import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { DEPTH_MODEL, PERSON_MODEL, imageModelCache, verifyModelBytes } from "./still-image-models";

afterEach(() => vi.unstubAllGlobals());
describe("pinned same-origin still-image models", () => {
  it("checks the actual committed model and shard lengths and SHA-256 digests", async () => {
    const person = await readFile(`public${PERSON_MODEL.base}${PERSON_MODEL.id}/${PERSON_MODEL.file}`);
    await expect(verifyModelBytes(person, PERSON_MODEL.size, PERSON_MODEL.sha256)).resolves.toBeUndefined();
    const parts = await Promise.all(DEPTH_MODEL.parts.map((part, index) => readFile(`public${DEPTH_MODEL.base}${DEPTH_MODEL.id}/${DEPTH_MODEL.file}.part${index}`).then(async bytes => {
      expect(bytes.length).toBeLessThan(25 * 1024 * 1024);
      await verifyModelBytes(bytes, part.size, part.sha256);
      return bytes;
    })));
    await expect(verifyModelBytes(Buffer.concat(parts), DEPTH_MODEL.size, DEPTH_MODEL.sha256)).resolves.toBeUndefined();
  });
  it("rejects truncated and tampered weights", async () => {
    const bytes = Uint8Array.from([1, 2, 3]);
    const digest = createHash("sha256").update(bytes).digest("hex");
    await expect(verifyModelBytes(bytes, 4, digest)).rejects.toThrow("incomplete");
    await expect(verifyModelBytes(Uint8Array.from([1, 2, 4]), 3, digest)).rejects.toThrow("integrity");
  });
  it("does not intercept foreign origins, query strings, arbitrary models or credentialed URLs", async () => {
    const cache = imageModelCache("https://editor.example");
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    for (const url of ["https://foreign.example/vendor/person/onnx-community/mediapipe_selfie_segmentation/onnx/model.onnx", "/vendor/person/onnx-community/mediapipe_selfie_segmentation/onnx/model.onnx?x=1", "/other.onnx", "https://user:password@editor.example/vendor/person/onnx-community/mediapipe_selfie_segmentation/onnx/model.onnx"]) {
      expect(await cache.match(url)).toBeUndefined();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("fetches only verified same-origin model bytes without credentials or redirects", async () => {
    const bytes = await readFile(`public${PERSON_MODEL.base}${PERSON_MODEL.id}/${PERSON_MODEL.file}`);
    const fetcher = vi.fn().mockResolvedValue(new Response(bytes)); vi.stubGlobal("fetch", fetcher);
    const result = await imageModelCache("https://editor.example").match(`${PERSON_MODEL.base}${PERSON_MODEL.id}/${PERSON_MODEL.file}`);
    expect((await result?.arrayBuffer())?.byteLength).toBe(PERSON_MODEL.size);
    expect(fetcher).toHaveBeenCalledWith(`https://editor.example${PERSON_MODEL.base}${PERSON_MODEL.id}/${PERSON_MODEL.file}`, { credentials: "omit", redirect: "error" });
  });
  it("rejects a mismatched advertised size without buffering a model", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array(1), { headers: { "content-length": "1" } })); vi.stubGlobal("fetch", fetcher);
    await expect(imageModelCache("https://editor.example").match(`${PERSON_MODEL.base}${PERSON_MODEL.id}/${PERSON_MODEL.file}`)).rejects.toThrow("unexpected size");
  });
});
