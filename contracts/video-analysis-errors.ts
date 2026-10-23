/** Fixed, safe explanations only. Never reflect arbitrary provider text. */
export function videoReviewFailureMessage(reason: unknown): string | undefined {
  switch (reason) {
    case "incomplete-coverage":
      return "The review did not cover the full video.";
    case "invalid-intervals":
    case "invalid-ranges":
    case "missing-intervals":
      return "The review returned invalid video timestamps.";
    case "missing-channels":
      return "The review could not establish every required editorial signal.";
    case "missing-evidence":
      return "The review omitted evidence for one or more moments.";
    case "missing-story-assessment":
      return "The review returned an inconsistent story structure.";
    case "missing-source-review":
      return "The review omitted required caption, audio or pacing notes.";
    case "invalid-recommendations":
      return "The review returned incomplete improvement advice.";
    case "invalid-edit-plan":
      return "The review proposed edits that could not be safely prepared.";
    case "unsupported-schema":
    case "missing-summary":
    case "missing-editing-style":
    case "unexplained-empty-plan":
      return "The review omitted required information.";
    default:
      return undefined;
  }
}
