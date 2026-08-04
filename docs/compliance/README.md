# REELassati compliance governance

**Baseline date:** 4 August 2026

**Policy version:** `eu-ai-act-2026-08-04.v1`

**Product boundary:** creative and marketing content tooling

**Status:** engineering compliance baseline; not a certification or legal opinion

This directory is the durable compliance memory for REELassati. It translates
the EU AI Act requirements relevant to the current product into stable controls,
engineering invariants, evidence expectations, and release gates. It exists so
that later feature work, refactoring, debugging, model changes, or UX polishing
does not silently remove a safeguard or damage an approved product behavior.

## Required reading order

1. [`OFFICIAL_SOURCES.md`](OFFICIAL_SOURCES.md) — binding law, non-binding
   guidance, application dates, pending official materials, and claim limits.
2. [`CONTROL_MATRIX.md`](CONTROL_MATRIX.md) — stable control IDs, applicability,
   implementation objective, evidence, owner, and release consequence.
3. [`ARCHITECTURE_INVARIANTS.md`](ARCHITECTURE_INVARIANTS.md) — requirements that
   code changes must preserve, including product-quality invariants.
4. [`MODEL_PROVIDER_REGISTER.md`](MODEL_PROVIDER_REGISTER.md) — every current AI
   route, provider boundary, model default, evidence requirement, and change
   trigger.
5. [`CHANGE_REVIEW_CHECKLIST.md`](CHANGE_REVIEW_CHECKLIST.md) — mandatory impact
   assessment and sign-off checklist for relevant changes.
6. [`INCIDENT_MONITORING_RUNBOOK.md`](INCIDENT_MONITORING_RUNBOOK.md) — detection,
   containment, evidence preservation, escalation, recovery, and monitoring.
7. [`RELEASE_EVIDENCE_TEMPLATE.md`](RELEASE_EVIDENCE_TEMPLATE.md) — required
   release identity, runtime-route snapshot, verification evidence, open risks,
   decision, and post-deployment record.

Completed, deployment-specific records live in [`releases/`](releases/); they
preserve what was actually shipped and which blockers remained at that time.

## Source-of-truth order

When records conflict, use this order:

1. Applicable law and a binding decision by a competent authority or court.
2. The consolidated EU AI Act and its amending regulations.
3. Current Commission/AI Office implementation guidance and official Q&A.
4. A formally applicable code commitment, if REELassati actually signs one.
5. This control matrix and the versioned compliance contract.
6. Feature documentation, comments, tickets, and historical implementation.

Guidelines, Q&A, codes, and icons do not override the Regulation. A product
test, code comment, vendor assertion, or successful deployment never proves
legal compliance.

## Current legal and factual boundary

- The working engineering classification treats REELassati as a downstream
  **provider of an AI system** when it supplies its branded AI-enabled product,
  even though upstream models are accessed through external services. Exact
  contractual, territorial, branding, control, and market-placement facts still
  require legal verification.
- The current working classification does not treat REELassati as a provider of
  a general-purpose AI model because the architecture does not appear to
  develop, place on the market, or materially modify model weights. `GOV-001`
  requires legal reassessment if those facts change; this documentation does not
  conclusively decide the role.
- The documented intended use is creative and marketing production. Hiring,
  education, credit, insurance, essential services, medical diagnosis, legal
  decision-making, law enforcement, migration, biometric categorisation,
  emotion inference, social scoring, and other decisions materially affecting
  people are outside it and require a new legal-risk assessment. Source-level
  restrictions do not by themselves prove that terms, operations, sales, abuse
  handling, and every route enforce this boundary.
- The exact legal operator identity, entity type, provider/deployer allocation,
  first EU availability or placing-on-the-market/putting-into-service date, and
  release status remain unresolved. They are explicit public-launch blockers
  under `GOV-003`; no identity or date may be invented. The date also affects
  whether the narrow Article 50(2) transition can be considered.

## Implementation and readiness status on 4 August 2026

