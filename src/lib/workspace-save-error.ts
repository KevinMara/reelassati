export function workspaceSaveError(cause: unknown): string {
  const status =
    typeof cause === "object" && cause !== null && "status" in cause
      ? Number(cause.status)
      : 0;
  if (status === 401) return "Sign in again to save your changes.";
  if (status === 409) return "A newer workspace copy exists.";
  if (status === 413)
    return "The workspace is full. Download a backup before removing unused items.";
  return "Your changes are kept here. Check your connection and retry saving.";
}
