import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PublicComplianceShell } from "@/components/compliance/PublicComplianceShell";
import { openPrivacyPreferences } from "@/lib/privacy-consent";
import {
  COOKIE_NOTICE_VERSION,
  LEGAL_TERMS_VERSION,
  PRIVACY_NOTICE_VERSION,
} from "@contracts/legal";

const SUPPORT_EMAIL = "reelassati@gmail.com";

function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-border py-7 first:pt-0 last:border-0 last:pb-0">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-foreground/70">
        {children}
      </div>
    </section>
  );
}

function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5">{children}</ul>;
}

function Page({
  eyebrow,
  title,
  intro,
  version,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  version: string;
  children: ReactNode;
}) {
  const { i18n } = useTranslation();
  const it = i18n.resolvedLanguage?.startsWith("it");
  return (
    <PublicComplianceShell
      backLabel={it ? "Torna a REELassati" : "Back to REELassati"}
      eyebrow={eyebrow}
      title={title}
      intro={intro}
      updatedLabel={`${it ? "Aggiornato" : "Updated"} · ${version}`}
    >
      <article className="mx-auto max-w-4xl rounded-2xl border border-border bg-surface p-6 shadow-card md:p-10">
        {children}
      </article>
    </PublicComplianceShell>
  );
}

export function PrivacyPolicy() {
  const { i18n } = useTranslation();
  const it = i18n.resolvedLanguage?.startsWith("it");
  return (
    <Page
      eyebrow={it ? "Privacy" : "Privacy"}
      title={it ? "Informativa sulla privacy" : "Privacy notice"}
      intro={
        it
          ? "Come REELassati tratta i dati necessari per fornire account, strumenti creativi, pagamenti, assistenza e pubblicazione collegata."
          : "How REELassati handles the data needed to provide accounts, creative tools, payments, support, and connected publishing."
      }
      version={PRIVACY_NOTICE_VERSION}
    >
      <LegalSection
        title={it ? "Titolare e contatti" : "Controller and contact"}
      >
        <p>
          {it
            ? "Il servizio è REELassati, operato dall’Italia. I dati identificativi completi dell’operatore devono essere indicati nella pagina Informazioni legali e nei documenti di pagamento. Per privacy e diritti:"
            : "The service is REELassati, operated from Italy. Complete operator identity details must be stated in the Legal notice and payment documents. For privacy and rights:"}{" "}
          <a
            className="text-primary underline"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
      <LegalSection title={it ? "Dati trattati" : "Data we process"}>
        <LegalList>
          <li>
            {it
              ? "Dati account e autenticazione: nome, email, identificatori e stato della sessione."
              : "Account and authentication data: name, email, identifiers, and session status."}
          </li>
          <li>
            {it
              ? "Contenuti e istruzioni scelti dall’utente: prompt, script, file, media, progetti, preferenze e output."
              : "User-selected content and instructions: prompts, scripts, files, media, projects, preferences, and outputs."}
          </li>
          <li>
            {it
              ? "Dati di servizio: utilizzo dei crediti, cronologia delle operazioni, errori, sicurezza, provenienza dei contenuti e revisioni."
              : "Service data: credit usage, operation history, errors, security, content provenance, and reviews."}
          </li>
          <li>
            {it
              ? "Pagamenti e abbonamenti gestiti da Stripe. REELassati non memorizza i numeri completi delle carte."
              : "Payments and subscriptions handled by Stripe. REELassati does not store full card numbers."}
          </li>
          <li>
            {it
              ? "Account social, pianificazioni e metriche quando l’utente collega volontariamente un servizio compatibile."
              : "Social accounts, schedules, and metrics when a user voluntarily connects a compatible service."}
          </li>
          <li>
            {it
              ? "Messaggi di assistenza, feedback e richieste relative all’account."
              : "Support messages, feedback, and account-related requests."}
          </li>
          <li>
            {it
              ? "Analytics facoltativi solo dopo consenso; nessun analytics facoltativo viene avviato prima della scelta."
              : "Optional analytics only after consent; optional analytics does not start before a choice."}
          </li>
        </LegalList>
      </LegalSection>
      <LegalSection
        title={it ? "Finalità e basi giuridiche" : "Purposes and legal bases"}
      >
        <LegalList>
          <li>
            {it
              ? "Esecuzione del contratto: creare e proteggere l’account, fornire gli strumenti richiesti, conservare progetti, gestire crediti, pagamenti e pubblicazione."
              : "Contract performance: create and protect the account, provide requested tools, store projects, and handle credits, billing, and publishing."}
          </li>
          <li>
            {it
              ? "Obblighi di legge: contabilità, fiscalità, richieste delle autorità e tutela dei consumatori."
              : "Legal obligations: accounting, tax, authority requests, and consumer protection."}
          </li>
          <li>
            {it
              ? "Interesse legittimo: sicurezza, prevenzione abusi, affidabilità, difesa di diritti e metriche operative strettamente necessarie, bilanciato con i diritti degli utenti."
              : "Legitimate interests: security, abuse prevention, reliability, legal claims, and strictly necessary operational measurement, balanced against user rights."}
          </li>
          <li>
            {it
              ? "Consenso: analytics facoltativi e caricamento di player social esterni; il consenso può essere revocato in qualsiasi momento."
              : "Consent: optional analytics and external social players; consent can be withdrawn at any time."}
          </li>
        </LegalList>
      </LegalSection>
      <LegalSection
        title={it ? "Fornitori e destinatari" : "Providers and recipients"}
      >
        <p>
          {it
            ? "I dati sono condivisi solo quando necessario con categorie di fornitori che supportano il servizio:"
            : "Data is shared only when needed with provider categories supporting the service:"}
        </p>
        <LegalList>
          <li>
            {it
              ? "hosting, rete, archiviazione, database e autenticazione (Cloudflare/Sites, Vercel e Supabase);"
              : "hosting, network, storage, database, and authentication (Cloudflare/Sites, Vercel, and Supabase);"}
          </li>
          <li>
            {it
              ? "pagamenti, fatturazione e gestione fiscale (Stripe);"
              : "payments, billing, and tax handling (Stripe);"}
          </li>
          <li>
            {it
              ? "fornitori AI instradati dal backend per il solo compito richiesto;"
              : "AI providers routed by the backend for the requested task only;"}
          </li>
          <li>
            {it
              ? "pubblicazione e piattaforme social scelte dall’utente (Zernio e piattaforme collegate);"
              : "publishing and social platforms selected by the user (Zernio and connected platforms);"}
          </li>
          <li>
            {it
              ? "assistenza, email e analytics facoltativi (PostHog e Vercel Analytics, se autorizzati)."
              : "support, email, and optional analytics (PostHog and Vercel Analytics, if allowed)."}
          </li>
        </LegalList>
        <p>
          {it
            ? "Alcuni fornitori possono trattare dati fuori dallo SEE. In tali casi vengono utilizzati i meccanismi di trasferimento applicabili, come decisioni di adeguatezza o clausole contrattuali standard, secondo il fornitore e il servizio."
            : "Some providers may process data outside the EEA. Where applicable, transfers rely on available safeguards such as adequacy decisions or standard contractual clauses, depending on the provider and service."}
        </p>
      </LegalSection>
      <LegalSection
        title={it ? "Conservazione e sicurezza" : "Retention and security"}
      >
        <p>
          {it
            ? "I dati dell’account e dei progetti sono conservati finché l’account è attivo o finché servono a erogare il servizio. Dopo cancellazione vengono rimossi secondo i cicli tecnici di backup, salvo dati da conservare per legge, controversie, sicurezza o contabilità. Log e record operativi sono conservati per il tempo proporzionato allo scopo. Le credenziali dei fornitori restano sul server e i webhook di pagamento sono verificati crittograficamente."
            : "Account and project data is kept while the account is active or as needed to provide the service. After deletion it is removed through technical backup cycles, except data retained for law, disputes, security, or accounting. Logs and operational records are kept only for a period proportionate to their purpose. Provider credentials remain server-side and payment webhooks are cryptographically verified."}
        </p>
      </LegalSection>
      <LegalSection title={it ? "Diritti" : "Your rights"}>
        <p>
          {it
            ? "Quando applicabile, puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità o opposizione; revocare il consenso senza pregiudicare i trattamenti precedenti; e proporre reclamo al Garante per la protezione dei dati personali o all’autorità competente. Il prodotto include esportazione dati e richiesta di cancellazione nelle impostazioni."
            : "Where applicable, you may request access, correction, deletion, restriction, portability, or objection; withdraw consent without affecting prior processing; and complain to the Italian Data Protection Authority or another competent authority. Account settings include data export and a deletion-request path."}
        </p>
      </LegalSection>
      <LegalSection title={it ? "Minori e modifiche" : "Children and changes"}>
        <p>
          {it
            ? "REELassati è destinato a utenti di almeno 18 anni. Le modifiche sostanziali a questa informativa saranno comunicate in modo adeguato prima che abbiano effetto."
            : "REELassati is intended for users aged 18 or older. Material changes to this notice will be communicated appropriately before they take effect."}
        </p>
      </LegalSection>
    </Page>
  );
}

