export type EditorRunStage =
  | "activity-save"
  | "capabilities"
  | "session"
  | "source-metadata"
  | "source-review"
  | "speech"
  | "style-review"
  | "planning"
  | "apply";

/** Debugging breadcrumbs must never contain source URLs, transcript, prompts,
 * provider messages, tokens or account identifiers. Public copy stays separate. */
export function editorRunDiagnostic(stage: EditorRunStage, error: unknown) {
  const row =
    error && typeof error === "object"
      ? (error as { status?: unknown; name?: unknown })
      : {};
  return {
    stage,
    status:
      typeof row.status === "number" &&
      Number.isInteger(row.status) &&
      row.status >= 100 &&
      row.status <= 599
        ? row.status
        : null,
    kind:
      row.name === "AbortError"
        ? "cancelled"
        : row.name === "TypeError"
          ? "transport-or-client"
          : "request-or-validation",
  };
}
