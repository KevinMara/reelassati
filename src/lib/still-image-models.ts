export const PERSON_MODEL = {
  id: "onnx-community/mediapipe_selfie_segmentation",
  revision: "be49485c8e027524be38591817fc5cd31bd9d00e",
  base: "/vendor/person/",
  file: "onnx/model.onnx",
  size: 462352,
  sha256: "3241ac4ad8aa35bdaf33946776db29f7c283a413aa0b0dacb9483594b4531aad",
} as const;

export const DEPTH_MODEL = {
  id: "onnx-community/depth-anything-v2-small",
  revision: "4472b7362082ad9968fee890ca0f1e5aca36b93d",
  base: "/vendor/depth/",
  file: "onnx/model_quantized.onnx",
  size: 27258801,
  sha256: "fcf51f1b230362b28690bb9d1809bf0431f29cad20534e3f589bd7285547f20d",
  parts: [
    { size: 16777216, sha256: "de667c2a9afdebf8763c01d91eefb8789a87c6f386ada58aad5fd0aebec41f76" },
    { size: 10481585, sha256: "3eb9118e3a5d694ebd283c04fc1cd06e1faa50189c51eb78e7d9c2ee9c302a12" },
  ],
} as const;

export async function verifyModelBytes(bytes: Uint8Array, size: number, sha256: string) {
  if (bytes.length !== size) throw new Error("The local image model is incomplete. Reload and try again.");
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  const actual = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  if (actual !== sha256) throw new Error("The local image model failed its integrity check.");
}

async function fetchModelPart(url: string, size: number, sha256: string): Promise<Uint8Array> {
  const response = await fetch(url, { credentials: "omit", redirect: "error" });
  if (!response.ok) throw new Error("The local image model could not be loaded.");
  const reported = response.headers.get("content-length");
  if (reported !== null && Number(reported) !== size) throw new Error("The local image model has an unexpected size.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The local image model stream is unavailable.");
  const bytes = new Uint8Array(size);
  let offset = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.length > size) throw new Error("The local image model exceeds its pinned size.");
      bytes.set(value, offset);
      offset += value.length;
    }
  } catch (cause) {
    await reader.cancel().catch(() => undefined);
    throw cause;
  } finally {
    reader.releaseLock();
  }
  await verifyModelBytes(bytes.subarray(0, offset), size, sha256);
  return bytes;
}

/** Only exact same-origin model paths are intercepted; no remote model fallback. */
export function imageModelCache(origin: string) {
  return {
    async match(request: string | Request): Promise<Response | undefined> {
      const url = new URL(typeof request === "string" ? request : request.url, origin);
      if (url.origin !== origin || url.search || url.hash || url.username || url.password) return undefined;
      const personPath = `${PERSON_MODEL.base}${PERSON_MODEL.id}/${PERSON_MODEL.file}`;
      const depthPath = `${DEPTH_MODEL.base}${DEPTH_MODEL.id}/${DEPTH_MODEL.file}`;
      if (url.pathname === personPath) {
        return new Response(Uint8Array.from(await fetchModelPart(url.href, PERSON_MODEL.size, PERSON_MODEL.sha256)).buffer, { headers: { "content-type": "application/octet-stream" } });
      }
      if (url.pathname !== depthPath) return undefined;
      const full = new Uint8Array(DEPTH_MODEL.size);
      let offset = 0;
      for (let index = 0; index < DEPTH_MODEL.parts.length; index += 1) {
        const part = DEPTH_MODEL.parts[index];
        const bytes = await fetchModelPart(`${url.href}.part${index}`, part.size, part.sha256);
        full.set(bytes, offset);
        offset += bytes.length;
      }
      await verifyModelBytes(full, DEPTH_MODEL.size, DEPTH_MODEL.sha256);
      return new Response(full, { headers: { "content-type": "application/octet-stream" } });
    },
    async put() { /* The worker owns these bytes only until it is terminated. */ },
  };
}
