import { useUiText } from "@/lib/i18n/ui";
import { FeedbackCenter } from "@/components/feedback/FeedbackCenter";

export default function FeedbackPage() {
  const ui = useUiText();
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {ui("Feedback & bugs")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/70">
          {ui(
            "Report a problem or propose an improvement. Technical context is captured automatically so reports are easier to act on."
          )}
        </p>
      </header>
      <FeedbackCenter showInbox compact />
    </div>
  );
}