export function TermsOfService() {
  const { i18n } = useTranslation();
  const it = i18n.resolvedLanguage?.startsWith("it");
  return (
    <Page
      eyebrow={it ? "Contratto" : "Agreement"}
      title={it ? "Termini di servizio" : "Terms of service"}
      intro={
        it
          ? "Le condizioni essenziali per usare REELassati e acquistare piani o crediti."
          : "The essential terms for using REELassati and purchasing plans or credits."
      }
      version={LEGAL_TERMS_VERSION}
    >
      <LegalSection
        title={it ? "Servizio e idoneità" : "Service and eligibility"}
      >
        <p>
          {it
            ? "REELassati fornisce strumenti per ideare, creare, montare, analizzare, organizzare e pubblicare contenuti short-form. Devi avere almeno 18 anni e la capacità di concludere un contratto. Chi usa il servizio per un’organizzazione dichiara di poterla vincolare."
            : "REELassati provides tools to plan, create, edit, analyse, organise, and publish short-form content. You must be at least 18 and able to enter a contract. Anyone using the service for an organisation confirms authority to bind it."}
        </p>
      </LegalSection>
      <LegalSection
        title={it ? "Account e uso corretto" : "Account and acceptable use"}
      >
        <p>
          {it
            ? "Mantieni sicure le credenziali e fornisci informazioni accurate. Non usare il servizio per attività illegali, violazioni di diritti, impersonificazione ingannevole, contenuti non consensuali o decisioni ad alto impatto sulle persone. Si applicano anche le regole di "
            : "Keep credentials secure and provide accurate information. Do not use the service for unlawful activity, rights violations, deceptive impersonation, non-consensual content, or high-impact decisions about people. The "}
          <Link to="/responsible-use" className="text-primary underline">
            {it ? "Uso responsabile" : "Responsible Use rules"}
          </Link>
          {it ? "." : " also apply."}
        </p>
      </LegalSection>
      <LegalSection title={it ? "Contenuti e diritti" : "Content and rights"}>
        <p>
          {it
            ? "Mantieni la proprietà dei contenuti che carichi. Concedi a REELassati e ai fornitori necessari una licenza limitata a ospitare, elaborare, trasformare e trasmettere tali contenuti esclusivamente per erogare le funzioni richieste. Sei responsabile di avere diritti, licenze, consensi e autorizzazioni necessari, inclusi immagine e voce di persone reali."
            : "You keep ownership of content you upload. You grant REELassati and necessary providers a limited licence to host, process, transform, and transmit that content solely to provide requested features. You are responsible for required rights, licences, consents, and permissions, including for a real person’s image or voice."}
        </p>
        <p>
          {it
            ? "Nei limiti consentiti dai fornitori e dalla legge, puoi usare gli output creati per te. Gli output possono non essere esclusivi e non trasferiscono diritti su materiale di terzi. La revisione umana e il rispetto delle regole della piattaforma di destinazione restano necessari."
            : "To the extent permitted by providers and law, you may use outputs created for you. Outputs may not be exclusive and do not transfer third-party rights. Human review and destination-platform rules still apply."}
        </p>
      </LegalSection>
      <LegalSection
        title={it ? "Piani, crediti e rinnovi" : "Plans, credits, and renewals"}
      >
        <LegalList>
          <li>
            {it
              ? "Gli abbonamenti si rinnovano automaticamente per il periodo mostrato finché non ne disattivi il rinnovo dal portale di fatturazione."
              : "Subscriptions renew automatically for the displayed term until you disable renewal in the billing portal."}
          </li>
          <li>
            {it
              ? "I crediti inclusi vengono assegnati mensilmente e non si accumulano; nei piani annuali vengono rilasciati ogni mese."
              : "Included credits are allocated monthly and do not roll over; annual plans release them monthly."}
          </li>
          <li>
            {it
              ? "Le ricariche richiedono un abbonamento attivo, si accumulano e restano utilizzabili quando il piano è attivo. Non sono denaro, non sono trasferibili e non sono rimborsabili salvo quanto richiesto dalla legge o dalla Policy rimborsi."
              : "Top-ups require an active subscription, roll over, and remain usable while a plan is active. They are not money, are not transferable, and are non-refundable except where law or the Refund Policy requires otherwise."}
          </li>
          <li>
            {it
              ? "Il costo in crediti è mostrato prima di un’operazione. Le operazioni fallite rilasciano automaticamente i crediti riservati."
              : "The credit cost is shown before an operation. Failed operations automatically release reserved credits."}
          </li>
        </LegalList>
      </LegalSection>
      <LegalSection
        title={
          it ? "Prezzi, imposte e recesso" : "Prices, taxes, and withdrawal"
        }
      >
        <p>
          {it
            ? "Prezzo, valuta, periodo, imposte applicabili e totale sono mostrati prima del pagamento. I diritti inderogabili del consumatore, incluso il recesso quando applicabile, non sono limitati. Se chiedi l’attivazione immediata durante il periodo di recesso, si applicano le regole descritte nella "
            : "Price, currency, term, applicable tax, and total are shown before payment. Mandatory consumer rights, including withdrawal where applicable, are not limited. If you request immediate activation during a withdrawal period, the rules in the "}
          <Link to="/refunds" className="text-primary underline">
            {it ? "Policy rimborsi" : "Refund Policy"}
          </Link>
          {it ? "." : " apply."}
        </p>
      </LegalSection>
      <LegalSection
        title={
          it ? "Disponibilità e responsabilità" : "Availability and liability"
        }
      >
        <p>
          {it
            ? "Possiamo modificare o interrompere funzioni per sicurezza, legge, manutenzione o cambiamenti dei fornitori. Non promettiamo risultati di marketing, viralità o disponibilità ininterrotta. Nulla esclude responsabilità che la legge non consente di escludere, né i rimedi obbligatori per consumatori. Negli altri casi, la responsabilità complessiva relativa al servizio è limitata all’importo pagato nei 12 mesi precedenti l’evento."
            : "We may change or suspend features for security, law, maintenance, or provider changes. We do not promise marketing results, virality, or uninterrupted availability. Nothing excludes liability that law does not allow us to exclude or mandatory consumer remedies. Otherwise, total liability relating to the service is limited to the amount paid in the 12 months before the event."}
        </p>
      </LegalSection>
      <LegalSection
        title={
          it ? "Sospensione, legge e contatti" : "Suspension, law, and contact"
        }
      >
        <p>
          {it
            ? "Possiamo sospendere un account per violazioni, rischio di sicurezza, mancati pagamenti o obblighi di legge, adottando misure proporzionate. Si applica la legge italiana, senza privare i consumatori delle tutele inderogabili del paese di residenza o dei fori obbligatori. Per assistenza o reclami: "
            : "We may suspend an account for violations, security risk, non-payment, or legal duties, using proportionate measures. Italian law applies without depriving consumers of mandatory protections in their country of residence or mandatory courts. For support or complaints: "}
          <a
            className="text-primary underline"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </Page>
  );
}

