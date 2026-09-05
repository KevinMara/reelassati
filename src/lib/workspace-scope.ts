/** A tab-local selection. Identity and ownership are always checked by the API. */
export function selectedBrand(email?: string): string {
  if (!email) return "default";
  return sessionStorage.getItem(`reelassati:brand:${email}`) || "default";
}
export function selectBrand(email: string, id: string) {
  sessionStorage.setItem(`reelassati:brand:${email}`, id);
  // Reopening the workspace also clears tool drafts and pending request context.
  window.location.hash = "/dashboard";
  window.location.reload();
}
