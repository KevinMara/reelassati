import { FeedbackCenter } from "@/components/feedback/FeedbackCenter";

export default function FeedbackPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8">
        <p className="mono-eyebrow text-primary">Product loop</p>
        <h1 className="mt-2 text-3xl font-semibold">Feedback & bugs</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/55">
          Report a problem or propose an improvement. Technical context is
          captured automatically so reports are easier to act on.
        </p>
      </header>
      <FeedbackCenter showInbox />
    </div>
  );
}
