import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Lightbulb,
  Loader2,
  MessageSquareMore,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import {
  PlatformApiError,
  platformApi,
  type FeedbackRecord,
  type FeedbackStatus,
} from "@/lib/platform-api";
import { cn } from "@/lib/utils";

type FeedbackType = "bug" | "feedback";
type Impact = "blocking" | "major" | "minor" | "idea";

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: "New",
  in_progress: "Reviewing",
  planned: "Planned",
  resolved: "Fixed",
  closed: "Closed",
};

const priorities: FeedbackRecord["priority"][] = [
  "low",
  "normal",
  "high",
  "urgent",
];

const statuses = Object.keys(STATUS_LABELS) as FeedbackStatus[];
const FIELD_INPUT =
  "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-primary/35 focus:ring-4 focus:ring-primary/[0.05]";

function priorityForImpact(impact: Impact): FeedbackRecord["priority"] {
  if (impact === "blocking") return "urgent";
  if (impact === "major") return "high";
  if (impact === "minor") return "normal";
  return "low";
}

function contextBlock() {
  const connection = navigator as Navigator & {
    connection?: { effectiveType?: string };
  };
  return [
    "Technical context (captured automatically)",
    `Page: ${window.location.href}`,
    `Screen: ${window.innerWidth}×${window.innerHeight}`,
    `Language: ${navigator.language}`,
    `Connection: ${connection.connection?.effectiveType || "unknown"}`,
    `Browser/device: ${navigator.userAgent}`,
    `Captured: ${new Date().toISOString()}`,
  ].join("\n");
}

