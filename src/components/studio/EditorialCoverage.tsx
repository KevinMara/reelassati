import type { EditorialCoverageReview } from "@contracts/editorial-coverage";

/** Planning decisions remain in chat, separate from video copy and receipts. */
export function EditorialCoverage({
  review,
  ui,
}: {
  review?: EditorialCoverageReview;
  ui: (text: string) => string;
}) {
  if (!review?.scenes.length) return null;
  return (
    <details className="mt-3 text-[13px] leading-relaxed">
      <summary className="cursor-pointer text-foreground/65">
        {ui("Content decisions")}
      </summary>
      <ol className="mt-2 space-y-3">
        {review.scenes.map(scene => {
          const limitations = [
            ...new Set(
              scene.issues.map(issue => {
                if (issue === "missing-decision")
                  return ui("No content decision was supplied.");
                if (
                  issue === "missing-evidence" ||
                  issue === "invalid-evidence"
                )
                  return ui(
                    "Source evidence is missing or does not match this section."
                  );
                if (issue === "missing-reason")
                  return ui("The decision needs a source-based explanation.");
                if (issue === "unresolved-source")
                  return ui("The source limitation remains unresolved.");
                return ui(
                  "The planned operations do not resolve this content need."
                );
              })
            ),
          ];
          return (
            <li
              key={scene.sceneId}
              className="border-l border-border pl-3"
              data-content-decision={scene.decision}
            >
              <p className="font-medium text-foreground/80">
                {scene.start.toFixed(1)}–{scene.end.toFixed(1)}s
                {scene.purpose ? ` · ${scene.purpose}` : ""}
              </p>
              {scene.reason && (
                <p className="whitespace-pre-wrap break-words text-foreground/65">
                  {scene.reason}
                </p>
              )}
              {limitations.map(limitation => (
                <p
                  key={limitation}
                  className="text-amber-600 dark:text-amber-300"
                >
                  {limitation}
                </p>
              ))}
            </li>
          );
        })}
      </ol>
    </details>
  );
}