export function CookiePolicy() {
  const { i18n } = useTranslation();
  const it = i18n.resolvedLanguage?.startsWith("it");
  return (
    <Page
      eyebrow="Cookies"
      title={it ? "Cookie e tecnologie locali" : "Cookies and local technology"}
      intro={
        it
          ? "Una spiegazione semplice di ciò che viene usato sempre e di ciò che dipende dalla tua scelta."
          : "A simple explanation of what is always used and what depends on your choice."
      }
      version={COOKIE_NOTICE_VERSION}
    >
      <LegalSection title={it ? "Necessari" : "Necessary"}>
        <p>
          {it
            ? "Sessione di accesso, sicurezza, prevenzione abusi, tema, lingua, workspace selezionato, stato dell’interfaccia e preferenza privacy sono necessari per fornire le funzioni richieste. Possono usare cookie, localStorage o sessionStorage e non sono impiegati per pubblicità."
            : "Sign-in sessions, security, abuse prevention, theme, language, selected workspace, interface state, and the privacy preference are needed to provide requested features. They may use cookies, localStorage, or sessionStorage and are not used for advertising."}
        </p>
      </LegalSection>
      <LegalSection title={it ? "Analytics facoltativi" : "Optional analytics"}>
        <p>
          {it
            ? "PostHog e Vercel Analytics aiutano a capire quali percorsi funzionano e dove si verificano errori. Non vengono caricati prima del consenso. REELassati evita di inviare nome ed email agli analytics e usa un identificatore account quando necessario per misurare il percorso del prodotto."
            : "PostHog and Vercel Analytics help identify useful flows and errors. They are not loaded before consent. REELassati avoids sending names and email addresses to analytics and uses an account identifier only when needed to understand the product journey."}
        </p>
      </LegalSection>
      <LegalSection title={it ? "Media esterni" : "External media"}>
        <p>
          {it
            ? "I player incorporati di TikTok, Instagram e YouTube possono ricevere indirizzo IP, dati del dispositivo e interazioni secondo le proprie policy. Restano bloccati finché non autorizzi i media esterni; puoi comunque aprire il link originale."
            : "Embedded TikTok, Instagram, and YouTube players may receive IP address, device data, and interactions under their own policies. They remain blocked until you allow external media; you can still open the original link."}
        </p>
      </LegalSection>
      <LegalSection title={it ? "Modifica o revoca" : "Change or withdraw"}>
        <p>
          {it
            ? "Rifiutare le opzioni facoltative non impedisce di usare il servizio. Puoi cambiare idea in ogni momento:"
            : "Rejecting optional choices does not prevent use of the service. You can change your choice at any time:"}
        </p>
        <button
          type="button"
          onClick={openPrivacyPreferences}
          className="rounded-pill bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:bg-primary-hover"
        >
          {it ? "Apri preferenze privacy" : "Open privacy preferences"}
        </button>
      </LegalSection>
    </Page>
  );
}

