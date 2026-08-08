import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  KeyRound,
  Mail,
  Scissors,
  ShieldCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function Support() {
  const { i18n } = useTranslation();
  const isItalian = i18n.resolvedLanguage?.startsWith("it");
  const faq = isItalian
    ? [
        {
          question: "Cosa include il prezzo del piano?",
          answer:
            "Ogni piano include lo Studio e gli strumenti di workspace indicati nella pagina prezzi. L’uso di modelli e generazione video resta separato e passa dal provider collegato.",
        },
        {
          question: "Perché una funzione mostra “configurazione richiesta”?",
          answer:
            "Generazione, voce e pubblicazione dipendono da credenziali o account esterni. REELassati mostra lo stato reale invece di simulare una risposta.",
        },
        {
          question: "Le modifiche AI entrano subito nella timeline?",
          answer:
            "No. Il flusso previsto mostra intervallo, azione e motivo. Le modifiche si accettano o rifiutano e le regioni bloccate restano intatte.",
        },
        {
          question: "I preset promettono più views?",
          answer:
            "No. I preset organizzano direzione, camera, audio e vincoli. Non sono garanzie di performance.",
        },
        {
          question: "Dove trovo i miei file?",
          answer:
            "Gli asset caricati compaiono nella Library del workspace. Usa lo Studio per inserirli in un progetto e creare versioni.",
        },
      ]
    : [
        {
          question: "What is included in the plan price?",
          answer:
            "Every plan includes the Studio and the workspace tools listed on the pricing page. Model and video-generation usage stays separate and runs through the connected provider.",
        },
        {
          question: "Why does a capability say “configuration required”?",
          answer:
            "Generation, voice, and publishing depend on external credentials or connected accounts. REELassati reports the real state instead of simulating a response.",
        },
        {
          question: "Do AI changes land directly on the timeline?",
          answer:
            "No. The intended workflow shows the interval, action, and reason. Changes are accepted or rejected, and locked regions stay untouched.",
        },
        {
          question: "Do the presets promise more views?",
          answer:
            "No. Presets organize direction, camera, audio, and constraints. They are not performance guarantees.",
        },
        {
          question: "Where do uploaded files live?",
          answer:
            "Uploaded assets appear in the workspace Library. Use the Studio to add them to a project and create versions.",
        },
      ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pb-20 pt-28">
        <div className="container-page">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mono-eyebrow mb-3 text-primary">
              {isItalian
                ? "Supporto e documentazione"
                : "Support and documentation"}
            </p>
            <h1 className="text-4xl font-semibold md:text-5xl">
              {isItalian
                ? "Parti dal flusso reale."
                : "Start with the real workflow."}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-foreground/60">
              {isItalian
                ? "Guide brevi per usare lo Studio, capire cosa richiede configurazione e segnalare un problema senza passare da moduli che fingono di inviare."
                : "Short guides for using the Studio, understanding connection-gated features, and reporting an issue without a form that pretends to send."}
            </p>
          </div>

          <section
            className="mx-auto mt-14 max-w-6xl"
            aria-labelledby="quick-start-title"
          >
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="mono-eyebrow text-primary">
                  {isItalian ? "Guida rapida" : "Quick start"}
                </p>
                <h2
                  id="quick-start-title"
                  className="mt-2 text-2xl font-semibold"
                >
                  {isItalian
                    ? "Dal workspace al primo montaggio"
                    : "From workspace to first edit"}
                </h2>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <GuideCard
                icon={ShieldCheck}
                number="01"
                title={isItalian ? "Definisci il contesto" : "Set the context"}
                body={
                  isItalian
                    ? "Apri Settings e aggiungi audience, voce e regole caption del brand."
                    : "Open Settings and add the brand audience, voice, and caption behavior."
                }
                to="/dashboard/settings"
                action={isItalian ? "Apri Settings" : "Open Settings"}
              />
              <GuideCard
                icon={Scissors}
                number="02"
                title={isItalian ? "Crea un progetto" : "Create a project"}
                body={
                  isItalian
                    ? "Apri lo Studio, aggiungi materiale e seleziona l’intervallo su cui lavorare."
                    : "Open the Studio, add material, and select the range you want to work on."
                }
                to="/dashboard/edit"
                action={isItalian ? "Apri lo Studio" : "Open Studio"}
              />
              <GuideCard
                icon={KeyRound}
                number="03"
                title={
                  isItalian ? "Controlla le connessioni" : "Check connections"
                }
                body={
                  isItalian
                    ? "Prima di generare o pubblicare, verifica quali provider sono configurati nel workspace."
                    : "Before generating or publishing, verify which providers are configured in the workspace."
                }
                to="/dashboard/settings"
                action={isItalian ? "Vedi capacità" : "View capabilities"}
              />
            </div>
          </section>

          <section
            id="faq"
            className="mx-auto mt-16 grid max-w-6xl scroll-mt-24 gap-6 lg:grid-cols-[1fr_0.44fr]"
            aria-labelledby="faq-title"
          >
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" aria-hidden />
                <p className="mono-eyebrow text-primary">FAQ</p>
              </div>
              <h2 id="faq-title" className="mt-3 text-3xl font-semibold">
                {isItalian
                  ? "Risposte senza marketing."
                  : "Answers without marketing fog."}
              </h2>
              <div className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {faq.map((item, index) => (
                  <details
                    key={item.question}
                    className="group p-5"
                    open={index === 0}
                  >
                    <summary className="cursor-pointer list-none pr-8 text-sm font-semibold marker:hidden">
                      <span className="flex items-center justify-between gap-4">
                        {item.question}
                        <span
                          className="font-mono text-lg font-normal text-primary transition-transform group-open:rotate-45"
                          aria-hidden
                        >
                          +
                        </span>
                      </span>
                    </summary>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/60">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </div>

            <aside className="h-fit rounded-xl border border-primary/25 bg-primary/[0.045] p-6 lg:mt-12">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mail className="h-4 w-4" aria-hidden />
              </span>
              <h2 className="mt-5 text-xl font-semibold">
                {isItalian ? "Serve aiuto umano?" : "Need a human?"}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-foreground/60">
                {isItalian
                  ? "Apri una bozza email con il percorso, ciò che ti aspettavi e ciò che è successo. L’invio avviene solo dal tuo client email."
                  : "Open an email draft with the page, what you expected, and what happened. It is sent only if you choose to send it from your mail client."}
              </p>
              <a
                href="mailto:support@reelassati.com?subject=REELassati%20support"
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover"
              >
                {isItalian ? "Apri bozza email" : "Open email draft"}{" "}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <p className="mt-4 text-[10px] leading-relaxed text-foreground/40">
                support@reelassati.com ·{" "}
                {isItalian
                  ? "Nessun ticket viene creato automaticamente."
                  : "No ticket is created automatically."}
              </p>
            </aside>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function GuideCard({
  icon: Icon,
  number,
  title,
  body,
  to,
  action,
}: {
  icon: typeof BookOpen;
  number: string;
  title: string;
  body: string;
  to: string;
  action: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface p-6 shadow-card">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="font-mono text-[10px] text-foreground/35">
          {number}
        </span>
      </div>
      <h3 className="mt-5 text-xl font-semibold">{title}</h3>
      <p className="mt-3 min-h-[60px] text-sm leading-relaxed text-foreground/55">
        {body}
      </p>
      <Link
        to={to}
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
      >
        {action} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </article>
  );
}
