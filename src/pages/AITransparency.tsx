import { useUiText } from "@/lib/i18n/ui";
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
import { Link } from "react-router-dom";
import { PublicComplianceShell } from "@/components/compliance/PublicComplianceShell";

function createCopy(ui: ReturnType<typeof useUiText>) {
  return {
    back: ui("Back to home"),
    eyebrow: ui("AI transparency"),
    title: ui("Clear about where AI works—and where it does not."),
    intro:
      ui("REELassati combines manual production tools with reviewable AI assistance. This page identifies where AI is used, the information sent when you invoke it, and the controls that remain with you."),
    updated: ui("Updated 24 August 2026"),
    statusTitle: ui("Current product behavior"),
    statusBody:
      ui("This page describes the product routes currently implemented. Managed AI actions remain unavailable until the service is ready, and an interface state is never presented as evidence that generation occurred."),
    registerEyebrow: ui("System register"),
    registerTitle: ui("What uses AI"),
    registerIntro:
      ui("AI processing happens only after a person requests the relevant action. Editing, project organization, trends notes, analytics summaries, and the landing-page preview do not silently invoke AI."),
    dataEyebrow: ui("Data path"),
    dataTitle: ui("What leaves the browser"),
    dataIntro:
      ui("The task input, selected settings, and necessary technical request metadata are sent through REELassati's managed AI service. Service credentials stay on the server."),
    controlsEyebrow: ui("Human control"),
    controlsTitle: ui("Assistance stays reviewable"),
    provenanceEyebrow: ui("Output evidence"),
    provenanceTitle: ui("Inspect available provenance"),
    provenanceBody:
      ui("The detector checks for a platform record and supported file or text signals. It returns an unknown or incomplete result when evidence is absent; it never guesses that content is AI-generated."),
    provenanceAction: ui("Open provenance detector"),
    sourcesEyebrow: ui("Official reference"),
    sourcesTitle: ui("Current official sources"),
    sourcesBody:
      ui("This transparency program uses the consolidated AI Act current from 27 July 2026, its amending regulation, and the Commission’s final Article 50 guidance. Product wording stays separate so the interface remains concise."),
    consolidated: ui("Current consolidated AI Act"),
    amendment: ui("Regulation (EU) 2026/1744"),
    guidance: ui("Commission Article 50 guidelines"),
    note: ui("This page explains product behavior. It does not replace the official regulation or legal advice for a specific use."),
  };
}

function createSystems(ui: ReturnType<typeof useUiText>) {
  return [
    {
      title: ui("Writing and edit planning"),
      provider: "REELassati AI",
      detail:
        ui("Creates scripts and proposed edit operations through a managed production route."),
      input:
        ui("Prompts, brand context, interview answers, and the selected project context."),
      icon: Bot,
    },
    {
      title: ui("Video review"),
      provider: "REELassati AI",
      detail:
        ui("Reviews a supplied video for editorial hook, pacing, and time-based suggestions. Scores are rubric assessments, not predicted views."),
      input: ui("The chosen video asset or a public HTTPS video URL."),
      icon: Eye,
    },
    {
      title: ui("Transcription and speech"),
      provider: "REELassati AI",
      detail:
        ui("Turns selected media into editable text or approved copy into a generated narration asset."),
      input:
        ui("The selected audio/video for transcription, or the copy and voice ID for speech."),
      icon: Radio,
    },
    {
      title: ui("Image generation"),
      provider: "REELassati AI",
      detail:
        ui("Creates a named image from a directed prompt and stores the marked output in the private media library."),
      input: ui("The prompt, aspect ratio, resolution, and rights confirmations."),
      icon: Images,
    },
    {
      title: ui("Video generation"),
      provider: "REELassati AI",
      detail:
        ui("Generates a new clip or continues a previous one from a directed prompt and optional reference frames."),
      input:
        ui("The compiled prompt, output settings, and optional reference-frame URLs."),
      icon: FileSearch,
    },
  ];
}

function createDataSteps(ui: ReturnType<typeof useUiText>) {
  return [
    {
      label: ui("You choose"),
      detail:
        ui("Nothing is sent for AI processing or publishing until you trigger generation, analysis, transcription, speech, or publishing."),
    },
    {
      label: ui("Server mediates"),
      detail:
        ui("The browser sends the request to REELassati; service credentials are never exposed to client code."),
    },
    {
      label: ui("Managed processing"),
      detail:
        ui("The task input, selected settings, and necessary technical request metadata are transferred to the managed AI or publishing service."),
    },
    {
      label: ui("You review"),
      detail:
        ui("Returned scripts, plans, transcripts, media, and publication packages remain visible and reviewable."),
    },
  ];
}

function createControls(ui: ReturnType<typeof useUiText>) {
  return [
    {
      title: ui("Plans, not silent edits"),
      detail:
        ui("AI edit operations show an interval, reason, and confidence. They require approval and do not alter media automatically."),
    },
    {
      title: ui("Editable outputs"),
      detail:
        ui("Scripts and transcripts can be corrected before reuse. Generated media is previewed as a separate saved asset."),
    },
    {
      title: ui("Truthful uncertainty"),
      detail:
        ui("The product does not present editorial scores as measured reach or guaranteed performance."),
    },
  ];
}

export default function AITransparency() {
  const ui = useUiText();
  const copy = createCopy(ui);
  const controls = createControls(ui);
  const dataSteps = createDataSteps(ui);
  const systems = createSystems(ui);

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
        {systems.map(system => (
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
                {ui("Input transferred")}
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
          {dataSteps.map((step, index) => (
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
          {controls.map(control => (
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
        {ui(
          "Model and provenance details should travel with the saved output; the interface does not treat a filename alone as evidence."
        )}
      </div>
    </PublicComplianceShell>
  );
}
