import { describe, expect, it } from "vitest";
import { openRouterErrorDiagnostics } from "./provider-diagnostics";

const requestId = "gen-1792505102-io4yKLGK7CI2zXigOKBv";
const field =
  "generation_config.response_schema.properties[changes].items.properties[parameters].properties[fit].enum[2]";

describe("bounded provider error diagnostics", () => {
  it("retains schema location and correlation without retaining raw provider messages", () => {
    const result = openRouterErrorDiagnostics(
      {
        id: requestId,
        error: {
          code: 400,
          message: "Provider returned error",
          metadata: {
            raw: JSON.stringify({
              error: {
                code: 400,
                status: "INVALID_ARGUMENT",
                message:
                  "Invalid value at '" + field + "': null is not a string",
                details: [
                  {
                    fieldViolations: [
                      {
                        field,
                        description: "response_schema enum value invalid",
                      },
                    ],
                  },
                ],
              },
            }),
          },
        },
      },
      new Headers()
    );
    expect(result).toEqual({
      upstreamRequestId: requestId,
      upstreamCode: "INVALID_ARGUMENT",
      reportedIssue: "response-schema",
      reportedField: field,
    });
    expect(JSON.stringify(result)).not.toContain("null is not a string");
  });

  it.each([
    ["Rate limit exceeded; PRIVATE_KEY", "rate-limit"],
    ["Too many requests", "rate-limit"],
    ["Unable to decode video inline_data", "media-input"],
    ["Token count exceeds the maximum context limit", "context-limit"],
    ["Unsupported parameter: seed", "unsupported-parameter"],
  ])("classifies %s without copying the message", (message, reportedIssue) => {
    expect(
      openRouterErrorDiagnostics({ error: { message } }, new Headers())
    ).toEqual({ reportedIssue });
  });

  it("redacts unknown field names and ignores credentials, URLs and free-form codes", () => {
    const secret = "PRIVATE_CUSTOMER_TEXT";
    const raw = {
      error: {
        message: "Invalid response_schema",
        status: secret,
        details: [
          {
            fieldViolations: [
              {
                field: "response_schema.properties[" + secret + "].type",
                description: "data:video/mp4;base64,PRIVATE_FILE",
              },
            ],
          },
        ],
      },
    };
    const result = openRouterErrorDiagnostics(
      {
        id: secret,
        error: {
          code: secret,
          metadata: { raw: JSON.stringify(raw), api_key: "PRIVATE_KEY" },
        },
      },
      new Headers({
        authorization: "Bearer PRIVATE_TOKEN",
        "x-request-id": "PRIVATE_KEY",
      })
    );
    expect(result).toEqual({
      reportedIssue: "response-schema",
      reportedField: "response_schema.properties[*].type",
    });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|base64|Bearer/);
  });

  it("ignores malformed or oversized raw errors and accepts only known request ID shapes", () => {
    expect(
      openRouterErrorDiagnostics(
        { error: { metadata: { raw: "not JSON" } } },
        new Headers()
      )
    ).toEqual({});
    expect(
      openRouterErrorDiagnostics(
        { error: { metadata: { raw: "response_schema".repeat(4000) } } },
        new Headers()
      )
    ).toEqual({});
    expect(
      openRouterErrorDiagnostics(
        {},
        new Headers({ "x-generation-id": requestId })
      )
    ).toEqual({ upstreamRequestId: requestId });
    expect(openRouterErrorDiagnostics(null, new Headers())).toEqual({});
  });

  it.each([
    "messages[1234567890123456].content",
    "response_schema.https://private.example",
    "response_schema.private-email@example.com",
  ])("drops an unsafe field path %s", field => {
    const diagnostic = openRouterErrorDiagnostics(
      {
        error: {
          metadata: {
            raw: JSON.stringify({
              error: {
                details: [{ fieldViolations: [{ field }] }],
              },
            }),
          },
        },
      },
      new Headers()
    );
    expect(diagnostic.reportedField).toBeUndefined();
    expect(JSON.stringify(diagnostic)).not.toMatch(
      /private|1234567890123456|example\.com/i
    );
  });
});