export function RefundPolicy() {
  const { i18n } = useTranslation();
  const it = i18n.resolvedLanguage?.startsWith("it");
  return (
    <Page
      eyebrow={it ? "Acquisti" : "Purchases"}
      title={it ? "Cancellazioni e rimborsi" : "Cancellations and refunds"}
      intro={
        it
          ? "Regole chiare per rinnovi, recesso, malfunzionamenti e crediti."
          : "Clear rules for renewals, withdrawal, service problems, and credits."
      }
      version={LEGAL_TERMS_VERSION}
    >
      <LegalSection title={it ? "Cancellare il rinnovo" : "Cancel renewal"}>
        <p>
          {it
            ? "Puoi disattivare il rinnovo in qualsiasi momento dal portale di fatturazione. L’accesso continua fino alla fine del periodo già pagato, salvo rimedi obbligatori o sospensione legittima. La cancellazione non rimborsa automaticamente il periodo corrente."
            : "You can disable renewal at any time in the billing portal. Access continues until the end of the paid period, subject to mandatory remedies or lawful suspension. Cancellation does not automatically refund the current term."}
        </p>
      </LegalSection>
      <LegalSection
        title={it ? "Recesso dei consumatori" : "Consumer withdrawal"}
      >
        <p>
          {it
            ? "Se acquisti come consumatore nello SEE o in un paese con diritti equivalenti, puoi avere un periodo legale di recesso, normalmente 14 giorni per i contratti a distanza. Se chiedi che il servizio inizi subito, potresti dover pagare l’importo proporzionato al servizio già fornito. La perdita del diritto per contenuti digitali avviene solo quando tutti i requisiti legali, incluso consenso espresso e presa d’atto, sono soddisfatti. Per esercitare il diritto, invia una dichiarazione inequivocabile con email account e acquisto a "
            : "If you buy as a consumer in the EEA or a country with equivalent rights, a statutory withdrawal period may apply, commonly 14 days for distance contracts. If you request immediate service, you may owe a proportionate amount for service already supplied. Loss of withdrawal rights for digital content occurs only when all legal requirements, including express consent and acknowledgement, are met. To exercise a right, send an unambiguous statement with your account email and purchase to "}
          <a
            className="text-primary underline"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
      <LegalSection
        title={
          it
            ? "Servizio difettoso e operazioni fallite"
            : "Faulty service and failed operations"
        }
      >
        <p>
          {it
            ? "I diritti legali per un servizio digitale non conforme restano validi. Le generazioni fallite rilasciano automaticamente i crediti riservati. Per addebiti duplicati, accesso mancante, crediti non consegnati o problemi persistenti, contatta l’assistenza: verificheremo i record di pagamento e utilizzo e applicheremo rimborso, riaccredito o altro rimedio appropriato."
            : "Legal remedies for a non-conforming digital service remain available. Failed generations automatically release reserved credits. For duplicate charges, missing access, undelivered credits, or persistent problems, contact support; we will verify payment and usage records and apply a refund, credit restoration, or another appropriate remedy."}
        </p>
      </LegalSection>
      <LegalSection title={it ? "Metodo e tempi" : "Method and timing"}>
        <p>
          {it
            ? "I rimborsi approvati vengono inviati al metodo di pagamento originale. I tempi finali dipendono da Stripe, banca e circuito di pagamento. Nessuna clausola di questa policy riduce diritti inderogabili."
            : "Approved refunds are returned to the original payment method. Final timing depends on Stripe, the bank, and the payment network. Nothing in this policy limits mandatory rights."}
        </p>
      </LegalSection>
    </Page>
  );
}

