import { Link } from "react-router-dom";
import { ArrowRight, Check, KeyRound, LockKeyhole, Route } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function Pricing() {
  const { i18n } = useTranslation();
  const isItalian = i18n.resolvedLanguage?.startsWith("it");

  const current = isItalian
    ? ["Workspace persistente", "Studio manuale con timeline", "Piani di modifica revisionabili", "Script, voice notes, obiettivi e Brand DNA", "Prompt Director con 10 preset", "Versioni e preflight"]
    : ["Persistent workspace", "Manual timeline Studio", "Reviewable edit plans", "Scripts, voice notes, goals, and Brand DNA", "Prompt Director with 10 presets", "Versions and preflight"];
  const gated = isItalian
    ? ["Generazione video tramite provider configurato", "Trascrizione e voce tramite provider configurato", "Pubblicazione dopo collegamento account autorizzato"]
    : ["Video generation through a configured provider", "Transcription and voice through a configured provider", "Publishing after an authorized account connection"];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pb-20 pt-28">
        <div className="container-page">
          <div className="mx-auto max-w-3xl text-center">
            <div className="flex justify-center">
              <span className="rounded-pill bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                {isItalian ? "Beta privata · checkpoint attuale" : "Private beta · current checkpoint"}
              </span>
            </div>
            <h1 className="mt-6 text-4xl font-semibold md:text-6xl">
              {isItalian ? "Nessun checkout finto." : "No pretend checkout."}{" "}
              <span className="serif-accent">{isItalian ? "Solo lo stato reale." : "Only the real state."}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-foreground/65">
              {isItalian
                ? "REELassati non ha ancora prezzi pubblici né billing attivo. Questo checkpoint è pensato per costruire e validare il prodotto; eventuali piani arriveranno solo con termini, limiti e costi chiari."
                : "REELassati does not yet have public pricing or active billing. This checkpoint exists to build and validate the product; plans will appear only when terms, limits, and costs can be stated clearly."}
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-6xl gap-5 lg:grid-cols-3">
            <AccessCard
              icon={LockKeyhole}
              eyebrow={isItalian ? "Disponibile ora" : "Available now"}
              title={isItalian ? "Workspace beta" : "Beta workspace"}
              body={isItalian ? "Funzioni che puoi aprire e valutare in questo checkpoint privato." : "Capabilities you can open and evaluate in this private checkpoint."}
              items={current}
              accent
            />
            <AccessCard
              icon={KeyRound}
              eyebrow={isItalian ? "Richiede configurazione" : "Configuration required"}
              title={isItalian ? "Azioni provider" : "Provider actions"}
              body={isItalian ? "Lo Studio segnala queste capacità come non disponibili finché credenziali e connessioni non sono configurate." : "The Studio reports these capabilities as unavailable until credentials and connections are configured."}
              items={gated}
            />
            <AccessCard
              icon={Route}
              eyebrow="Roadmap"
              title={isItalian ? "Loop performance" : "Performance loop"}
              body={isItalian ? "Retention e skip collegati alle decisioni esatte in timeline, per proporre una V2 informata." : "Retention and skips mapped to exact timeline decisions so the next V2 is informed by real audience behavior."}
              items={isItalian
                ? ["Import analytics autorizzato", "Mappa retention sul montaggio", "Ipotesi V2 con motivazioni"]
                : ["Authorized analytics import", "Retention mapped to the edit", "Reasoned V2 hypotheses"]}
              roadmap
            />
          </div>

          <div className="mx-auto mt-8 max-w-6xl rounded-2xl border border-border bg-surface p-7 md:p-9">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <p className="mono-eyebrow text-primary">{isItalian ? "Accesso al checkpoint" : "Checkpoint access"}</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {isItalian ? "Apri lo Studio. Nessun pagamento viene avviato." : "Open the Studio. No payment is initiated."}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/55">
                  {isItalian
                    ? "L’accesso resta sotto i controlli del proprietario del sito. I costi di provider esterni, se configurati, appartengono ai relativi account."
                    : "Access remains under the site owner’s controls. External provider costs, when configured, belong to the corresponding provider accounts."}
                </p>
              </div>
              <Link
                to="/dashboard"
                className="inline-flex shrink-0 items-center gap-2 rounded-pill bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                {isItalian ? "Apri workspace" : "Open workspace"} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function AccessCard({
  icon: Icon,
  eyebrow,
  title,
  body,
  items,
  accent = false,
  roadmap = false,
}: {
  icon: typeof Check;
  eyebrow: string;
  title: string;
  body: string;
  items: string[];
  accent?: boolean;
  roadmap?: boolean;
}) {
  return (
    <article className={`rounded-2xl border p-6 shadow-card ${
      accent ? "border-primary/35 bg-primary/[0.045]" : roadmap ? "border-dashed border-primary/30 bg-surface" : "border-border bg-surface"
    }`}>
      <div className="flex items-center justify-between gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-primary">{eyebrow}</span>
      </div>
      <h2 className="mt-6 text-2xl font-semibold">{title}</h2>
      <p className="mt-3 min-h-[64px] text-sm leading-relaxed text-foreground/55">{body}</p>
      <ul className="mt-6 space-y-3 border-t border-border pt-5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-foreground/70">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden /> {item}
          </li>
        ))}
      </ul>
    </article>
  );
}
