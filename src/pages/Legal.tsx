import { useUiText } from "@/lib/i18n/ui";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

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
  const ui = useUiText();

  return (
    <PublicComplianceShell
      backLabel={ui("Back to REELassati")}
      eyebrow={eyebrow}
      title={title}
      intro={intro}
      updatedLabel={`${ui("Updated")} · ${version}`}
    >
      <article className="mx-auto max-w-4xl rounded-2xl border border-border bg-surface p-6 shadow-card md:p-10">
        {children}
      </article>
    </PublicComplianceShell>
  );
}

export function PrivacyPolicy() {
  const ui = useUiText();

  return (
    <Page
      eyebrow={ui("Privacy")}
      title={ui("Privacy notice")}
      intro={ui(
        "How REELassati handles the data needed to provide accounts, creative tools, payments, support, and connected publishing."
      )}
      version={PRIVACY_NOTICE_VERSION}
    >
      <LegalSection title={ui("Controller and contact")}>
        <p>
          {ui(
            "The service is REELassati, operated from Italy. Complete operator identity details must be stated in the Legal notice and payment documents. For privacy and rights:"
          )}{" "}
          <a
            className="text-primary underline"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
      <LegalSection title={ui("Data we process")}>
        <LegalList>
          <li>
            {ui(
              "Account and authentication data: name, email, identifiers, and session status."
            )}
          </li>
          <li>
            {ui(
              "User-selected content and instructions: prompts, scripts, files, media, projects, preferences, and outputs."
            )}
          </li>
          <li>
            {ui(
              "Service data: credit usage, operation history, errors, security, content provenance, and reviews."
            )}
          </li>
          <li>
            {ui(
              "Payments and subscriptions handled by Stripe. REELassati does not store full card numbers."
            )}
          </li>
          <li>
            {ui(
              "Social accounts, schedules, and metrics when a user voluntarily connects a compatible service."
            )}
          </li>
          <li>
            {ui("Support messages, feedback, and account-related requests.")}
          </li>
          <li>
            {ui(
              "Optional analytics only after consent; optional analytics does not start before a choice."
            )}
          </li>
        </LegalList>
      </LegalSection>
      <LegalSection title={ui("Purposes and legal bases")}>
        <LegalList>
          <li>
            {ui(
              "Contract performance: create and protect the account, provide requested tools, store projects, and handle credits, billing, and publishing."
            )}
          </li>
          <li>
            {ui(
              "Legal obligations: accounting, tax, authority requests, and consumer protection."
            )}
          </li>
          <li>
            {ui(
              "Legitimate interests: security, abuse prevention, reliability, legal claims, and strictly necessary operational measurement, balanced against user rights."
            )}
          </li>
          <li>
            {ui(
              "Consent: optional analytics and external social players; consent can be withdrawn at any time."
            )}
          </li>
        </LegalList>
      </LegalSection>
      <LegalSection title={ui("Providers and recipients")}>
        <p>
          {ui(
            "Data is shared only when needed with provider categories supporting the service:"
          )}
        </p>
        <LegalList>
          <li>
            {ui(
              "hosting, network, storage, database, and authentication (Cloudflare/Sites, Vercel, and Supabase);"
            )}
          </li>
          <li>{ui("payments, billing, and tax handling (Stripe);")}</li>
          <li>
            {ui(
              "AI providers routed by the backend for the requested task only;"
            )}
          </li>
          <li>
            {ui(
              "publishing and social platforms selected by the user (Zernio and connected platforms);"
            )}
          </li>
          <li>
            {ui(
              "support, email, and optional analytics (PostHog and Vercel Analytics, if allowed)."
            )}
          </li>
        </LegalList>
        <p>
          {ui(
            "Some providers may process data outside the EEA. Where applicable, transfers rely on available safeguards such as adequacy decisions or standard contractual clauses, depending on the provider and service."
          )}
        </p>
      </LegalSection>
      <LegalSection title={ui("Retention and security")}>
        <p>
          {ui(
            "Account and project data is kept while the account is active or as needed to provide the service. After deletion it is removed through technical backup cycles, except data retained for law, disputes, security, or accounting. Logs and operational records are kept only for a period proportionate to their purpose. Provider credentials remain server-side and payment webhooks are cryptographically verified."
          )}
        </p>
      </LegalSection>
      <LegalSection title={ui("Your rights")}>
        <p>
          {ui(
            "Where applicable, you may request access, correction, deletion, restriction, portability, or objection; withdraw consent without affecting prior processing; and complain to the Italian Data Protection Authority or another competent authority. Account settings include data export and a deletion-request path."
          )}
        </p>
      </LegalSection>
      <LegalSection title={ui("Children and changes")}>
        <p>
          {ui(
            "REELassati is intended for users aged 18 or older. Material changes to this notice will be communicated appropriately before they take effect."
          )}
        </p>
      </LegalSection>
    </Page>
  );
}

