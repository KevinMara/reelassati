/** Fixed diagnostic categories and redacted field paths only. Never retain a
 * provider's raw error, prompt, media, URL, headers or free-form message. */
export type ProviderDiagnostics = {
  upstreamRequestId?: string;
  upstreamCode?: string;
  reportedIssue?:
    | "response-schema"
    | "media-input"
    | "context-limit"
    | "unsupported-parameter";
  reportedField?: string;
};

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const boundedText = (value: unknown) =>
  typeof value === "string" ? value.slice(0, 8192) : "";
const knownCodes = new Set([
  "INVALID_ARGUMENT",
  "RESOURCE_EXHAUSTED",
  "UNAUTHENTICATED",
  "PERMISSION_DENIED",
  "NOT_FOUND",
  "INTERNAL",
  "UNAVAILABLE",
  "DEADLINE_EXCEEDED",
  "FAILED_PRECONDITION",
  "OUT_OF_RANGE",
]);
const fieldNames = new Set([
  "generation_config",
  "generationConfig",
  "response_schema",
  "responseSchema",
  "response_json_schema",
  "responseJsonSchema",
  "response_format",
  "responseFormat",
  "json_schema",
  "schema",
  "properties",
  "items",
  "enum",
  "type",
  "anyOf",
  "required",
  "nullable",
  "additionalProperties",
  "minimum",
  "maximum",
  "minItems",
  "maxItems",
  "changes",
  "parameters",
  "fit",
  "graphic",
  "ending",
  "insights",
  "review",
  "contents",
  "messages",
  "parts",
  "content",
  "inline_data",
  "inlineData",
  "mime_type",
  "mimeType",
  "data",
  "video_url",
  "image_url",
  "input_audio",
]);

function diagnosticField(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 240) return;
  if (
    !/^(?:generation_config|generationConfig|response_schema|responseSchema|response_json_schema|responseJsonSchema|response_format|responseFormat|contents|messages)(?:\.|\[)/.test(
      value
    )
  )
    return;
  const tokens =
    value.match(/[A-Za-z_][A-Za-z0-9_]*|\[\d{1,4}\]|[.[\]'"]/g) ?? [];
  if (tokens.join("") !== value) return;
  return tokens
    .map(token =>
      /^[A-Za-z_]/.test(token) && !fieldNames.has(token) ? "*" : token
    )
    .join("");
}

export function openRouterErrorDiagnostics(
  payload: unknown,
  headers: Headers
): ProviderDiagnostics {
  const root = object(payload),
    error = object(root.error),
    metadata = object(error.metadata);
  const rawText =
    typeof metadata.raw === "string" && metadata.raw.length <= 32768
      ? metadata.raw
      : "";
  let raw: Record<string, unknown> = {};
  try {
    raw = object(JSON.parse(rawText));
  } catch {
    /* Non-JSON errors are classified without retention. */
  }
  const upstream = object(raw.error ?? raw);
  const details = Array.isArray(upstream.details)
    ? upstream.details.slice(0, 8)
    : [];
  const violations = details.flatMap(detail => {
    const fields = object(detail).fieldViolations;
    return Array.isArray(fields) ? fields.slice(0, 8).map(object) : [];
  });
  const message = [
    error.message,
    upstream.message,
    ...violations.map(field => field.description),
    rawText,
  ]
    .map(boundedText)
    .join(" ")
    .slice(0, 16384);
  const reportedIssue =
    /response[_ .-]?(?:schema|format)|json[_ .-]?schema/i.test(message)
      ? "response-schema"
      : /(?:context|token).{0,60}(?:limit|exceed|maximum|too (?:large|long))/i.test(
            message
          )
        ? "context-limit"
        : /(?:invalid|unsupported|decode|failed|unrecognized).{0,80}(?:video|audio|image|mime|inline_data)|(?:video|audio|image|mime|inline_data).{0,80}(?:invalid|unsupported|decode|failed|unrecognized)/i.test(
              message
            )
          ? "media-input"
          : /unsupported.{0,40}parameter|parameter.{0,40}(?:unsupported|not supported)/i.test(
                message
              )
            ? "unsupported-parameter"
            : undefined;
  const reportedField =
    violations.map(field => diagnosticField(field.field)).find(Boolean) ??
    diagnosticField(
      /(?:at|field) ['"]([^'"\n]{1,240})['"]/i.exec(message)?.[1]
    );
  const upstreamCode = [upstream.status, upstream.code, error.code].find(
    value =>
      typeof value === "string"
        ? knownCodes.has(value)
        : typeof value === "number" &&
          Number.isInteger(value) &&
          value >= 400 &&
          value <= 599
  );
  const upstreamRequestId = [
    root.id,
    metadata.request_id,
    headers.get("x-generation-id"),
    headers.get("x-request-id"),
  ].find(
    value =>
      typeof value === "string" &&
      /^gen-\d{8,16}-[A-Za-z0-9]{8,64}$/.test(value)
  );
  return {
    ...(upstreamRequestId
      ? { upstreamRequestId: String(upstreamRequestId) }
      : {}),
    ...(upstreamCode !== undefined
      ? { upstreamCode: String(upstreamCode) }
      : {}),
    ...(reportedIssue ? { reportedIssue } : {}),
    ...(reportedField ? { reportedField } : {}),
  };
}
