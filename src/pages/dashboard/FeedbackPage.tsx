import { useUiText } from "@/lib/i18n/ui";
import { FeedbackCenter } from "@/components/feedback/FeedbackCenter";

export default function FeedbackPage() {
  const ui = useUiText();
  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8">
        <p className="mono-eyebrow text-primary">{ui("Product loop")}</p>
        <h1 className="mt-2 text-3xl font-semibold">{ui("Feedback & bugs")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/70">
          {ui(
            "Report a problem or propose an improvement. Technical context is captured automatically so reports are easier to act on."
          )}
        </p>
      </header>
      <FeedbackCenter showInbox />
    </div>
  );
}
