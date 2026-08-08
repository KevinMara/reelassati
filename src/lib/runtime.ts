const DEFAULT_PLATFORM_API_ORIGIN = "https://reelassati.kevinbiz.chatgpt.site";

export function isVercelClientDeployment(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".vercel.app")
  );
}

export function platformApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const configuredOrigin = import.meta.env.VITE_PLATFORM_API_ORIGIN?.trim();
  if (configuredOrigin) {
    return `${configuredOrigin.replace(/\/$/, "")}${normalizedPath}`;
  }
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";
  const usesBundledApi =
    !hostname ||
    hostname.endsWith(".chatgpt.site") ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "terminal.local";
  if (!usesBundledApi) {
    return `${DEFAULT_PLATFORM_API_ORIGIN}${normalizedPath}`;
  }
  return normalizedPath;
}
