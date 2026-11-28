interface EnginePart {
  hash: string;
  size: number;
}

async function unpack(path: string, signal?: AbortSignal, cache?: RequestCache) {
  const timeout = AbortSignal.timeout(60000);
  const response = await fetch(path, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    cache,
  });
  if (!response.ok || !response.body) throw Error("Missing render engine data");
  return new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).blob();
}

async function loadPart(part: EnginePart, signal?: AbortSignal) {
  for (const cache of ["default", "reload"] as const) {
    try {
      const bytes = await unpack("/vendor/render/" + part.hash + ".bin", signal, cache);
      if (bytes.size !== part.size) throw Error("Incomplete render engine data");
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await bytes.arrayBuffer()));
      const hash = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
      if (hash !== part.hash) throw Error("Render engine integrity mismatch");
      return bytes;
    } catch (error) {
      signal?.throwIfAborted();
      if (cache === "reload") throw error;
    }
  }
  throw Error("Missing render engine part");
}

/** Recover also when a response has headers but its compressed body breaks. */
export async function renderEngineBytes(signal?: AbortSignal): Promise<Blob> {
  try {
    return await unpack("/vendor/render/core.bin", signal);
  } catch {
    signal?.throwIfAborted();
  }
  const stop = new AbortController();
  const recovery = AbortSignal.any([stop.signal, AbortSignal.timeout(120000), ...(signal ? [signal] : [])]);
  try {
    const manifest = await fetch("/vendor/render/core-parts.json", { signal: recovery });
    if (!manifest.ok) throw Error("Missing render engine index");
    const { parts } = await manifest.json() as { parts: EnginePart[] };
    if (!Array.isArray(parts) || !parts.length || parts.length > 32 ||
        !parts.every(part => part && /^[0-9a-f]{64}$/.test(part.hash) &&
          Number.isInteger(part.size) && part.size > 0 && part.size <= 2097152))
      throw Error("Invalid render engine index");
    const decoded: Blob[] = [];
    for (let i = 0; i < parts.length; i += 3) {
      decoded.push(...await Promise.all(parts.slice(i, i + 3).map(part => loadPart(part, recovery))));
    }
    return new Blob(decoded, { type: "application/wasm" });
  } catch {
    signal?.throwIfAborted();
    throw Error("The video engine download was interrupted. Try again to finish loading it.");
  } finally {
    stop.abort();
  }
}