| Area                                   | Honest status                                                                                                                                                                                                                                                                                                                                                 | Consequence                                                                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source-level controls                  | The source tree contains a versioned compliance contract and mechanisms for invocation/provenance records, marking/detection, intended-use restrictions, contextual transparency, publication review, and outbox binding.                                                                                                                                     | Presence in source is not proof of deployed configuration, complete route coverage, legal sufficiency, operational use, or end-to-end effectiveness.                                                               |
| Marking and detection                  | A REELassati-specific signed provenance/fingerprint/token approach exists at source level. Independent cross-modality, transform, false-positive/false-negative, interoperability, detector-availability, export, download, and third-party lifecycle evidence is not yet recorded here. Official harmonised/provider-independent standards remain unsettled. | `TRN-002`, `TRN-003`, `PRV-002`, and `PRV-003` remain public-launch blockers for covered final outputs until evidence is completed. Do not call the scheme EU-certified, harmonised, or universally interoperable. |
| Provider/model evidence                | Routes and defaults are documented, but no complete, current `PE-01`–`PE-10` evidence packet, contractual allocation, independent inherited-mark test, or verified production route snapshot is recorded here.                                                                                                                                                | Upstream access or a successful provider call cannot close `SUP-001`; production reliance remains blocked or must be separately evidenced.                                                                         |
| Lifecycle and publication evidence     | Source mechanisms address provenance propagation, machine marking, disclosure review, and durable outbox state. This directory does not contain a completed generation → save → edit → Library → export/download → detect → review → publish → destination-survival evidence package for every modality.                                                      | Lifecycle/publication readiness remains open under `PRV-002`, `PUB-001`–`PUB-004`, and `EVD-001`.                                                                                                                  |
| Operator and application date          | Exact legal operator details, role allocation, release status, and first EU availability/market/service date are not supplied.                                                                                                                                                                                                                                | Public-launch readiness and any Article 50(2) transitional reliance remain unresolved.                                                                                                                             |
| AI literacy, incidents, and monitoring | Requirements, monitors, and a runbook are documented. Named accountable owners, completed role-based literacy evidence, live alert evidence, incident exercise, escalation contacts, and retention decisions are not recorded here.                                                                                                                           | `LIT-001`, `MON-001`, `EU-AI-10`, and `EU-AI-11` remain operational blockers.                                                                                                                                      |
| Other law                              | No completed legal review is recorded for GDPR/ePrivacy, copyright/licensing, likeness/voice/personality rights, consumer/advertising, DSA/platform, accessibility, security, employment, or sector rules.                                                                                                                                                    | AI Act engineering controls cannot support a “no legal issues” claim or replace separate specialist review.                                                                                                        |
| Code/certification status              | No EU certification, Commission approval, Article 50 Code signatory status, or presumption of compliance is established in this repository.                                                                                                                                                                                                                   | External claims must remain factual, scoped, and conditional.                                                                                                                                                      |
| Public readiness                       | **Blocked for any claim that REELassati is fully EU-ready, certified, or compliant.**                                                                                                                                                                                                                                                                         | Close the evidence and legal blockers, then make a dated, scoped release decision; do not convert that decision into a guarantee.                                                                                  |

## Non-negotiable release blockers

A public release must not be represented as compliant while any of these is
unresolved:

- legal operator name, address/contact presentation, and provider/deployer role
  allocation, plus the first EU availability/market/service date and release
  status;
- upstream model/service evidence sufficient for the actual routes in use;
- effective machine-readable marking **and** corresponding detection means for
  covered final outputs, supported by lifecycle, transformation,
  interoperability, availability, and error-rate evidence;
- server-enforced publication review for realistic synthetic media,
  public-interest text, rights/consent declarations, and required disclosures;
- preservation of provenance through save, edit, export, Library, and Publisher;
- role-appropriate AI-literacy measures and evidence;
- verified incident owners, escalation contacts, live monitoring, an exercise,
  and lifecycle evidence;
- legal verification of GDPR, ePrivacy, consumer, copyright, personality/right
  of publicity, platform, advertising, and sector-specific requirements.

## Honest external language

Permitted wording must be factual, scoped, and time-bound. Until the blockers
above are closed, use language such as:

> REELassati maintains source-level and governance controls designed to support
> specified EU AI Act transparency and governance obligations as currently
> interpreted. Public-release evidence, operator facts, provider evidence,
> related-law review, and operational monitoring remain subject to completion.

Do **not** claim any of the following without a separate authoritative basis:

- “EU AI Act certified,” “EU approved,” “Commission approved,” or “officially
  compliant”;
- “100% compliant,” “zero legal risk,” or “no legal issues”;
- adherence to or signatory status under a code of practice unless REELassati
  has formally signed and is listed;
- that an icon, C2PA implementation, watermark, test suite, vendor statement, or
  this documentation creates a presumption of compliance;
- that human review removes every disclosure or marking duty;
- that upstream model or platform providers carry all responsibility.

## UX quality rule

Compliance must be contextual and proportionate. Do not replace product quality
with a permanent scare banner or a blanket sentence saying AI content is
untrustworthy. Use the smallest clear surface that satisfies the relevant duty:

- a concise first-interaction cue for interactive AI;
- a compact, human-perceivable label for covered synthetic media or qualifying
  public-interest text;
- machine-readable marking that does not burden normal viewing;
- progressive disclosure for provenance details, editorial responsibility, and
  review history.

The label must still be noticeable, understandable, accessible, and present at
first exposure where required. Hiding it only in terms, settings, metadata, a
manual, or a help page is not sufficient.

## Maintenance

- Every relevant change must complete `CHANGE_REVIEW_CHECKLIST.md` and name the
  affected stable control IDs.
- Control IDs are permanent. If a control is retired, mark it `Retired`, record
  the replacement ID and reason, and never reuse the number.
- Review official sources at least monthly, before public release, after a
  material provider/model change, and after any regulator or court development.
- Evidence records must identify the deployed policy version, code version,
  provider/model routes, reviewer, date, test results, open limitations, and
  remediation owner.
- Retention periods must be set with counsel and privacy review; this repository
  deliberately does not invent a statutory retention period.
