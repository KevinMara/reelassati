import {
  ArrowRight,
  Check,
  ExternalLink,
  FileCheck2,
  Flag,
  Scale,
  ShieldAlert,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { PublicComplianceShell } from "@/components/compliance/PublicComplianceShell";

type Language = "en" | "it";

const COPY = {
  en: {
    back: "Back to home",
    eyebrow: "Responsible use",
    title: "Creative tools, with a clear boundary.",
    intro:
      "REELassati is intended for human-directed creative and marketing production. It is not designed to make consequential decisions about people, infer sensitive traits, or present deceptive synthetic media as authentic.",
    updated: "Policy · 4 August 2026",
    scopeEyebrow: "Intended purpose",
    scopeTitle: "Create, edit, review, deliver",
    scopeBody:
      "Use the Studio to develop scripts, edit media, analyze creative structure, generate supporting shots or narration, and prepare approved content for distribution.",
    allowedTitle: "Designed for",
    boundaryTitle: "Not supported",
    workflowEyebrow: "Before delivery",
    workflowTitle: "Three checks protect the work",
    reportTitle: "Report misuse or a rights concern",
    reportBody:
      "If content appears to misuse your likeness, voice, work, or personal information, contact the human support channel with the relevant page, asset, or publication reference.",
    reportAction: "Open support",
    transparencyAction: "See AI transparency",
    officialTitle: "Official legal reference",
    officialBody:
      "This policy is informed by the consolidated AI Act current from 27 July 2026 and Regulation (EU) 2026/1744. The official text remains authoritative.",
    consolidated: "Current consolidated AI Act",
    amendment: "2026 amending regulation",
    closing:
      "When evidence is missing, pause publication and resolve the rights, review, provenance, or transparency question first.",
  },
  it: {
    back: "Torna alla home",
    eyebrow: "Uso responsabile",
    title: "Strumenti creativi, con un confine chiaro.",
    intro:
      "REELassati è destinato alla produzione creativa e marketing diretta da persone. Non è progettato per prendere decisioni rilevanti sulle persone, inferire caratteristiche sensibili o presentare media sintetici ingannevoli come autentici.",
    updated: "Policy · 4 agosto 2026",
    scopeEyebrow: "Finalità prevista",
    scopeTitle: "Crea, monta, revisiona, consegna",
    scopeBody:
      "Usa lo Studio per sviluppare script, montare media, analizzare la struttura creativa, generare scene o narrazioni di supporto e preparare contenuti approvati alla distribuzione.",
    allowedTitle: "Progettato per",
    boundaryTitle: "Non supportato",
    workflowEyebrow: "Prima della consegna",
    workflowTitle: "Tre controlli proteggono il lavoro",
    reportTitle: "Segnala un abuso o un problema di diritti",
    reportBody:
      "Se un contenuto sembra usare impropriamente la tua immagine, voce, opera o informazioni personali, contatta il supporto umano indicando la pagina, l’asset o la pubblicazione interessata.",
    reportAction: "Apri il supporto",
    transparencyAction: "Vedi trasparenza AI",
    officialTitle: "Riferimento giuridico ufficiale",
    officialBody:
      "Questa policy è informata dal testo consolidato dell’AI Act aggiornato al 27 luglio 2026 e dal Regolamento (UE) 2026/1744. Il testo ufficiale resta autoritativo.",
    consolidated: "AI Act consolidato attuale",
    amendment: "Regolamento di modifica 2026",
    closing:
      "Quando manca l’evidenza, sospendi la pubblicazione e risolvi prima la questione relativa a diritti, revisione, provenienza o trasparenza.",
  },
} as const;

const ALLOWED = {
  en: [
    "Original scripts, story structures, captions, and creative variants.",
    "Reviewable edit suggestions that a person can accept, reject, or ignore.",
    "Generated supporting footage or narration when you hold the necessary rights.",
    "Analysis of media you are authorized to process.",
    "Human-approved publishing and scheduling for connected accounts.",
  ],
  it: [
    "Script originali, strutture narrative, caption e varianti creative.",
    "Suggerimenti di montaggio revisionabili che una persona può accettare, rifiutare o ignorare.",
    "Scene o narrazioni generate quando possiedi i diritti necessari.",
    "Analisi di media che sei autorizzato a trattare.",
    "Pubblicazione e programmazione approvate da una persona su account collegati.",
  ],
} as const;

const BOUNDARIES = {
  en: [
    "Employment, worker management, education admissions, credit, insurance, housing, medical, legal, policing, migration, or similar decisions about people.",
    "Biometric identification or categorization, emotion inference, social scoring, or inference of sensitive personal traits.",
    "Manipulation, exploitation of vulnerability, unlawful surveillance, or collection of faces from the internet or CCTV to build recognition datasets.",
    "Non-consensual impersonation, voice or likeness cloning, intimate synthetic content, harassment, fraud, or deceptive identity claims.",
    "Realistic synthetic or public-interest content presented as authentic when a clear disclosure is required.",
    "Content that violates law, intellectual-property, privacy, publicity, platform, or contractual rights.",
  ],
  it: [
    "Decisioni su lavoro, gestione dei lavoratori, ammissione educativa, credito, assicurazioni, casa, salute, diritto, polizia, migrazione o ambiti simili.",
    "Identificazione o categorizzazione biometrica, inferenza delle emozioni, social scoring o inferenza di caratteristiche personali sensibili.",
    "Manipolazione, sfruttamento di vulnerabilità, sorveglianza illecita o raccolta di volti da internet o CCTV per creare dataset di riconoscimento.",
    "Impersonificazione senza consenso, clonazione di voce o immagine, contenuti intimi sintetici, molestie, frode o dichiarazioni d’identità ingannevoli.",
    "Contenuti sintetici realistici o di interesse pubblico presentati come autentici quando è richiesta un’indicazione chiara.",
    "Contenuti che violano legge, proprietà intellettuale, privacy, diritto all’immagine, regole di piattaforma o obblighi contrattuali.",
  ],
} as const;

const WORKFLOW = {
  en: [
    {
      title: "Rights",
      detail:
        "Confirm you may use every source file, reference frame, identifiable person, voice, brand, and third-party work.",
      icon: FileCheck2,
    },
    {
      title: "Human review",
      detail:
        "Check factual claims, identity, context, captions, timing, and the final media—not only the prompt or model response.",
      icon: UserRoundCheck,
    },
    {
      title: "Provenance and disclosure",
      detail:
        "Preserve available origin evidence and add a clear, appropriately placed disclosure when realistic synthetic or public-interest content requires it.",
      icon: Flag,
    },
  ],
  it: [
    {
      title: "Diritti",
      detail:
        "Conferma di poter usare ogni file sorgente, frame di riferimento, persona identificabile, voce, brand e opera di terzi.",
      icon: FileCheck2,
    },
    {
      title: "Revisione umana",
      detail:
        "Controlla claim, identità, contesto, caption, timing e media finale—non solo il prompt o la risposta del modello.",
      icon: UserRoundCheck,
    },
    {
      title: "Provenienza e indicazioni di trasparenza",
      detail:
        "Conserva l’evidenza disponibile sull’origine e aggiungi un’indicazione chiara e ben posizionata quando richiesta per contenuti sintetici realistici o di interesse pubblico.",
      icon: Flag,
    },
  ],
} as const;

export default function ResponsibleUse() {
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
      <section className="rounded-2xl border border-primary/25 bg-primary/[0.045] p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
          <div>
            <p className="mono-eyebrow text-primary">{copy.scopeEyebrow}</p>
            <h2 className="mt-3 text-3xl font-semibold">{copy.scopeTitle}</h2>
          </div>
          <p className="text-base leading-7 text-foreground/65">
            {copy.scopeBody}
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-border bg-surface p-6 md:p-7">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Check className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="text-xl font-semibold">{copy.allowedTitle}</h2>
          </div>
          <ul className="mt-6 space-y-4">
            {ALLOWED[language].map(item => (
              <li
                key={item}
                className="flex gap-3 text-sm leading-6 text-foreground/60"
              >
                <Check
                  className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                />
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-border bg-surface p-6 md:p-7">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="text-xl font-semibold">{copy.boundaryTitle}</h2>
          </div>
          <ul className="mt-6 space-y-4">
            {BOUNDARIES[language].map(item => (
              <li
                key={item}
                className="flex gap-3 text-sm leading-6 text-foreground/60"
              >
                <X
                  className="mt-1 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                  aria-hidden
                />
                {item}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="mt-14">
        <p className="mono-eyebrow text-primary">{copy.workflowEyebrow}</p>
        <h2 className="mt-3 text-3xl font-semibold">{copy.workflowTitle}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {WORKFLOW[language].map((step, index) => (
            <article
              key={step.title}
              className="rounded-2xl border border-border bg-surface p-6"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="font-mono text-[10px] text-foreground/35">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-foreground/55">
                {step.detail}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-primary/25 bg-primary/[0.045] p-6 md:p-7">
          <Flag className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="mt-4 text-2xl font-semibold">{copy.reportTitle}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/60">
            {copy.reportBody}
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              to="/support"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover"
            >
              {copy.reportAction} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/ai-transparency"
              className="inline-flex items-center gap-2 text-sm font-medium text-foreground/60 hover:text-foreground"
            >
              {copy.transparencyAction}{" "}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 md:p-7">
          <Scale className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="mt-4 text-xl font-semibold">{copy.officialTitle}</h2>
          <p className="mt-3 text-sm leading-6 text-foreground/55">
            {copy.officialBody}
          </p>
          <div className="mt-5 space-y-2">
            <a
              href="https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A02024R1689-20260727"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:border-primary/40 hover:text-primary-hover"
            >
              {copy.consolidated}{" "}
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </a>
            <a
              href="https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:border-primary/40 hover:text-primary-hover"
            >
              {copy.amendment}{" "}
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </a>
          </div>
        </div>
      </section>

      <p className="mt-8 flex items-start gap-2 rounded-xl border border-border bg-surface-recessed px-4 py-3 text-xs leading-5 text-foreground/50">
        <ShieldAlert
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
          aria-hidden
        />
        {copy.closing}
      </p>
    </PublicComplianceShell>
  );
}
