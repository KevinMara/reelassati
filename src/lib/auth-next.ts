const AUTH_NEXT_KEY = "reelassati.authNext";

export function safeDashboardNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/dashboard") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}

export function rememberAuthNext(value: string | null | undefined): string {
  const next = safeDashboardNext(value);
  if (next !== "/dashboard") sessionStorage.setItem(AUTH_NEXT_KEY, next);
  return next;
}

export function consumeAuthNext(fallback?: string | null): string {
  const stored = sessionStorage.getItem(AUTH_NEXT_KEY);
  sessionStorage.removeItem(AUTH_NEXT_KEY);
  return safeDashboardNext(fallback || stored);
}