export function AccessibilityStatement() {
  const { i18n } = useTranslation();
  const it = i18n.resolvedLanguage?.startsWith("it");
  return (
    <Page
      eyebrow={it ? "Accessibilità" : "Accessibility"}
      title={it ? "Accessibilità di REELassati" : "REELassati accessibility"}
      intro={
        it
          ? "L’accesso al prodotto deve essere chiaro anche con tastiera, zoom, tecnologie assistive e movimento ridotto."
          : "The product should remain clear with keyboard navigation, zoom, assistive technology, and reduced motion."
      }
      version={LEGAL_TERMS_VERSION}
    >
      <LegalSection title={it ? "Approccio" : "Approach"}>
        <p>
          {it
            ? "REELassati progetta le interfacce seguendo i principi WCAG 2.2 livello AA: struttura semantica, nomi accessibili, focus visibile, contrasto, navigazione da tastiera, riduzione del movimento e feedback non basato sul solo colore. Questo è un obiettivo operativo, non una certificazione di conformità totale."
            : "REELassati designs interfaces around WCAG 2.2 AA principles: semantic structure, accessible names, visible focus, contrast, keyboard navigation, reduced motion, and feedback that does not rely on colour alone. This is an operating target, not a claim of complete certified conformance."}
        </p>
      </LegalSection>
      <LegalSection title={it ? "Segnalare una barriera" : "Report a barrier"}>
        <p>
          {it
            ? "Se una funzione non è accessibile, scrivi indicando pagina, azione, dispositivo e tecnologia assistiva. Daremo priorità alle barriere che impediscono accesso, acquisto, creazione o gestione dell’account: "
            : "If a feature is not accessible, tell us the page, action, device, and assistive technology. We prioritise barriers affecting sign-in, purchase, creation, and account management: "}
          <a
            className="text-primary underline"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </Page>
  );
}