export function FeedbackCenter({ showInbox = false }: { showInbox?: boolean }) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const isItalian = i18n.resolvedLanguage?.startsWith("it");
  const [type, setType] = useState<FeedbackType>("bug");
  const [impact, setImpact] = useState<Impact>("minor");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [expected, setExpected] = useState("");
  const [steps, setSteps] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [name, setName] = useState(user?.name || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submittedId, setSubmittedId] = useState("");
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [owner, setOwner] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(showInbox);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">(
    "all"
  );
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");
  const [selectedId, setSelectedId] = useState("");
  const [savingId, setSavingId] = useState("");

  const loadInbox = async () => {
    if (!showInbox || !user) {
      setInboxLoading(false);
      return;
    }
    setInboxLoading(true);
    try {
      const result = await platformApi.feedbackInbox();
      setOwner(result.owner);
      setFeedback(result.feedback);
      setSelectedId(current => current || result.feedback[0]?.id || "");
    } catch (cause) {
      if (!(cause instanceof PlatformApiError) || cause.status !== 403) {
        setError(
          cause instanceof Error ? cause.message : "Feedback could not load."
        );
      }
    } finally {
      setInboxLoading(false);
    }
  };

  useEffect(() => {
    void loadInbox();
    // The owner inbox is loaded once for the authenticated page session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInbox, user?.id]);

  const visibleFeedback = useMemo(() => {
    const query = search.trim().toLowerCase();
    return feedback.filter(item => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (!query) return true;
      return [
        item.id,
        item.subject,
        item.description,
        item.requesterName,
        item.requesterEmail,
      ].some(value => value.toLowerCase().includes(query));
    });
  }, [feedback, search, statusFilter, typeFilter]);

  const selected =
    visibleFeedback.find(item => item.id === selectedId) || visibleFeedback[0];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSubmittedId("");
    const description = [
      `What happened\n${details.trim()}`,
      expected.trim() ? `What was expected\n${expected.trim()}` : "",
      steps.trim() ? `Steps to reproduce\n${steps.trim()}` : "",
      referenceUrl.trim()
        ? `Screenshot or recording\n${referenceUrl.trim()}`
        : "",
      `Reported impact\n${impact}`,
      contextBlock(),
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      const result = await platformApi.createSupportTicket({
        category: type,
        priority: priorityForImpact(impact),
        subject: title.trim(),
        description,
        ...(user ? {} : { email: email.trim(), name: name.trim() }),
      });
      setSubmittedId(result.ticket.id);
      setTitle("");
      setDetails("");
      setExpected("");
      setSteps("");
      setReferenceUrl("");
      if (owner) await loadInbox();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The report could not be submitted."
      );
    } finally {
      setBusy(false);
    }
  };

  const updateItem = async (
    item: FeedbackRecord,
    changes: Partial<Pick<FeedbackRecord, "status" | "priority">>
  ) => {
    if (savingId) return;
    setSavingId(item.id);
    setError("");
    try {
      const result = await platformApi.updateFeedback({
        id: item.id,
        status: changes.status || item.status,
        priority: changes.priority || item.priority,
      });
      setFeedback(current =>
        current.map(candidate =>
          candidate.id === item.id ? result.feedback : candidate
        )
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Update failed.");
    } finally {
      setSavingId("");
    }
  };

  return (
    <div className="space-y-8">
      {owner ? (
        <OwnerInbox
          feedback={feedback}
          visibleFeedback={visibleFeedback}
          selected={selected}
          loading={inboxLoading}
          savingId={savingId}
          search={search}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          setSearch={setSearch}
          setStatusFilter={setStatusFilter}
          setTypeFilter={setTypeFilter}
          setSelectedId={setSelectedId}
          updateItem={updateItem}
        />
      ) : null}

      <section
        id="send-feedback"
        className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
      >
        <form
          onSubmit={submit}
          className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mono-eyebrow text-primary">
                {isItalian ? "Aiutaci a migliorare" : "Help us improve"}
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                {isItalian ? "Invia un report" : "Send a report"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-foreground/55">
                {isItalian
                  ? "Segnala un problema o proponi un miglioramento. Il contesto tecnico viene aggiunto automaticamente."
                  : "Report a problem or suggest an improvement. Technical context is attached automatically."}
              </p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600">
              <ShieldCheck className="h-3.5 w-3.5" />
              {isItalian ? "Nessun dato sensibile" : "No sensitive data"}
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <TypeButton
              active={type === "bug"}
              icon={AlertTriangle}
              title={isItalian ? "Segnala un bug" : "Report a bug"}
              description={
                isItalian
                  ? "Qualcosa non funziona come dovrebbe"
                  : "Something is not working as expected"
              }
              onClick={() => setType("bug")}
            />
            <TypeButton
              active={type === "feedback"}
              icon={Lightbulb}
              title={
                isItalian
                  ? "Suggerisci un miglioramento"
                  : "Suggest an improvement"
              }
              description={
                isItalian
                  ? "Un’idea per rendere REELassati migliore"
                  : "An idea that would make REELassati better"
              }
              onClick={() => setType("feedback")}
            />
          </div>

          <div className="mt-6 grid gap-5">
            {!user ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={isItalian ? "Nome" : "Name"}>
                  <input
                    value={name}
                    onChange={event =>
                      setName(event.target.value.slice(0, 120))
                    }
                    required
                    className={FIELD_INPUT}
                    autoComplete="name"
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={email}
                    onChange={event =>
                      setEmail(event.target.value.slice(0, 254))
                    }
                    required
                    className={FIELD_INPUT}
                    autoComplete="email"
                  />
                </Field>
              </div>
            ) : null}

            <Field label={isItalian ? "Titolo" : "Title"}>
              <input
                value={title}
                onChange={event => setTitle(event.target.value.slice(0, 180))}
                required
                minLength={4}
                placeholder={
                  type === "bug"
                    ? "Example: Video export stops at 80%"
                    : "Example: Add reusable caption presets"
                }
                className={FIELD_INPUT}
              />
            </Field>

            <Field
              label={
                type === "bug"
                  ? isItalian
                    ? "Cosa è successo?"
                    : "What happened?"
                  : isItalian
                    ? "Cosa dovremmo migliorare?"
                    : "What should we improve?"
              }
            >
              <textarea
                value={details}
                onChange={event =>
                  setDetails(event.target.value.slice(0, 3600))
                }
                required
                minLength={10}
                rows={5}
                className={`${FIELD_INPUT} resize-y`}
                placeholder={
                  isItalian
                    ? "Descrivi il problema o l’idea con il maggior dettaglio possibile."
                    : "Describe the problem or idea with as much useful detail as possible."
                }
              />
            </Field>

            {type === "bug" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <Field
                  label={isItalian ? "Risultato atteso" : "Expected result"}
                >
                  <textarea
                    value={expected}
                    onChange={event =>
                      setExpected(event.target.value.slice(0, 1200))
                    }
                    rows={3}
                    className={`${FIELD_INPUT} resize-y`}
                  />
                </Field>
                <Field
                  label={
                    isItalian ? "Passaggi per riprodurlo" : "Steps to reproduce"
                  }
                >
                  <textarea
                    value={steps}
                    onChange={event =>
                      setSteps(event.target.value.slice(0, 1600))
                    }
                    rows={3}
                    className={`${FIELD_INPUT} resize-y`}
                    placeholder="1. Open…\n2. Select…\n3. Click…"
                  />
                </Field>
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <Field label={isItalian ? "Impatto" : "Impact"}>
                <select
                  value={impact}
                  onChange={event => setImpact(event.target.value as Impact)}
                  className={FIELD_INPUT}
                >
                  <option value="blocking">Blocking — I cannot continue</option>
                  <option value="major">
                    Major — important workflow affected
                  </option>
                  <option value="minor">Minor — workaround available</option>
                  <option value="idea">Idea — improvement request</option>
                </select>
              </Field>
              <Field
                label={
                  isItalian
                    ? "Link screenshot/video (facoltativo)"
                    : "Screenshot/video link (optional)"
                }
              >
                <input
                  type="url"
                  value={referenceUrl}
                  onChange={event =>
                    setReferenceUrl(event.target.value.slice(0, 1000))
                  }
                  placeholder="https://…"
                  className={FIELD_INPUT}
                />
              </Field>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {submittedId ? (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="font-medium">
                  {isItalian ? "Report ricevuto" : "Report received"}
                </p>
                <p className="mt-0.5 text-foreground/55">
                  {isItalian ? "Riferimento" : "Reference"}: {submittedId}
                </p>
              </div>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={
              busy || title.trim().length < 4 || details.trim().length < 10
            }
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_14px_34px_-18px_hsl(var(--primary))] transition hover:-translate-y-0.5 hover:bg-primary-hover disabled:translate-y-0 disabled:opacity-45 sm:w-auto"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageSquareMore className="h-4 w-4" />
            )}
            {isItalian ? "Invia report" : "Submit report"}
          </button>
        </form>

        <aside className="space-y-4">
          <InfoCard
            icon={Sparkles}
            title={isItalian ? "Cosa succede dopo" : "What happens next"}
            items={[
              isItalian
                ? "Il report entra nella coda del prodotto"
                : "Your report enters the product queue",
              isItalian
                ? "Bug e idee vengono classificati per impatto"
                : "Bugs and ideas are triaged by impact",
              isItalian
                ? "Lo stato viene aggiornato dal team"
                : "The team updates its status",
            ]}
          />
          <InfoCard
            icon={ShieldCheck}
            title={isItalian ? "Invia in sicurezza" : "Send safely"}
            items={[
              isItalian
                ? "Non includere password o codici"
                : "Never include passwords or codes",
              isItalian ? "Non condividere chiavi API" : "Never share API keys",
              isItalian
                ? "Rimuovi dati personali dai media"
                : "Remove personal data from media",
            ]}
          />
        </aside>
      </section>
    </div>
  );
}

