import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Database,
  ExternalLink,
  Eye,
  FileSearch,
  Images,
  LockKeyhole,
  Radio,
  UserCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { PublicComplianceShell } from "@/components/compliance/PublicComplianceShell";

type Language = "en" | "it";

const COPY = {
  en: {
    back: "Back to home",
    eyebrow: "AI transparency",
    title: "Clear about where AI works—and where it does not.",
    intro:
      "REELassati combines manual production tools with reviewable AI assistance. This page identifies where AI is used, the information sent when you invoke it, and the controls that remain with you.",
    updated: "Updated 24 August 2026",
    statusTitle: "Current product behavior",
    statusBody:
      "This page describes the product routes currently implemented. Managed AI actions remain unavailable until the service is ready, and an interface state is never presented as evidence that generation occurred.",
    registerEyebrow: "System register",
    registerTitle: "What uses AI",
    registerIntro:
      "AI processing happens only after a person requests the relevant action. Editing, project organization, trends notes, analytics summaries, and the landing-page preview do not silently invoke AI.",
    dataEyebrow: "Data path",
    dataTitle: "What leaves the browser",
    dataIntro:
      "The task input, selected settings, and necessary technical request metadata are sent through REELassati's managed AI service. Service credentials stay on the server.",
    controlsEyebrow: "Human control",
    controlsTitle: "Assistance stays reviewable",
    provenanceEyebrow: "Output evidence",
    provenanceTitle: "Inspect available provenance",
    provenanceBody:
      "The detector checks for a platform record and supported file or text signals. It returns an unknown or incomplete result when evidence is absent; it never guesses that content is AI-generated.",
    provenanceAction: "Open provenance detector",
    sourcesEyebrow: "Official reference",
    sourcesTitle: "Current official sources",
    sourcesBody:
      "This transparency program uses the consolidated AI Act current from 27 July 2026, its amending regulation, and the Commission’s final Article 50 guidance. Product wording stays separate so the interface remains concise.",
    consolidated: "Current consolidated AI Act",
    amendment: "Regulation (EU) 2026/1744",
    guidance: "Commission Article 50 guidelines",
    note: "This page explains product behavior. It does not replace the official regulation or legal advice for a specific use.",
  },
  it: {
    back: "Torna alla home",
    eyebrow: "Trasparenza AI",
    title: "Chiaro dove lavora l’AI—e dove non lavora.",
    intro:
      "REELassati unisce strumenti di produzione manuali e assistenza AI revisionabile. Questa pagina identifica dove viene usata l’AI, le informazioni inviate quando la attivi e i controlli che restano nelle tue mani.",
    updated: "Aggiornato il 24 agosto 2026",
    statusTitle: "Comportamento attuale del prodotto",
    statusBody:
      "Questa pagina descrive i percorsi di prodotto attualmente implementati. Le azioni AI gestite restano indisponibili finché il servizio non è pronto e nessuno stato dell’interfaccia viene presentato come prova di una generazione.",
    registerEyebrow: "Registro dei sistemi",
    registerTitle: "Cosa usa l’AI",
    registerIntro:
      "L’elaborazione AI avviene solo dopo che una persona richiede l’azione corrispondente. Montaggio, organizzazione progetti, note trend, riepiloghi analytics e anteprima nella landing non invocano l’AI in modo nascosto.",
    dataEyebrow: "Percorso dati",
    dataTitle: "Cosa lascia il browser",
    dataIntro:
      "L’input dell’attività, le impostazioni selezionate e i metadati tecnici necessari passano dal servizio AI gestito da REELassati. Le credenziali restano sul server.",
    controlsEyebrow: "Controllo umano",
    controlsTitle: "L’assistenza resta revisionabile",
    provenanceEyebrow: "Evidenza dell’output",
    provenanceTitle: "Ispeziona la provenienza disponibile",
    provenanceBody:
      "Il rilevatore cerca un record della piattaforma e segnali supportati nel file o nel testo. Se l’evidenza manca restituisce un risultato sconosciuto o incompleto; non presume mai che un contenuto sia generato dall’AI.",
    provenanceAction: "Apri il rilevatore di provenienza",
    sourcesEyebrow: "Riferimento ufficiale",
    sourcesTitle: "Fonti ufficiali attuali",
    sourcesBody:
      "Questo programma usa il testo consolidato dell’AI Act aggiornato al 27 luglio 2026, il regolamento di modifica e le linee guida finali della Commissione sull’Articolo 50. Il testo di prodotto resta separato per mantenere l’interfaccia concisa.",
    consolidated: "AI Act consolidato attuale",
    amendment: "Regolamento (UE) 2026/1744",
    guidance: "Linee guida Commissione Articolo 50",
    note: "Questa pagina spiega il comportamento del prodotto. Non sostituisce il regolamento ufficiale né una consulenza legale sul caso specifico.",
  },
} as const;