export function LegalNotice() {
  const { i18n } = useTranslation();
  const it = i18n.resolvedLanguage?.startsWith("it");
  const legalName = import.meta.env.VITE_LEGAL_OPERATOR_NAME?.trim();
  const legalAddress = import.meta.env.VITE_LEGAL_OPERATOR_ADDRESS?.trim();
  const taxId = import.meta.env.VITE_LEGAL_OPERATOR_TAX_ID?.trim();
  return (
    <Page
      eyebrow={it ? "Operatore" : "Operator"}
      title={it ? "Informazioni legali" : "Legal notice"}
      intro={
        it
          ? "Identità e contatti del fornitore del servizio REELassati."
          : "Identity and contact details for the REELassati service provider."
      }
      version={LEGAL_TERMS_VERSION}
    >
      <LegalSection title={it ? "Fornitore del servizio" : "Service provider"}>
        <dl className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <dt className="font-medium text-foreground">
            {it ? "Servizio" : "Service"}
          </dt>
          <dd>REELassati</dd>
          <dt className="font-medium text-foreground">
            {it ? "Operatore legale" : "Legal operator"}
          </dt>
          <dd>
            {legalName ||
              (it
                ? "Da completare prima della vendita pubblica"
                : "Required before public sales")}
          </dd>
          <dt className="font-medium text-foreground">
            {it ? "Sede/indirizzo" : "Business address"}
          </dt>
          <dd>
            {legalAddress ||
              (it
                ? "Da completare prima della vendita pubblica"
                : "Required before public sales")}
          </dd>
          {taxId ? (
            <>
              <dt className="font-medium text-foreground">
                {it ? "Identificativo fiscale" : "Tax identifier"}
              </dt>
              <dd>{taxId}</dd>
            </>
          ) : null}
          <dt className="font-medium text-foreground">Email</dt>
          <dd>
            <a
              className="text-primary underline"
              href={`mailto:${SUPPORT_EMAIL}`}
            >
              {SUPPORT_EMAIL}
            </a>
          </dd>
          <dt className="font-medium text-foreground">
            {it ? "Paese" : "Country"}
          </dt>
          <dd>{it ? "Italia" : "Italy"}</dd>
        </dl>
        {!legalName || !legalAddress ? (
          <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-amber-700 dark:text-amber-300">
            {it
              ? "L’identità legale e l’indirizzo non vengono inventati. L’operatore deve configurarli prima di accettare vendite pubbliche."
              : "Legal identity and address are never invented. The operator must configure them before accepting public sales."}
          </p>
        ) : null}
      </LegalSection>
    </Page>
  );
}
