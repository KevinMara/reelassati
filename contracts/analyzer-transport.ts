export const ANALYZER_STREAM_TYPE = "application/x-reelassati-analysis+ndjson";
export const ANALYZER_DEADLINE_MS = 5 * 60_000;
// One foreground edit may contain a draft, stock selection, and one graphic
// correction. This is one fixed total deadline, never reset per invocation.
export const EDIT_PLAN_DEADLINE_MS = 3 * ANALYZER_DEADLINE_MS;
export const ANALYZER_HEARTBEAT_MS = 10_000;
export const ANALYZER_MAX_RESULT_BYTES = 2 * 1024 * 1024;

export type AnalyzerFrame =
  { type: "pending" } | { type: "result"; status: number; body: string };
