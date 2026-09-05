import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Film } from "lucide-react";
import { useWorkspace } from "@/providers/workspace";
import posthog from "@/lib/posthog";

const GOALS = [
  "Demonstrate my product",
  "Teach something useful",
  "Tell my founder story",
];
export function CreationStart() {
  const { workspace, updateWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [name, setName] = useState(
    workspace.brandKit.name === "Default brand" ? "" : workspace.brandKit.name
  );
  const [audience, setAudience] = useState(workspace.brandKit.audience);
  const [goal, setGoal] = useState(GOALS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const latest = [...workspace.projects].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  )[0];
  if (latest)
    return (
      <section className="mb-6 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-primary/30 bg-primary/10 p-6">
        <div>
          <p className="text-sm font-medium text-primary">
            Pick up where you left off
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{latest.title}</h2>
          <p className="mt-2 text-sm text-foreground/70">
            {latest.clips.length} clips · {latest.aspectRatio} · {latest.status}
          </p>
        </div>
        <Link
          to={`/dashboard/edit?project=${encodeURIComponent(latest.id)}`}
          className="flex items-center gap-2 rounded-pill bg-primary px-6 py-3 font-medium text-primary-foreground"
        >
          <Film className="h-4 w-4" />
          Continue editing
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    );
  async function start() {
    setBusy(true);
    setError("");
    try {
      await updateWorkspace(current => ({
        ...current,
        brandKit: {
          ...current.brandKit,
          name: name.trim(),
          audience: audience.trim(),
        },
      }));
      posthog?.capture("first_creation_started", { goal });
      navigate(
        `/dashboard/script?topic=${encodeURIComponent(`${goal} for ${name.trim()}. Audience: ${audience.trim()}.`)}`
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your brand could not be saved."
      );
      setBusy(false);
    }
  }
  return (
    <section className="mb-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-surface p-6">
      <p className="flex items-center gap-2 text-sm font-medium text-primary">
        <CheckCircle2 className="h-4 w-4" />
        Your first creation
      </p>
      <h2 className="mt-2 text-2xl font-semibold">
        What would you like to make?
      </h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {GOALS.map(value => (
          <button
            type="button"
            aria-pressed={goal === value}
            key={value}
            onClick={() => setGoal(value)}
            className={`rounded-pill border px-4 py-2 text-sm ${goal === value ? "border-primary bg-primary/15" : "border-border bg-background"}`}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Brand or product
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={100}
            placeholder="What are you creating content for?"
            className="mt-2 w-full rounded-lg border border-border bg-background p-3"
          />
        </label>
        <label className="text-sm">
          Who is it for?
          <input
            value={audience}
            onChange={e => setAudience(e.target.value)}
            maxLength={500}
            placeholder="Your audience and what they care about"
            className="mt-2 w-full rounded-lg border border-border bg-background p-3"
          />
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={busy || !name.trim() || !audience.trim()}
          onClick={() => void start()}
          className="rounded-pill bg-primary px-6 py-3 font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Saving your brand…" : "Start with a script"}
        </button>
        <span className="text-sm text-foreground/70">
          Your brand details carry through to your creation tools.
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
