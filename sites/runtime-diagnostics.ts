/** Fixed categories only. Never log exception text, SQL, URLs or request data. */
export function runtimeFailureDiagnostic(cause: unknown) {
  const message = cause instanceof Error ? cause.message.slice(0, 4096) : "";
  const patterns = [
    ["database-size", /(?:D1|SQLITE).*(?:too (?:big|large)|size|length)|string or blob too big/i],
    ["database-query", /D1_ERROR|SQLITE_ERROR|SQLITE_CONSTRAINT|no such (?:column|table)|too many SQL variables/i],
    ["subrequest-limit", /too many (?:subrequests|API requests)|subrequest limit/i],
    ["stream-state", /stream.*(?:locked|disturbed|closed|canceled)|body.*(?:used|consumed)/i],
    ["memory-limit", /memory limit|allocation failed|out of memory/i],
    ["invalid-media-content", /Unsupported model content part|Invalid model content part|Model content cannot be empty/i],
    ["network", /fetch failed|network|connection|socket|upstream|internal error/i],
    ["serialization", /serializ|circular|BigInt/i],
  ] as const;
  return {
    category: patterns.find(([, pattern]) => pattern.test(message))?.[0] ?? "unclassified",
    errorType: cause instanceof TypeError ? "TypeError" : cause instanceof SyntaxError ? "SyntaxError" : cause instanceof Error ? "Error" : "unknown",
  };
}