const SYSTEMS = {
  en: [
    {
      title: "Writing and edit planning",
      provider: "REELassati AI",
      detail:
        "Creates scripts and proposed edit operations through a managed production route.",
      input:
        "Prompts, brand context, interview answers, and the selected project context.",
      icon: Bot,
    },
    {
      title: "Video review",
      provider: "REELassati AI",
      detail:
        "Reviews a supplied video for editorial hook, pacing, and time-based suggestions. Scores are rubric assessments, not predicted views.",
      input: "The chosen video asset or a public HTTPS video URL.",
      icon: Eye,
    },
    {
      title: "Transcription and speech",
      provider: "REELassati AI",
      detail:
        "Turns selected media into editable text or approved copy into a generated narration asset.",
      input:
        "The selected audio/video for transcription, or the copy and voice ID for speech.",
      icon: Radio,
    },
    {
      title: "Image generation",
      provider: "REELassati AI",
      detail:
        "Creates a named image from a directed prompt and stores the marked output in the private media library.",
      input: "The prompt, aspect ratio, resolution, and rights confirmations.",
      icon: Images,
    },
    {
      title: "Video generation",
      provider: "REELassati AI",
      detail:
        "Generates a new clip or continues a previous one from a directed prompt and optional reference frames.",
      input:
        "The compiled prompt, output settings, and optional reference-frame URLs.",
      icon: FileSearch,
    },
  ],
  it: [
    {
      title: "Scrittura e piano di montaggio",
      provider: "REELassati AI",
      detail:
        "Crea script e operazioni di montaggio proposte tramite un percorso di produzione gestito.",
      input:
        "Prompt, contesto brand, risposte all’intervista e contesto del progetto selezionato.",
      icon: Bot,
    },
    {
      title: "Revisione video",
      provider: "REELassati AI",
      detail:
        "Esamina un video fornito per hook editoriale, ritmo e suggerimenti temporali. I punteggi sono valutazioni su rubrica, non previsioni di visualizzazioni.",
      input: "L’asset video scelto o un URL video HTTPS pubblico.",
      icon: Eye,
    },
    {
      title: "Trascrizione e voce",
      provider: "REELassati AI",
      detail:
        "Trasforma il media selezionato in testo modificabile o il copy approvato in una traccia di narrazione generata.",
      input:
        "Audio/video selezionato per la trascrizione, oppure copy e ID voce per la sintesi.",
      icon: Radio,
    },
    {
      title: "Generazione immagini",
      provider: "REELassati AI",
      detail:
        "Crea un’immagine nominata da un prompt e salva l’output marcato nella libreria multimediale privata.",
      input: "Prompt, proporzioni, risoluzione e conferme relative ai diritti.",
      icon: Images,
    },
    {
      title: "Generazione video",
      provider: "REELassati AI",
      detail:
        "Genera una nuova clip o continua una clip precedente da un prompt diretto e da eventuali frame di riferimento.",
      input:
        "Prompt compilato, impostazioni output ed eventuali URL dei frame di riferimento.",
      icon: FileSearch,
    },
  ],
} as const;

const DATA_STEPS = {
  en: [
    {
      label: "You choose",
      detail:
        "Nothing is sent for AI processing or publishing until you trigger generation, analysis, transcription, speech, or publishing.",
    },
    {
      label: "Server mediates",
      detail:
        "The browser sends the request to REELassati; service credentials are never exposed to client code.",
    },
    {
      label: "Managed processing",
      detail:
        "The task input, selected settings, and necessary technical request metadata are transferred to the managed AI or publishing service.",
    },
    {
      label: "You review",
      detail:
        "Returned scripts, plans, transcripts, media, and publication packages remain visible and reviewable.",
    },
  ],
  it: [
    {
      label: "Scegli tu",
      detail:
        "Nulla viene inviato per l’elaborazione AI o la pubblicazione finché non attivi generazione, analisi, trascrizione, voce o pubblicazione.",
    },
    {
      label: "Mediazione server",
      detail:
        "Il browser invia la richiesta a REELassati; le credenziali dei servizi non sono mai esposte nel codice client.",
    },
    {
      label: "Elaborazione gestita",
      detail:
        "Al servizio AI o di pubblicazione gestito passano l’input dell’attività, le impostazioni selezionate e i metadati tecnici necessari.",
    },
    {
      label: "La revisione resta a te",
      detail:
        "Script, piani, trascrizioni, media e pacchetti di pubblicazione restituiti restano visibili e revisionabili.",
    },
  ],
} as const;

const CONTROLS = {
  en: [
    {
      title: "Plans, not silent edits",
      detail:
        "AI edit operations show an interval, reason, and confidence. They require approval and do not alter media automatically.",
    },
    {
      title: "Editable outputs",
      detail:
        "Scripts and transcripts can be corrected before reuse. Generated media is previewed as a separate saved asset.",
    },
    {
      title: "Truthful uncertainty",
      detail:
        "The product does not present editorial scores as measured reach or guaranteed performance.",
    },
  ],
  it: [
    {
      title: "Piani, non modifiche nascoste",
      detail:
        "Le operazioni AI mostrano intervallo, motivo e confidenza. Richiedono approvazione e non alterano il media automaticamente.",
    },
    {
      title: "Output modificabili",
      detail:
        "Script e trascrizioni possono essere corretti prima del riuso. I media generati vengono mostrati come asset salvati separati.",
    },
    {
      title: "Incertezza dichiarata",
      detail:
        "Il prodotto non presenta punteggi editoriali come reach misurata o performance garantita.",
    },
  ],
} as const;