function OwnerInbox({
  feedback,
  visibleFeedback,
  selected,
  loading,
  savingId,
  search,
  statusFilter,
  typeFilter,
  setSearch,
  setStatusFilter,
  setTypeFilter,
  setSelectedId,
  updateItem,
}: {
  feedback: FeedbackRecord[];
  visibleFeedback: FeedbackRecord[];
  selected?: FeedbackRecord;
  loading: boolean;
  savingId: string;
  search: string;
  statusFilter: FeedbackStatus | "all";
  typeFilter: FeedbackType | "all";
  setSearch: (value: string) => void;
  setStatusFilter: (value: FeedbackStatus | "all") => void;
  setTypeFilter: (value: FeedbackType | "all") => void;
  setSelectedId: (value: string) => void;
  updateItem: (
    item: FeedbackRecord,
    changes: Partial<Pick<FeedbackRecord, "status" | "priority">>
  ) => Promise<void>;
}) {
  const open = feedback.filter(item => item.status === "open").length;
  const urgent = feedback.filter(item => item.priority === "urgent").length;
  const planned = feedback.filter(item => item.status === "planned").length;
  const fixed = feedback.filter(item => item.status === "resolved").length;

  return (
    <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-surface to-surface p-5 shadow-card sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mono-eyebrow text-primary">Owner workspace</p>
          <h2 className="mt-2 text-2xl font-semibold">Feedback inbox</h2>
          <p className="mt-2 text-sm text-foreground/55">
            Review client reports, set priority, and move work through the
            product queue.
          </p>
        </div>
        <a
          href="#send-feedback"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:border-primary/30"
        >
          Submit a report <ChevronRight className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="New" value={open} tone="primary" />
        <Metric label="Urgent" value={urgent} tone="danger" />
        <Metric label="Planned" value={planned} tone="warning" />
        <Metric label="Fixed" value={fixed} tone="success" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[370px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <div className="space-y-3 border-b border-border p-3">
            <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
              <Search className="h-4 w-4 text-foreground/35" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search reports"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={statusFilter}
                onChange={event =>
                  setStatusFilter(event.target.value as FeedbackStatus | "all")
                }
                className="rounded-lg border border-border bg-surface px-2.5 py-2 text-xs"
              >
                <option value="all">All statuses</option>
                {statuses.map(status => (
                  <option value={status} key={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={event =>
                  setTypeFilter(event.target.value as FeedbackType | "all")
                }
                className="rounded-lg border border-border bg-surface px-2.5 py-2 text-xs"
              >
                <option value="all">Bugs + ideas</option>
                <option value="bug">Bugs</option>
                <option value="feedback">Ideas</option>
              </select>
            </div>
          </div>

          <div className="max-h-[520px] overflow-y-auto p-2">
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : visibleFeedback.length ? (
              visibleFeedback.map(item => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "mb-1 w-full rounded-lg border px-3 py-3 text-left transition",
                    selected?.id === item.id
                      ? "border-primary/25 bg-primary/[0.07]"
                      : "border-transparent hover:bg-foreground/[0.035]"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/45">
                      {item.type === "bug" ? (
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                      ) : (
                        <Lightbulb className="h-3 w-3 text-primary" />
                      )}
                      {item.type}
                    </span>
                    <span className="text-[10px] text-foreground/35">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-medium">
                    {item.subject}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-foreground/40">
                    <StatusDot status={item.status} />
                    {STATUS_LABELS[item.status]} · {item.priority}
                  </div>
                </button>
              ))
            ) : (
              <div className="flex h-36 flex-col items-center justify-center text-center text-sm text-foreground/45">
                <ClipboardList className="mb-2 h-5 w-5" />
                No reports match these filters.
              </div>
            )}
          </div>
        </div>

        <div className="min-h-[420px] rounded-xl border border-border bg-background p-5">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-foreground/40">
                    {selected.id}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">
                    {selected.subject}
                  </h3>
                  <p className="mt-2 text-xs text-foreground/45">
                    {selected.requesterName} · {selected.requesterEmail} ·{" "}
                    {new Date(selected.createdAt).toLocaleString()}
                  </p>
                </div>
                {savingId === selected.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : null}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Field label="Status">
                  <select
                    value={selected.status}
                    onChange={event =>
                      void updateItem(selected, {
                        status: event.target.value as FeedbackStatus,
                      })
                    }
                    className={FIELD_INPUT}
                  >
                    {statuses.map(status => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Priority">
                  <select
                    value={selected.priority}
                    onChange={event =>
                      void updateItem(selected, {
                        priority: event.target
                          .value as FeedbackRecord["priority"],
                      })
                    }
                    className={FIELD_INPUT}
                  >
                    {priorities.map(priority => (
                      <option key={priority} value={priority}>
                        {priority[0]?.toUpperCase()}
                        {priority.slice(1)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="mt-5 whitespace-pre-wrap rounded-xl bg-surface p-4 text-sm leading-relaxed text-foreground/70">
                {selected.description}
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center text-foreground/40">
              <CircleDot className="mb-3 h-6 w-6" />
              Select a report to review it.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TypeButton({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof AlertTriangle;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl border p-4 text-left transition",
        active
          ? "border-primary/35 bg-primary/[0.07] shadow-[0_12px_28px_-22px_hsl(var(--primary))]"
          : "border-border bg-background hover:border-primary/20"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          active
            ? "bg-primary/15 text-primary"
            : "bg-foreground/[0.05] text-foreground/50"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="mt-3 block text-sm font-semibold">{title}</span>
      <span className="mt-1 block text-xs leading-relaxed text-foreground/45">
        {description}
      </span>
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1.5 block font-medium">{label}</span>
      {children}
    </label>
  );
}

function InfoCard({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof Sparkles;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/80 p-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <ul className="mt-4 space-y-3 text-xs leading-relaxed text-foreground/55">
        {items.map(item => (
          <li className="flex items-start gap-2" key={item}>
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "danger" | "warning" | "success";
}) {
  const toneClass = {
    primary: "text-primary",
    danger: "text-destructive",
    warning: "text-amber-600",
    success: "text-emerald-600",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3">
      <p className="text-xs text-foreground/45">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold", toneClass)}>{value}</p>
    </div>
  );
}

function StatusDot({ status }: { status: FeedbackStatus }) {
  return (
    <span
      className={cn(
        "h-1.5 w-1.5 rounded-full",
        status === "resolved" && "bg-emerald-500",
        status === "planned" && "bg-amber-500",
        status === "in_progress" && "bg-blue-500",
        status === "closed" && "bg-foreground/30",
        status === "open" && "bg-primary"
      )}
    />
  );
}
