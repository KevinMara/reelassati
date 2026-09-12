export function normalizeMediaFolders(
  value: unknown
): Array<{ id: string; name: string; parentId?: string }> {
  if (!Array.isArray(value)) return [];
  const folders: Array<{ id: string; name: string; parentId?: string }> = [];
  const seen = new Set<string>();
  for (const row of value.slice(0, 500)) {
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.id !== "string" ||
      typeof row.name !== "string"
    )
      continue;
    const id = row.id.slice(0, 100),
      name = row.name.trim().slice(0, 100);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    folders.push({
      id,
      name,
      ...(typeof row.parentId === "string" && row.parentId
        ? { parentId: row.parentId.slice(0, 100) }
        : {}),
    });
  }
  const byId = new Map(folders.map(f => [f.id, f]));
  for (const folder of folders) {
    const chain = new Set([folder.id]);
    let parent = folder.parentId;
    while (parent) {
      if (chain.has(parent) || !byId.has(parent)) {
        delete folder.parentId;
        break;
      }
      chain.add(parent);
      parent = byId.get(parent)?.parentId;
    }
  }
  return folders;
}
