/** A long-open editor may refer to a chunk removed by a newer deployment. */
export function isExportModuleUnavailable(error: unknown) {
  return (
    error instanceof Error &&
    /failed to fetch dynamically imported module|importing a module script failed|loading chunk [\w-]+ failed|error loading dynamically imported module/i.test(
      error.message
    )
  );
}

/** Never refresh until the current document is acknowledged. Another mutation
 * during the save leaves the page intact so the user can try again safely. */
export async function saveBeforeExportRefresh<T>(
  save: () => Promise<T>,
  current: () => T,
  refresh: () => void
) {
  const saved = await save();
  if (JSON.stringify(current()) !== JSON.stringify(saved)) return false;
  refresh();
  return true;
}
