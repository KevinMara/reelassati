const DEFAULT_OWNER_STUDIO_ORIGIN = "https://reelassati.kevinbiz.chatgpt.site";

export function isVercelClientDeployment(): boolean {
  return window.location.hostname.endsWith(".vercel.app");
}

export function ownerStudioUrl(route = "/dashboard"): string {
  const configuredOrigin = import.meta.env.VITE_OWNER_STUDIO_ORIGIN?.trim();
  const origin = (configuredOrigin || DEFAULT_OWNER_STUDIO_ORIGIN).replace(
    /\/$/,
    ""
  );
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  return `${origin}/#${normalizedRoute}`;
}
