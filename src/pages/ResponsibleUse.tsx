import { useUiText } from "@/lib/i18n/ui";
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
import { Link } from "react-router-dom";
import { PublicComplianceShell } from "@/components/compliance/PublicComplianceShell";

function createCopy(ui: ReturnType<typeof useUiText>) {
  return {
    back: ui("Back to home"),
    eyebrow: ui("Responsible use"),
    title: ui("Creative tools, with a clear boundary."),
    intro:
      ui("REELassati is intended for human-directed creative and marketing production. It is not designed to make consequential decisions about people, infer sensitive traits, or present deceptive synthetic media as authentic."),
    updated: ui("Policy · 4 August 2026"),
    scopeEyebrow: ui("Intended purpose"),
    scopeTitle: ui("Create, edit, review, deliver"),
    scopeBody:
      ui("Use the Studio to develop scripts, edit media, analyze creative structure, generate supporting shots or narration, and prepare approved content for distribution."),
    allowedTitle: ui("Designed for"),
    boundaryTitle: ui("Not supported"),
    workflowEyebrow: ui("Before delivery"),
    workflowTitle: ui("Three checks protect the work"),
    reportTitle: ui("Report misuse or a rights concern"),
    reportBody:
      ui("If content appears to misuse your likeness, voice, work, or personal information, contact the human support channel with the relevant page, asset, or publication reference."),
    reportAction: ui("Open support"),
    transparencyAction: ui("See AI transparency"),
    officialTitle: ui("Official legal reference"),
    officialBody:
      ui("This policy is informed by the consolidated AI Act current from 27 July 2026 and Regulation (EU) 2026/1744. The official text remains authoritative."),
    consolidated: ui("Current consolidated AI Act"),
    amendment: ui("2026 amending regulation"),
    closing:
      ui("When evidence is missing, pause publication and resolve the rights, review, provenance, or transparency question first."),
  };
}

function createAllowed(ui: ReturnType<typeof useUiText>) {
  return [
    ui("Original scripts, story structures, captions, and creative variants."),
    ui("Reviewable edit suggestions that a person can accept, reject, or ignore."),
    ui("Generated supporting footage or narration when you hold the necessary rights."),
    ui("Analysis of media you are authorized to process."),
    ui("Human-approved publishing and scheduling for connected accounts."),
  ];
}

function createBoundaries(ui: ReturnType<typeof useUiText>) {
  return [
    ui("Employment, worker management, education admissions, credit, insurance, housing, medical, legal, policing, migration, or similar decisions about people."),
    ui("Biometric identification or categorization, emotion inference, social scoring, or inference of sensitive personal traits."),
    ui("Manipulation, exploitation of vulnerability, unlawful surveillance, or collection of faces from the internet or CCTV to build recognition datasets."),
    ui("Non-consensual impersonation, voice or likeness cloning, intimate synthetic content, harassment, fraud, or deceptive identity claims."),
    ui("Realistic synthetic or public-interest content presented as authentic when a clear disclosure is required."),
    ui("Content that violates law, intellectual-property, privacy, publicity, platform, or contractual rights."),
  ];
}

function createWorkflow(ui: ReturnType<typeof useUiText>) {
  return [
    {
      title: ui("Rights"),
      detail:
        ui("Confirm you may use every source file, reference frame, identifiable person, voice, brand, and third-party work."),
      icon: FileCheck2,
    },
    {
      title: ui("Human review"),
      detail:
        ui("Check factual claims, identity, context, captions, timing, and the final media—not only the prompt or model response."),
      icon: UserRoundCheck,
    },
    {
      title: ui("Provenance and disclosure"),
      detail:
        ui("Preserve available origin evidence and add a clear, appropriately placed disclosure when realistic synthetic or public-interest content requires it."),
      icon: Flag,
    },
  ];
}

export default function ResponsibleUse() {
  const ui = useUiText();
  const copy = createCopy(ui);
  const workflow = createWorkflow(ui);
  const boundaries = createBoundaries(ui);
  const allowed = createAllowed(ui);

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
            {allowed.map(item => (
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
            {boundaries.map(item => (
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
          {workflow.map((step, index) => (
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
              to="/contact"
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