export function TermsOfService() {
  const ui = useUiText();

  return (
    <Page
      eyebrow={ui("Agreement")}
      title={ui("Terms of service")}
      intro={ui(
        "The essential terms for using REELassati and purchasing plans or credits."
      )}
      version={LEGAL_TERMS_VERSION}
    >
      <LegalSection title={ui("Service and eligibility")}>
        <p>
          {ui(
            "REELassati provides tools to plan, create, edit, analyse, organise, and publish short-form content. You must be at least 18 and able to enter a contract. Anyone using the service for an organisation confirms authority to bind it."
          )}
        </p>
      </LegalSection>
      <LegalSection title={ui("Account and acceptable use")}>
        <p>
          {ui(
            "Keep credentials secure and provide accurate information. Do not use the service for unlawful activity, rights violations, deceptive impersonation, non-consensual content, or high-impact decisions about people. The "
          )}
          <Link to="/responsible-use" className="text-primary underline">
            {ui("Responsible Use rules")}
          </Link>
          {ui(" also apply.")}
        </p>
      </LegalSection>
      <LegalSection title={ui("Content and rights")}>
        <p>
          {ui(
            "You keep ownership of content you upload. You grant REELassati and necessary providers a limited licence to host, process, transform, and transmit that content solely to provide requested features. You are responsible for required rights, licences, consents, and permissions, including for a real person’s image or voice."
          )}
        </p>
        <p>
          {ui(
            "To the extent permitted by providers and law, you may use outputs created for you. Outputs may not be exclusive and do not transfer third-party rights. Human review and destination-platform rules still apply."
          )}
        </p>
      </LegalSection>
      <LegalSection title={ui("Plans, credits, and renewals")}>
        <LegalList>
          <li>
            {ui(
              "Subscriptions renew automatically for the displayed term until you disable renewal in the billing portal."
            )}
          </li>
          <li>
            {ui(
              "Included credits are allocated monthly and do not roll over; annual plans release them monthly."
            )}
          </li>
          <li>
            {ui(
              "Top-ups require an active subscription, roll over, and remain usable while a plan is active. They are not money, are not transferable, and are non-refundable except where law or the Refund Policy requires otherwise."
            )}
          </li>
          <li>
            {ui(
              "The credit cost is shown before an operation. Failed operations automatically release reserved credits."
            )}
          </li>
        </LegalList>
      </LegalSection>
      <LegalSection title={ui("Prices, taxes, and withdrawal")}>
        <p>
          {ui(
            "Price, currency, term, applicable tax, and total are shown before payment. Mandatory consumer rights, including withdrawal where applicable, are not limited. If you request immediate activation during a withdrawal period, the rules in the "
          )}
          <Link to="/refunds" className="text-primary underline">
            {ui("Refund Policy")}
          </Link>
          {ui(" apply.")}
        </p>
      </LegalSection>
      <LegalSection title={ui("Availability and liability")}>
        <p>
          {ui(
            "We may change or suspend features for security, law, maintenance, or provider changes. We do not promise marketing results, virality, or uninterrupted availability. Nothing excludes liability that law does not allow us to exclude or mandatory consumer remedies. Otherwise, total liability relating to the service is limited to the amount paid in the 12 months before the event."
          )}
        </p>
      </LegalSection>
      <LegalSection title={ui("Suspension, law, and contact")}>
        <p>
          {ui(
            "We may suspend an account for violations, security risk, non-payment, or legal duties, using proportionate measures. Italian law applies without depriving consumers of mandatory protections in their country of residence or mandatory courts. For support or complaints: "
          )}
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
  const ui = useUiText();

  return (
    <Page
      eyebrow="Cookies"
      title={ui("Cookies and local technology")}
      intro={ui(
        "A simple explanation of what is always used and what depends on your choice."
      )}
      version={COOKIE_NOTICE_VERSION}
    >
      <LegalSection title={ui("Necessary")}>
        <p>
          {ui(
            "Sign-in sessions, security, abuse prevention, theme, language, selected workspace, interface state, and the privacy preference are needed to provide requested features. They may use cookies, localStorage, or sessionStorage and are not used for advertising."
          )}
        </p>
      </LegalSection>
      <LegalSection title={ui("Optional analytics")}>
        <p>
          {ui(
            "PostHog and Vercel Analytics help identify useful flows and errors. They are not loaded before consent. REELassati avoids sending names and email addresses to analytics and uses an account identifier only when needed to understand the product journey."
          )}
        </p>
      </LegalSection>
      <LegalSection title={ui("External media")}>
        <p>
          {ui(
            "Embedded TikTok, Instagram, and YouTube players may receive IP address, device data, and interactions under their own policies. They remain blocked until you allow external media; you can still open the original link."
          )}
        </p>
      </LegalSection>
      <LegalSection title={ui("Change or withdraw")}>
        <p>
          {ui(
            "Rejecting optional choices does not prevent use of the service. You can change your choice at any time:"
          )}
        </p>
        <button
          type="button"
          onClick={openPrivacyPreferences}
          className="rounded-pill bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:bg-primary-hover"
        >
          {ui("Open privacy preferences")}
        </button>
      </LegalSection>
    </Page>
  );
}

export function RefundPolicy() {
  const ui = useUiText();

  return (
    <Page
      eyebrow={ui("Purchases")}
      title={ui("Cancellations and refunds")}
      intro={ui(
        "Clear rules for renewals, withdrawal, service problems, and credits."
      )}
      version={LEGAL_TERMS_VERSION}
    >
      <LegalSection title={ui("Cancel renewal")}>
        <p>
          {ui(
            "You can disable renewal at any time in the billing portal. Access continues until the end of the paid period, subject to mandatory remedies or lawful suspension. Cancellation does not automatically refund the current term."
          )}
        </p>
      </LegalSection>
      <LegalSection title={ui("Consumer withdrawal")}>
        <p>
          {ui(
            "If you buy as a consumer in the EEA or a country with equivalent rights, a statutory withdrawal period may apply, commonly 14 days for distance contracts. If you request immediate service, you may owe a proportionate amount for service already supplied. Loss of withdrawal rights for digital content occurs only when all legal requirements, including express consent and acknowledgement, are met. To exercise a right, send an unambiguous statement with your account email and purchase to "
          )}
          <a
            className="text-primary underline"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
      <LegalSection title={ui("Faulty service and failed operations")}>
        <p>
          {ui(
            "Legal remedies for a non-conforming digital service remain available. Failed generations automatically release reserved credits. For duplicate charges, missing access, undelivered credits, or persistent problems, contact support; we will verify payment and usage records and apply a refund, credit restoration, or another appropriate remedy."
          )}
        </p>
      </LegalSection>
      <LegalSection title={ui("Method and timing")}>
        <p>
          {ui(
            "Approved refunds are returned to the original payment method. Final timing depends on Stripe, the bank, and the payment network. Nothing in this policy limits mandatory rights."
          )}
        </p>
      </LegalSection>
    </Page>
  );
}

export function AccessibilityStatement() {
  const ui = useUiText();

  return (
    <Page
      eyebrow={ui("Accessibility")}
      title={ui("REELassati accessibility")}
      intro={ui(
        "The product should remain clear with keyboard navigation, zoom, assistive technology, and reduced motion."
      )}
      version={LEGAL_TERMS_VERSION}
    >
      <LegalSection title={ui("Approach")}>
        <p>
          {ui(
            "REELassati designs interfaces around WCAG 2.2 AA principles: semantic structure, accessible names, visible focus, contrast, keyboard navigation, reduced motion, and feedback that does not rely on colour alone. This is an operating target, not a claim of complete certified conformance."
          )}
        </p>
      </LegalSection>
      <LegalSection title={ui("Report a barrier")}>
        <p>
          {ui(
            "If a feature is not accessible, tell us the page, action, device, and assistive technology. We prioritise barriers affecting sign-in, purchase, creation, and account management: "
          )}
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
  const ui = useUiText();

  const legalName = import.meta.env.VITE_LEGAL_OPERATOR_NAME?.trim();
  const legalAddress = import.meta.env.VITE_LEGAL_OPERATOR_ADDRESS?.trim();
  const taxId = import.meta.env.VITE_LEGAL_OPERATOR_TAX_ID?.trim();
  return (
    <Page
      eyebrow={ui("Operator")}
      title={ui("Legal notice")}
      intro={ui(
        "Identity and contact details for the REELassati service provider."
      )}
      version={LEGAL_TERMS_VERSION}
    >
      <LegalSection title={ui("Service provider")}>
        <dl className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <dt className="font-medium text-foreground">{ui("Service")}</dt>
          <dd>REELassati</dd>
          <dt className="font-medium text-foreground">
            {ui("Legal operator")}
          </dt>
          <dd>{legalName || ui("Required before public sales")}</dd>
          <dt className="font-medium text-foreground">
            {ui("Business address")}
          </dt>
          <dd>{legalAddress || ui("Required before public sales")}</dd>
          {taxId ? (
            <>
              <dt className="font-medium text-foreground">
                {ui("Tax identifier")}
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
          <dt className="font-medium text-foreground">{ui("Country")}</dt>
          <dd>{ui("Italy")}</dd>
        </dl>
        {!legalName || !legalAddress ? (
          <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-amber-700 dark:text-amber-300">
            {ui(
              "Legal identity and address are never invented. The operator must configure them before accepting public sales."
            )}
          </p>
        ) : null}
      </LegalSection>
    </Page>
  );
}
