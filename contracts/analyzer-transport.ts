export const ANALYZER_STREAM_TYPE = "application/x-reelassati-analysis+ndjson";
export const ANALYZER_DEADLINE_MS = 5 * 60_000;
export const ANALYZER_HEARTBEAT_MS = 10_000;
export const ANALYZER_MAX_RESULT_BYTES = 2 * 1024 * 1024;

export type AnalyzerFrame =
  { type: "pending" } | { type: "result"; status: number; body: string };
