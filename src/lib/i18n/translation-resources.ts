import en from "./locales/en";

/** Fill legacy semantic UI keys from the same selected interface catalog. */
export function localizedLegacyKeys(
  existing: Record<string, string>,
  interfaceCopy: Record<string, string>
) {
  const result = { ...existing };
  const bySource = new Map(
    Object.entries(interfaceCopy).map(([source, value]) => [
      source.trim().toLowerCase(),
      value,
    ])
  );
  for (const [key, source] of Object.entries(en)) {
    if (result[key] && result[key] !== source) continue;
    const translated = bySource.get(source.trim().toLowerCase());
    if (translated) result[key] = translated;
  }
  return result;
}