export default function AITransparency() {
  const { i18n } = useTranslation();
  const language: Language = i18n.resolvedLanguage?.startsWith("it")
    ? "it"
    : "en";
  const copy = COPY[language];

  return (
    <PublicComplianceShell
      backLabel={copy.back}
      eyebrow={copy.eyebrow}
      title={copy.title}
      intro={copy.intro}
      updatedLabel={copy.updated}
    >
      <section className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="rounded-2xl border border-primary/25 bg-primary/[0.045] p-6 md:p-7">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LockKeyhole className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="mt-5 text-xl font-semibold">{copy.statusTitle}</h2>
          <p className="mt-3 text-sm leading-6 text-foreground/60">
            {copy.statusBody}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 md:p-7">
          <p className="mono-eyebrow text-primary">{copy.registerEyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold">{copy.registerTitle}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground/55">
            {copy.registerIntro}
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {SYSTEMS[language].map(system => (
          <article
            key={system.title}
            className="rounded-2xl border border-border bg-surface p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <system.icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="max-w-[70%] rounded-pill bg-background px-3 py-1.5 text-right font-mono text-[9px] uppercase tracking-wider text-foreground/45">
                {system.provider}
              </span>
            </div>
            <h3 className="mt-5 text-lg font-semibold">{system.title}</h3>
            <p className="mt-2 text-sm leading-6 text-foreground/60">
              {system.detail}
            </p>
            <div className="mt-4 border-t border-border pt-4">
              <p className="font-mono text-[9px] uppercase tracking-wider text-foreground/40">
                {language === "it" ? "Input inviato" : "Input transferred"}
              </p>
              <p className="mt-1.5 text-xs leading-5 text-foreground/55">
                {system.input}
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-14 grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
        <div>
          <p className="mono-eyebrow text-primary">{copy.dataEyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold">{copy.dataTitle}</h2>
          <p className="mt-4 text-sm leading-6 text-foreground/55">
            {copy.dataIntro}
          </p>
        </div>
        <ol className="overflow-hidden rounded-2xl border border-border bg-surface">
          {DATA_STEPS[language].map((step, index) => (
            <li
              key={step.label}
              className="flex gap-4 border-b border-border p-5 last:border-b-0 md:p-6"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] text-primary">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-sm font-semibold">{step.label}</h3>
                <p className="mt-1 text-sm leading-6 text-foreground/55">
                  {step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <p className="mono-eyebrow text-primary">{copy.controlsEyebrow}</p>
        <h2 className="mt-3 text-3xl font-semibold">{copy.controlsTitle}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {CONTROLS[language].map(control => (
            <article
              key={control.title}
              className="rounded-2xl border border-border bg-surface p-5"
            >
              <UserCheck className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="mt-4 text-base font-semibold">{control.title}</h3>
              <p className="mt-2 text-sm leading-6 text-foreground/55">
                {control.detail}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-primary/25 bg-primary/[0.045] p-6 md:p-7">
          <p className="mono-eyebrow text-primary">{copy.provenanceEyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold">
            {copy.provenanceTitle}
          </h2>
          <p className="mt-3 text-sm leading-6 text-foreground/60">
            {copy.provenanceBody}
          </p>
          <Link
            to="/provenance"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover"
          >
            {copy.provenanceAction}{" "}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 md:p-7">
          <p className="mono-eyebrow text-primary">{copy.sourcesEyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold">{copy.sourcesTitle}</h2>
          <p className="mt-3 text-sm leading-6 text-foreground/60">
            {copy.sourcesBody}
          </p>
          <div className="mt-5 space-y-2">
            {[
              {
                label: copy.consolidated,
                href: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A02024R1689-20260727",
              },
              {
                label: copy.amendment,
                href: "https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng",
              },
              {
                label: copy.guidance,
                href: "https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems",
              },
            ].map(source => (
              <a
                key={source.href}
                href={source.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:border-primary/40 hover:text-primary-hover"
              >
                {source.label}{" "}
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </a>
            ))}
          </div>
          <p className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-xs leading-5 text-foreground/45">
            <CheckCircle2
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
              aria-hidden
            />
            {copy.note}
          </p>
        </div>
      </section>

      <div className="mt-10 flex items-center gap-2 rounded-xl border border-border bg-surface-recessed px-4 py-3 text-xs leading-5 text-foreground/50">
        <Database className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        {language === "it"
          ? "I dettagli del modello e della provenienza devono seguire l’output salvato; l’interfaccia non considera il solo nome del file come prova."
          : "Model and provenance details should travel with the saved output; the interface does not treat a filename alone as evidence."}
      </div>
    </PublicComplianceShell>
  );
}
