import type { Asset, WorkspaceDocument } from "@contracts/workspace";

export function signedMediaIdentity(url: string) {
  try {
    const parsed = new URL(url, "https://workspace.invalid");
    const expires = Number(parsed.searchParams.get("expires"));
    if (!/^\/api\/media\/[^/]+$/.test(parsed.pathname) ||
        !parsed.searchParams.has("token") || !Number.isFinite(expires) || expires <= 0)
      return undefined;
    return { origin: parsed.origin, path: parsed.pathname, expires: expires * 1000 };
  } catch { return undefined; }
}

export function nextMediaLinkRefresh(assets: Asset[], now = Date.now()) {
  const expirations = assets.flatMap(asset => {
    const media = signedMediaIdentity(asset.url);
    return media ? [media.expires] : [];
  });
  return expirations.length ? Math.max(0, Math.min(...expirations) - now - 60_000) : null;
}

/** A link refresh is not a workspace reload or save acknowledgement. Keep
 * every local edit, deletion, name, revision and project unchanged. */
export function renewWorkspaceMediaLinks(current: WorkspaceDocument, incoming: Asset[]) {
  const fresh = new Map(incoming.map(asset => [asset.id, asset]));
  let changed = false;
  const assets = current.assets.map(asset => {
    const replacement = fresh.get(asset.id);
    const oldLink = signedMediaIdentity(asset.url);
    const newLink = replacement && signedMediaIdentity(replacement.url);
    if (!oldLink || !newLink || oldLink.origin !== newLink.origin ||
        oldLink.path !== newLink.path || newLink.expires <= oldLink.expires)
      return asset;
    changed = true;
    return { ...asset, url: replacement!.url };
  });
  return changed ? { ...current, assets } : current;
}
