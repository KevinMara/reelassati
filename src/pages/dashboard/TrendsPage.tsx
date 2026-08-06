import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Beaker,
  CheckCircle2,
  FileText,
  FlaskConical,
  Plus,
  Scissors,
  Trash2,
  X,
} from "lucide-react";
import type { Platform, ScriptDraft } from "@contracts/workspace";
import { useWorkspace } from "@/providers/workspace";

const HYPOTHESIS_TONE = "format-hypothesis";

const PLATFORMS: Array<{ value: Platform; label: string }> = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube Shorts" },
  { value: "twitter", label: "X / Twitter" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "pinterest", label: "Pinterest" },
  { value: "threads", label: "Threads" },
];

function createId() {
  return `hypothesis_${
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }`;
}

export default function TrendsPage() {
  const { workspace, updateWorkspace, saving } = useWorkspace();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [hook, setHook] = useState("");
  const [evidence, setEvidence] = useState("");
  const [successSignal, setSuccessSignal] = useState("");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [duration, setDuration] = useState(30);
  const [filter, setFilter] = useState<"all" | Platform>("all");
  const [notice, setNotice] = useState<string | null>(null);

  const hypotheses = useMemo(
    () =>
      workspace.scripts
        .filter(script => script.tone === HYPOTHESIS_TONE)
        .filter(script => filter === "all" || script.platform === filter)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [filter, workspace.scripts]
  );

  const sourceMaterials = useMemo(() => {
    const scripts = workspace.scripts
      .filter(script => script.tone !== HYPOTHESIS_TONE)
      .map(script => ({
        id: `script-${script.id}`,
        type: "Script",
        title: script.title,
        platform: script.platform,
        hook: script.hook,
        evidence: `Workspace script created ${new Date(
          script.createdAt
        ).toLocaleDateString()}.`,
      }));
    const projects = workspace.projects.map(project => ({
      id: `project-${project.id}`,
      type: "Edit project",
      title: project.title,
      platform: project.platform,
      hook: project.transcript[0]?.text || "",
      evidence: `Workspace project using the “${project.template}” format; current status: ${project.status}.`,
    }));
    return [...projects, ...scripts]
      .sort((left, right) => left.title.localeCompare(right.title))
      .slice(0, 8);
  }, [workspace.projects, workspace.scripts]);

  const resetForm = () => {
    setTitle("");
    setHook("");
    setEvidence("");
    setSuccessSignal("");
    setPlatform("tiktok");
    setDuration(30);
    setShowForm(false);
  };

  const saveHypothesis = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !title.trim() ||
      !hook.trim() ||
      !evidence.trim() ||
      !successSignal.trim()
    ) {
      setNotice(
        "Define the idea, opening, evidence, and pass signal before saving."
      );
      return;
    }
    const now = new Date().toISOString();
    const hypothesis: ScriptDraft = {
      id: createId(),
      title: title.trim(),
      hook: hook.trim(),
      body: evidence.trim(),
      cta: successSignal.trim(),
      fullScript: [
        `Format hypothesis: ${title.trim()}`,
        `Opening: ${hook.trim()}`,
        `Evidence: ${evidence.trim()}`,
        `Pass signal: ${successSignal.trim()}`,
      ].join("\n\n"),
      platform,
      tone: HYPOTHESIS_TONE,
      duration,
      language: workspace.profile.contentLanguage,
      createdAt: now,
    };
    try {
      await updateWorkspace(current => ({
        ...current,
        scripts: [hypothesis, ...current.scripts],
        activity: [
          {
            id: `event_${hypothesis.id}`,
            type: "script" as const,
            label: "Format hypothesis saved",
            detail: hypothesis.title,
            createdAt: now,
          },
          ...current.activity,
        ].slice(0, 100),
      }));
      resetForm();
      setNotice("Hypothesis saved to this workspace.");
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "The hypothesis could not be saved."
      );
    }
  };

  const prefillFromSource = (source: (typeof sourceMaterials)[number]) => {
    setTitle(source.title);
    setHook(source.hook);
    setEvidence(source.evidence);
    setPlatform(source.platform);
    setShowForm(true);
    setNotice(null);
  };

  const deleteHypothesis = async (hypothesis: ScriptDraft) => {
    if (!window.confirm(`Delete the hypothesis “${hypothesis.title}”?`)) return;
    setNotice(null);
    try {
      await updateWorkspace(current => ({
        ...current,
        scripts: current.scripts.filter(script => script.id !== hypothesis.id),
      }));
      setNotice("Hypothesis deleted.");
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "The hypothesis could not be deleted."
      );
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mono-eyebrow mb-2 text-primary">
            Evidence before imitation
          </p>
          <h1 className="text-3xl font-semibold">Trend Workbench</h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/55">
            Turn a real observation into a testable format hypothesis.
            REELassati does not claim that a hard-coded feed is live trend
            intelligence.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm(current => !current);
            setNotice(null);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Close" : "New hypothesis"}
        </button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          ["01", "Observe", "Save the exact pattern and where you saw it."],
          ["02", "Isolate", "Change one creative variable at a time."],
          ["03", "Define", "Choose the real signal that would count as a win."],
          ["04", "Produce", "Build controlled variants in the editor."],
        ].map(([step, label, detail]) => (
          <div
            key={step}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <p className="font-mono text-[10px] text-primary">{step}</p>
            <p className="mt-2 text-sm font-medium">{label}</p>
            <p className="mt-1 text-xs leading-relaxed text-foreground/45">
              {detail}
            </p>
          </div>
        ))}
      </div>

      {notice ? (
        <div
          role="status"
          className="mb-5 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary"
        >
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      ) : null}

      {showForm ? (
        <form
          onSubmit={saveHypothesis}
          className="mb-7 rounded-xl border border-primary/25 bg-surface p-6"
        >
          <div className="mb-5 flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            <h2 className="font-medium">Define a controlled test</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="mb-1.5 block font-medium">Format idea</span>
              <input
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="Example: Result first, process second"
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1.5 block font-medium">
                Opening line or first frame
              </span>
              <textarea
                value={hook}
                onChange={event => setHook(event.target.value)}
                rows={2}
                placeholder="Write the concrete opening you will test"
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1.5 block font-medium">
                Observed evidence
              </span>
              <textarea
                value={evidence}
                onChange={event => setEvidence(event.target.value)}
                rows={4}
                placeholder="Source, repeated pattern, audience comment, or result you personally observed"
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1.5 block font-medium">Pass signal</span>
              <textarea
                value={successSignal}
                onChange={event => setSuccessSignal(event.target.value)}
                rows={4}
                placeholder="Example: Higher 3-second hold than the current baseline"
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1.5 block font-medium">Platform</span>
              <select
                value={platform}
                onChange={event => setPlatform(event.target.value as Platform)}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5"
              >
                {PLATFORMS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1.5 block font-medium">Target duration</span>
              <select
                value={duration}
                onChange={event => setDuration(Number(event.target.value))}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5"
              >
                {[15, 20, 30, 45, 60].map(seconds => (
                  <option key={seconds} value={seconds}>
                    {seconds} seconds
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white disabled:opacity-45"
            >
              <Beaker className="h-4 w-4" /> Save hypothesis
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mono-eyebrow text-[10px] text-foreground/45">
                Saved experiments
              </p>
              <h2 className="mt-1 font-medium">Format hypotheses</h2>
            </div>
            <select
              value={filter}
              onChange={event =>
                setFilter(event.target.value as "all" | Platform)
              }
              className="rounded-lg border border-border bg-surface px-3 py-2 text-xs"
              aria-label="Filter hypotheses by platform"
            >
              <option value="all">All platforms</option>
              {PLATFORMS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {hypotheses.length ? (
            <div className="space-y-4">
              {hypotheses.map(hypothesis => (
                <article
                  key={hypothesis.id}
                  className="rounded-xl border border-border bg-surface p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-primary">
                        {PLATFORMS.find(
                          option => option.value === hypothesis.platform
                        )?.label || hypothesis.platform}
                      </span>
                      <h3 className="mt-3 font-medium">{hypothesis.title}</h3>
                      <p className="mt-2 text-sm font-medium text-foreground/75">
                        “{hypothesis.hook}”
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteHypothesis(hypothesis)}
                      disabled={saving}
                      className="rounded-md p-2 text-foreground/35 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40"
                      aria-label={`Delete ${hypothesis.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-background p-3">
                      <dt className="text-[10px] uppercase tracking-wide text-foreground/40">
                        Evidence
                      </dt>
                      <dd className="mt-1 text-xs leading-relaxed text-foreground/60">
                        {hypothesis.body}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-background p-3">
                      <dt className="text-[10px] uppercase tracking-wide text-foreground/40">
                        Pass signal
                      </dt>
                      <dd className="mt-1 text-xs leading-relaxed text-foreground/60">
                        {hypothesis.cta}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      to="/dashboard/edit"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary"
                    >
                      <Scissors className="h-3.5 w-3.5" /> Build the variant
                    </Link>
                    <Link
                      to="/dashboard/script"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/55 hover:text-primary"
                    >
                      <FileText className="h-3.5 w-3.5" /> Write the script
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
              <Beaker className="mx-auto h-7 w-7 text-primary" />
              <h3 className="mt-3 text-sm font-medium">No saved hypotheses</h3>
              <p className="mt-1 text-xs text-foreground/45">
                Start with an observation, not a fabricated trend score.
              </p>
            </div>
          )}
        </section>

        <aside>
          <div className="mb-4">
            <p className="mono-eyebrow text-[10px] text-foreground/45">
              Your evidence base
            </p>
            <h2 className="mt-1 font-medium">Workspace source material</h2>
          </div>
          {sourceMaterials.length ? (
            <div className="space-y-3">
              {sourceMaterials.map(source => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => prefillFromSource(source)}
                  className="group w-full rounded-xl border border-border bg-surface p-4 text-left hover:border-primary/35"
                >
                  <span className="text-[10px] uppercase tracking-wide text-foreground/40">
                    {source.type}
                  </span>
                  <span className="mt-1 block text-sm font-medium">
                    {source.title}
                  </span>
                  <span className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">
                    Use as starting point
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface p-6">
              <p className="text-sm font-medium">No source material yet</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground/45">
                Scripts and edit projects will appear here as real inputs for
                future tests.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
