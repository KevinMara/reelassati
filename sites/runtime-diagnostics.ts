/** Fixed categories only. Never log exception text, SQL, URLs or request data. */
export function runtimeFailureDiagnostic(cause: unknown) {
  const message = cause instanceof Error ? cause.message.slice(0, 4096) : "";
  const providerChecks: Record<string, string> = {
    "Analysis provider output limit reached": "output-limit",
    "Analysis provider response was filtered": "filtered",
    "Analysis provider stream failed": "upstream-error",
    "Analysis provider did not complete its report": "finish-reason",
    "Analysis provider response is empty": "empty-body",
    "Analysis provider response is incomplete": "incomplete-stream",
    "Analysis provider response is too large": "response-size",
    "Analysis provider frame is too large": "frame-size",
  };
  const catalogChecks: Record<string, string> = {
    "Incomplete visual observations.": "visual-count",
    "Visual observation identities do not match.": "visual-identities",
    "Invalid visual observation.": "visual-text",
    "Invalid visual observations.": "visual-list",
    "Visual observation does not match its frames.": "visual-metadata",
    "A still image cannot establish motion.": "still-motion",
    "Visual evidence changed during review.": "visual-sample-changed",
    "Incomplete sound observations.": "sound-count",
    "Duplicate sound observations.": "sound-identities",
    "Invalid sound observation.": "sound-text",
    "Invalid sound observations.": "sound-list",
    "Sound observation does not match its sample.": "sound-metadata",
    "Sound evidence changed during review.": "sound-sample-changed",
  };
  const patterns = [
    ["database-deadline", /D1.*(?:timed out|timeout|time limit|overloaded|busy)|SQLITE_BUSY/i],
    ["database-instructions", /too many (?:instructions|SQL variables)|SQLITE_TOOBIG/i],
    ["database-schema", /no such (?:column|table)|syntax error|ambiguous column/i],
    ["provider-stream", /Analysis provider (?:stream failed|did not complete|response is (?:empty|incomplete|too large))/i],
    [
      "database-size",
      /(?:D1|SQLITE).*(?:too (?:big|large)|size|length)|string or blob too big/i,
    ],
    [
      "database-query",
      /D1_ERROR|SQLITE_ERROR|SQLITE_CONSTRAINT|no such (?:column|table)|too many SQL variables/i,
    ],
    [
      "subrequest-limit",
      /too many (?:subrequests|API requests)|subrequest limit/i,
    ],
    [
      "stream-state",
      /stream.*(?:locked|disturbed|closed|canceled)|body.*(?:used|consumed)/i,
    ],
    ["memory-limit", /memory limit|allocation failed|out of memory/i],
    [
      "invalid-media-content",
      /Unsupported model content part|Invalid model content part|Model content cannot be empty/i,
    ],
    [
      "network",
      /fetch failed|network|connection|socket|upstream|internal error/i,
    ],
    ["serialization", /serializ|circular|BigInt/i],
  ] as const;
  return {
    category:
      (providerChecks[message] ? "provider-stream" : undefined) ??
      (catalogChecks[message] ? "catalog-observation" : undefined) ??
      patterns.find(([, pattern]) => pattern.test(message))?.[0] ??
      "unclassified",
    ...(catalogChecks[message] ? { catalogCheck: catalogChecks[message] } : {}),
    ...(providerChecks[message] ? { providerCheck: providerChecks[message] } : {}),
    errorType:
      cause instanceof TypeError
        ? "TypeError"
        : cause instanceof SyntaxError
          ? "SyntaxError"
          : cause instanceof Error
            ? "Error"
            : "unknown",
  };
}
