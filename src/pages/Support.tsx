import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowUp,
  Bot,
  CheckCircle2,
  ExternalLink,
  LifeBuoy,
  Loader2,
  Mail,
  MessageCircleMore,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  UserRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import {
  platformApi,
  type SupportMessage,
  type SupportTicketDraft,
  type SupportTicketResult,
} from "@/lib/platform-api";
import { cn } from "@/lib/utils";

const SUPPORT_EMAIL = "reelassati@gmail.com";

const starterPrompts = [
  "I can't access my account",
  "A Studio tool is not working",
  "Help me with publishing",
  "I need to open a support ticket",
];

const initialMessage: SupportMessage = {
  role: "assistant",
  content:
    "Hi — I’m REELassati Support. Tell me what you’re trying to do and what happened. I’ll troubleshoot it step by step, or prepare a complete support ticket when human help is the better route.",
};

export default function Support() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const isItalian = i18n.resolvedLanguage?.startsWith("it");
  const [messages, setMessages] = useState<SupportMessage[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actions, setActions] = useState<string[]>([]);
  const [ticketDraft, setTicketDraft] = useState<SupportTicketDraft | null>(null);
  const [ticket, setTicket] = useState<SupportTicketResult | null>(null);
  const [email, setEmail] = useState(user?.email || "");
  const [name, setName] = useState(user?.name || "");
  const [ticketBusy, setTicketBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const visibleMessages = useMemo(() => messages.slice(-12), [messages]);

  const sendMessage = async (text = input) => {
    const clean = text.trim();
    if (!clean || busy) return;
    const nextMessages = [
      ...messages,
      { role: "user", content: clean } satisfies SupportMessage,
    ];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setError("");
    setActions([]);
    try {
      const result = await platformApi.supportChat(nextMessages.slice(-10));
      setMessages(current => [
        ...current,
        { role: "assistant", content: result.reply },
      ]);
      setActions(result.suggestedActions || []);
      if (result.ticketDraft) setTicketDraft(result.ticketDraft);
      if (result.ticket) {
        setTicket(result.ticket);
        setTicketDraft(null);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : `Support could not respond. Email ${SUPPORT_EMAIL}.`
      );
    } finally {
      setBusy(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const submitTicket = async (event: FormEvent) => {
    event.preventDefault();
    if (!ticketDraft || ticketBusy) return;
    setTicketBusy(true);
    setError("");
    try {
      const result = await platformApi.createSupportTicket({
        ...ticketDraft,
        ...(user ? {} : { email: email.trim(), name: name.trim() }),
        conversation: messages.slice(-10),
      });
      setTicket(result.ticket);
      setTicketDraft(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : `The ticket could not be created. Email ${SUPPORT_EMAIL}.`
      );
    } finally {
      setTicketBusy(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      <main className="relative pb-24 pt-28">
        <div className="pointer-events-none absolute left-1/2 top-16 h-[540px] w-[900px] -translate-x-1/2 rounded-full bg-primary/[0.065] blur-[120px]" />
        <div className="container-page relative">
          <header className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-primary shadow-[0_12px_40px_-22px_hsl(var(--primary))]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-55" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {isItalian ? "Supporto ufficiale" : "Official support"}
            </div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-6xl">
              {isItalian ? "Come possiamo aiutarti?" : "How can we help?"}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty leading-relaxed text-foreground/60">
              {isItalian
                ? "Parla con l’assistente di supporto per una soluzione immediata. Se serve una persona, trasforma la conversazione in un ticket completo in un solo passaggio."
                : "Talk to the support assistant for an immediate solution. When a person is needed, turn the conversation into a complete support ticket in one step."}
            </p>
          </header>

          <section className="mx-auto mt-12 grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
            <div className="relative rounded-[24px] border border-border/90 bg-surface/95 p-2 shadow-[0_35px_90px_-48px_rgba(0,0,0,0.55),0_15px_55px_-35px_hsl(var(--primary))] backdrop-blur-xl">
              <div className="absolute inset-x-12 -top-px h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3.5 sm:px-5">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/16 to-primary/[0.035] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                    <Bot className="h-5 w-5" aria-hidden />
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-emerald-500" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold">REELassati Support</h2>
                    <p className="text-[11px] text-foreground/45">
                      {isItalian
                        ? "Assistente AI · Escalation umana"
                        : "AI assistant · Human escalation"}
                    </p>
                  </div>
                </div>
                <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-emerald-600 sm:flex">
                  <ShieldCheck className="h-3 w-3" /> Safe support
                </span>
              </div>

              <div
                className="h-[460px] space-y-5 overflow-y-auto px-3 py-5 sm:px-5"
                aria-live="polite"
              >
                {visibleMessages.map((message, index) => (
                  <ChatBubble key={`${message.role}-${index}`} message={message} />
                ))}
                {busy ? (
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Bot className="h-3.5 w-3" />
                    </span>
                    <div className="flex gap-1 rounded-2xl rounded-tl-sm border border-border bg-background px-4 py-3">
                      {[0, 1, 2].map(dot => (
                        <span
                          key={dot}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/55"
                          style={{ animationDelay: `${dot * 120}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
                {actions.length ? (
                  <div className="ml-9 grid gap-2 sm:grid-cols-2">
                    {actions.map(action => (
                      <button
                        key={action}
                        type="button"
                        onClick={() => void sendMessage(action)}
                        className="rounded-xl border border-primary/15 bg-primary/[0.035] px-3 py-2 text-left text-xs leading-relaxed text-foreground/70 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:text-foreground"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {error ? (
                <div className="mx-3 mb-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive sm:mx-5">
                  {error} You can always email{" "}
                  <a className="font-semibold underline" href={`mailto:${SUPPORT_EMAIL}`}>
                    {SUPPORT_EMAIL}
                  </a>
                  .
                </div>
              ) : null}

              <div className="border-t border-border/70 p-3 sm:p-4">
                {messages.length === 1 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {starterPrompts.map(prompt => (
                      <button
                        type="button"
                        key={prompt}
                        onClick={() => void sendMessage(prompt)}
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] text-foreground/60 transition-colors hover:border-primary/30 hover:text-foreground"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-2 shadow-inner focus-within:border-primary/35 focus-within:ring-4 focus-within:ring-primary/[0.05]">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={event => setInput(event.target.value.slice(0, 2400))}
                    onKeyDown={event => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                    rows={1}
                    placeholder={
                      isItalian
                        ? "Descrivi il problema o ciò che vuoi fare…"
                        : "Describe the problem or what you want to do…"
                    }
                    className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2.5 py-3 text-sm outline-none placeholder:text-foreground/30"
                    aria-label="Message REELassati Support"
                  />
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={!input.trim() || busy}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_10px_26px_-12px_hsl(var(--primary))] transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:translate-y-0 disabled:opacity-40"
                    aria-label="Send message"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-2 px-1 text-[10px] text-foreground/35">
                  {isItalian
                    ? "Non inviare password, codici, chiavi API o dati di pagamento."
                    : "Never send passwords, verification codes, API keys, or payment data."}
                </p>
              </div>
            </div>

            <aside className="space-y-4">
              {ticket ? (
                <TicketSuccess ticket={ticket} />
              ) : ticketDraft ? (
                <TicketForm
                  draft={ticketDraft}
                  email={email}
                  name={name}
                  signedIn={Boolean(user)}
                  busy={ticketBusy}
                  setEmail={setEmail}
                  setName={setName}
                  onSubmit={submitTicket}
                />
              ) : (
                <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <h2 className="mt-4 text-lg font-semibold">
                    {isItalian ? "Supporto che agisce" : "Support that acts"}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/55">
                    {isItalian
                      ? "L’assistente analizza il problema, propone passaggi concreti e prepara il ticket con contesto e priorità quando serve."
                      : "The assistant diagnoses the issue, gives concrete steps, and prepares a contextual, prioritized ticket when needed."}
                  </p>
                  <ul className="mt-4 space-y-3 text-xs text-foreground/60">
                    <Feature icon={MessageCircleMore} text="Immediate guided troubleshooting" />
                    <Feature icon={TicketCheck} text="One-step ticket escalation" />
                    <Feature icon={ShieldCheck} text="No sensitive credentials requested" />
                  </ul>
                </div>
              )}

              <div className="rounded-2xl border border-border bg-background/80 p-5">
                <div className="flex items-center gap-2 text-primary">
                  <Mail className="h-4 w-4" />
                  <p className="font-mono text-[10px] uppercase tracking-wider">
                    {isItalian ? "Supporto umano" : "Human support"}
                  </p>
                </div>
                <h2 className="mt-3 text-base font-semibold">{SUPPORT_EMAIL}</h2>
                <p className="mt-2 text-xs leading-relaxed text-foreground/50">
                  {isItalian
                    ? "Per richieste complesse, account, pagamenti, privacy o problemi persistenti."
                    : "For complex requests, accounts, billing, privacy, or persistent technical problems."}
                </p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=REELassati%20support`}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover"
                >
                  {isItalian ? "Invia un’email" : "Send an email"}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </aside>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function ChatBubble({ message }: { message: SupportMessage }) {
  const assistant = message.role === "assistant";
  return (
    <div className={cn("flex items-start gap-2.5", !assistant && "justify-end")}>
      {assistant ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bot className="h-3.5 w-3.5" />
        </span>
      ) : null}
      <div
        className={cn(
          "max-w-[86%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
          assistant
            ? "rounded-tl-sm border border-border bg-background text-foreground/75"
            : "rounded-tr-sm bg-primary text-primary-foreground shadow-[0_10px_26px_-18px_hsl(var(--primary))]"
        )}
      >
        {message.content}
      </div>
      {!assistant ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.06] text-foreground/55">
          <UserRound className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </div>
  );
}

function Feature({ icon: Icon, text }: { icon: typeof LifeBuoy; text: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground/[0.04] text-primary">
        <Icon className="h-3.5 w-3.5" />
      </span>
      {text}
    </li>
  );
}

function TicketForm({
  draft,
  email,
  name,
  signedIn,
  busy,
  setEmail,
  setName,
  onSubmit,
}: {
  draft: SupportTicketDraft;
  email: string;
  name: string;
  signedIn: boolean;
  busy: boolean;
  setEmail: (value: string) => void;
  setName: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-primary/20 bg-surface p-5 shadow-[0_18px_55px_-38px_hsl(var(--primary))]">
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <TicketCheck className="h-4 w-4" />
        </span>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-primary">
          {draft.priority} priority
        </span>
      </div>
      <h2 className="mt-4 text-lg font-semibold">Ticket ready</h2>
      <p className="mt-2 text-xs leading-relaxed text-foreground/50">
        The assistant prepared this escalation from your conversation. Review and send it to human support.
      </p>
      <div className="mt-4 rounded-xl border border-border bg-background p-3">
        <p className="text-xs font-semibold">{draft.subject}</p>
        <p className="mt-2 line-clamp-5 text-[11px] leading-relaxed text-foreground/50">{draft.description}</p>
      </div>
      {!signedIn ? (
        <div className="mt-3 space-y-2">
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Your name"
            maxLength={120}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs outline-none focus:border-primary/40"
          />
          <input
            type="email"
            required
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs outline-none focus:border-primary/40"
          />
        </div>
      ) : null}
      <button
        type="submit"
        disabled={busy || (!signedIn && !email.trim())}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-medium text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:translate-y-0 disabled:opacity-45"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <TicketCheck className="h-4 w-4" />}
        Create support ticket
      </button>
    </form>
  );
}

function TicketSuccess({ ticket }: { ticket: SupportTicketResult }) {
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.045] p-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
        <CheckCircle2 className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">Ticket created</h2>
      <p className="mt-2 text-xs leading-relaxed text-foreground/55">
        Reference <strong className="text-foreground">{ticket.id}</strong>. Keep this ID for any follow-up.
      </p>
      <p className="mt-3 rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-[11px] text-foreground/55">
        {ticket.emailStatus === "sent"
          ? "Human support has been notified by email."
          : `The ticket is securely recorded. For immediate delivery, also email ${ticket.supportEmail} and include the reference above.`}
      </p>
    </div>
  );
}
