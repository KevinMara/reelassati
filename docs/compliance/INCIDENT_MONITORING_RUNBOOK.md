# Compliance incident and monitoring runbook

**Policy version:** `eu-ai-act-2026-08-04.v1`

**Scope:** AI origin/provenance, marking/detection, interactive transparency,
synthetic-media and public-interest disclosure, intended use, model/provider
routing, publication review/outbox, operator configuration, and preservation of
protected product behavior.

This is an operational runbook, not a statement that a particular statutory
incident-reporting regime applies. The current working engineering
classification does not identify REELassati as a high-risk AI system or
GPAI-model provider, but exact role, intended-purpose, territory, and use-case
facts still require legal verification. Qualified legal/privacy review must
decide whether a specific event triggers notification under the AI Act, GDPR,
consumer, copyright, media, cybersecurity, contractual, platform, or other law.
Do not invent a legal deadline or delay escalation while debating final labels.

As of 4 August 2026, this runbook is a required procedure, not evidence of a
working incident programme. Named owners, escalation contacts, live monitors,
alert tests, an incident exercise, lifecycle evidence, and legally reviewed
retention/notification decisions are not recorded here and remain public-launch
blockers.

The current official legal baseline is the [consolidated AI Act](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A02024R1689-20260727),
the final [Article 50 guidelines](https://digital-strategy.ec.europa.eu/en/policies/guidelines-transparency-ai-generated-content),
and the [official Article 50 Q&A](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act).

## 1. Named operational roles

Fill these in the controlled operational system before public release. Do not
invent names in source code or this repository.

```text
Incident commander:
Engineering/SRE lead:
Compliance owner:
Privacy/security owner:
Product/support lead:
Qualified legal contact:
Business/legal operator:
Upstream provider escalation contacts:
Publishing provider escalation contact:
Backup/on-call path:
Evidence storage location and access owner:
Public/customer communications approver:
```

If a role is blank, `GOV-003`, `MON-001`, and `EVD-001` are not operationally
ready for public release.

## 2. Incident definition

Open a compliance incident when there is actual or suspected failure of a
mapped control, an official interpretation materially changes, or evidence is
insufficient to show that a sensitive flow behaved correctly. Examples:

- covered AI output was returned, exported, downloaded, or published without a
  required machine-readable mark or corresponding detection means;
- the detector authenticates a forged/tampered token, leaks private owner data,
  is materially unavailable, or produces unexplained accuracy degradation;
- provenance is absent, assigned to the wrong owner, records the wrong provider/
  model/origin, disappears through a lifecycle transition, or can be altered;
- realistic synthetic media or qualifying public-interest text reached an
  audience without required human-visible disclosure;
- a claimed editorial exception lacks substantive human review, editorial
  responsibility, content binding, or was followed by material AI edits;
- publication review was bypassed, contradicted authoritative provenance, or
  was reused after material content/audience/disclosure changes;
- an ambiguous provider outcome was retried unsafely, content was duplicated,
  or the UI reported a publication state not confirmed/reconciled by provider;
- a provider/model/endpoint changed without registration, evidence, provenance,
  or release review; Kimi test mode appeared in an official/public environment;
- provider credentials or compliance records were exposed or cross-owner access
  occurred;
- prohibited/unassessed intended use was enabled or not blocked;
- interactive AI disclosure disappeared or became hidden/inaccessible;
- public copy claimed certification, Commission approval, code signatory status,
  100% compliance, or zero legal risk without an authoritative basis;
- a debugging/compliance change regressed the first-paint animation, approved
  animation sequence, navigation order, or drag-and-drop parity;
- official law/guidance/standards changed and the impact was not assessed;
- a complaint credibly alleges undisclosed synthetic media, non-consensual
  likeness/voice, rights violation, harmful manipulation, or misleading
  public-interest information.

Uncertainty is not a reason to suppress an incident. Record “suspected” and
resolve the facts.

## 3. Severity classification

| Severity                  | Criteria                                                                                                                                                                                                                                                                                                                                 | Default response posture                                                                                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SEV-0 Critical`          | Active or large-scale unmarked/undisclosed publication; non-consensual realistic person/voice; cross-owner exposure; detector forgery/tampering; prohibited/high-impact use; unsafe duplicate publication; credential compromise; ongoing material harm; or inability to determine scope while the affected public route remains active. | Immediately stop the narrow affected generation/export/publishing/detection route; preserve evidence; appoint incident commander; engage legal/privacy/security/business owner; begin scope and public-content containment. |
| `SEV-1 High`              | Confirmed control bypass or material gap with limited known exposure; marking/detector outage blocking or risking covered outputs; provider/model drift; incorrect provenance; disclosure survival failure; accepted publication not safely reconciled; repeated intended-use bypass attempts.                                           | Fail closed on affected route, investigate same operational cycle, notify relevant owners, and remediate before re-enable. Escalate to `SEV-0` if exposure/harm expands.                                                    |
| `SEV-2 Moderate`          | Isolated non-public defect, monitoring degradation, evidence gap, training lapse, inaccessible disclosure in a limited path, or product-invariant regression without external exposure.                                                                                                                                                  | Contain before next affected release, assign owner/deadline, verify no wider exposure, and add regression evidence.                                                                                                         |
| `SEV-3 Low / improvement` | Documentation drift, non-material UI inconsistency, control-test improvement, official-source update with no immediate impact.                                                                                                                                                                                                           | Track in normal change control with explicit review date; do not let unresolved items silently age into higher risk.                                                                                                        |

Severity is based on potential impact and uncertainty, not only confirmed harm.
Internal response targets are operational decisions; do not present them as EU
statutory deadlines.

## 4. First response

### 4.1 Open the incident record

Record:

```text
Incident ID:
Opened at and by:
Current severity and rationale:
Affected environment/audience/territory:
Policy version and product release:
Affected control/invariant/route IDs:
First known and last known event time:
Detection source:
Known affected owner/content/job/asset/publication IDs:
Potential public URLs/platforms:
Potential personal data, real person/voice, public-interest topic, or rights issue:
Current containment:
Incident commander and owners:
Facts confirmed / facts unknown:
Next decision time:
```

Use stable internal IDs and minimal necessary personal data. Do not paste
provider keys, full private prompts/media, contracts, or unnecessary personal
data into general tickets or chat.

### 4.2 Contain narrowly but decisively

Prefer a targeted fail-closed action that preserves unaffected product quality:

- disable the affected model/operation/output modality, export path, detector,
  destination platform, immediate publish, or scheduled submission;
- keep drafts/manual editing available when safe;
- block successful completion rather than returning unmarked covered output;
- lock ambiguous outbox intents rather than retrying blindly;
- prevent deletion/mutation of provenance, invocation, review, compliance-event,
  and outbox records;
- stop a compromised credential and rotate it through the approved secret path
  only when credential compromise is suspected/confirmed;
- preserve the prior working Studio animation/navigation/upload behavior while
  isolating a compliance route;
- suspend misleading public claims immediately if their basis is absent.

Do not globally disable the platform merely because it is simpler, unless scope
cannot be bounded or ongoing harm requires it.

### 4.3 Preserve evidence before repair

Preserve, with access controls:

- release/commit/version and hosted configuration names without secret values;
- policy version and exact runtime provider/model route;
- AI invocation IDs/status/input-output fingerprints and provider request IDs;
- provenance record, marker/token/metadata, content fingerprint and detector
  result;
- original and transformed/exported bytes or text where lawful and necessary;
- publication review, content/audience binding, canonical intent request,
  provider payload/response, state transitions and reconciliation history;
- relevant timestamps, logs, alert snapshots, screenshots/public URLs and
  customer/support report;
- provider status/incident notices and communication;
- operator identity/release status and applicable terms/policies at event time;
- chain of custody: collector, time, source, storage location and access.

Do not “clean up” malformed or failed records before preserving them. Do not
extend retention indefinitely by default; legal/privacy/security owners must set
and document proportionate retention and litigation/regulatory holds.

## 5. Investigation trees

### 5.1 Missing or failed marking/detection

1. Identify operation, modality, final-versus-intermediate status, route/model,
   time range and affected count.
2. Confirm whether Article 50(2) coverage applies; do not assume B2B or standard
   editing. Record the factual rationale.
3. Trace invocation → provenance record → marking creation → stored output →
   transformed/exported/public bytes/text → detector.
4. Determine whether failure is creation, persistence, transformation, export,
   authentication, lookup, detector availability, false result, or monitoring.
5. Test known-positive, known-negative, altered, compressed/transcoded/cropped,
   copied and tampered samples appropriate to the modality.
6. Check provider/model drift and whether inherited upstream marks were actually
   present for the route.
7. Block covered output until both marking and detection are restored and
   verified; one working component is not enough.
8. Assess already distributed outputs and whether supplemental disclosure,
   correction, replacement, takedown, customer notice, or authority contact is
   appropriate with legal/platform review.

### 5.2 Missing human-visible disclosure

1. Determine whether the content was realistic synthetic media or qualifying
   public-interest text at the time and in context.
2. Identify audience, purpose, topic, real/plausible person/object/place/event,
   creative/informative character, real person/voice, and first exposure.
3. Inspect the publication review and whether it was bound to the exact outgoing
   content/audience/version.
4. If an editorial exception was claimed, verify substantive human review,
   editorial responsibility, content hash/version, and no material AI edits
   after review.
5. Inspect the actual provider payload and destination presentation; do not rely
   on an internal preview or metadata.
6. Determine whether platform truncation/transformation, resharing, late video
   entry, localisation, accessibility, or a product bypass removed clarity.
7. Correct the public surface proportionately and preserve evidence of the
   original and corrected state.
8. Conduct separate rights/privacy/consumer/media review; disclosure does not
   legalise an otherwise unlawful output.

### 5.3 Provenance integrity or owner isolation

1. Stop affected generation/save/export/publication/detection access.
2. Determine whether the issue is missing record, wrong entity link, wrong
   provider/model/origin, client overwrite, migration loss, fingerprint mismatch,
   token forgery, cross-owner query, or signing-key compromise.
3. Preserve database rows, access logs, content fingerprints, signing-key version
   metadata, request context and affected workspace projections.
4. Never invent or backfill unknown provider/model/origin as fact. Use an
   explicit unknown/legacy remediation decision.
5. Assess personal-data/security breach implications immediately.
6. Rotate/signing-key or invalidate tokens only through a planned recovery that
   preserves verification history and affected-record mapping.
7. Reconcile every lifecycle projection and add migration/owner-boundary tests.

### 5.4 Publication review or outbox failure

1. Freeze the affected intent ID and destination; do not submit a replacement
   until provider outcome is known.
2. Compare owner, stable ID, canonical request, compliance review, media
   provenance, required disclosure, provider payload, request ID and response.
3. Inspect submission lease and every state transition: `pending`, `preparing`,
   provider call, `confirmation_pending`, accepted, workspace sync, completed.
4. Reconcile through provider status using the original request/post ID. A 409
   conflict should resolve to the original provider post where supported.
5. Never resend modified content under the original stable ID.
6. Identify duplicates/partial delivery across every selected platform and
   coordinate correction/takedown before clearing ambiguity.
7. If the provider accepted but workspace sync failed, recover from the durable
   outbox rather than creating a new post.
8. Verify that compliance review and visible disclosure survive the repaired
   path, not only idempotency.

### 5.5 Provider/model or test-mode drift

1. Record actual runtime route/model/endpoint, environment, audience and first
   drift time without exposing credentials.
2. Compare to `MODEL_PROVIDER_REGISTER.md` and release evidence.
3. Confirm Kimi test mode affected only default text and did not redirect
   analysis/transcription/speech/video.
4. Stop unregistered public routes; preserve sample outputs and invocation facts.
5. Reassess provider evidence, marking/detection, output formats, data handling,
   intended-use controls, model role and GPAI status.
6. Revalidate every affected modality before re-enable.

### 5.6 Protected UX regression

1. Determine whether the regression affects legal clarity/accessibility or only
   an approved product invariant.
2. For entry animation: test direct first paint, second-half Studio reveal,
   timing, light/dark, reduced motion, logo/wordmark and no loading flash.
3. For navigation: compare exact order/grouping on desktop/mobile/collapsed.
4. For uploads: compare picker/drop parity, local drop targets, feedback,
   validation and keyboard/touch paths.
5. Restore the recorded invariant unless an explicitly approved change replaces
   it; do not weaken compliance to restore cosmetics or vice versa.

## 6. Legal and external-notification decision

Qualified legal/privacy/security owners must record, without guessing:

```text
AI Act classification and any notification duty:
GDPR/personal-data breach assessment and clock:
Cybersecurity/contractual notification assessment:
Consumer/advertising/media/election/sector assessment:
Copyright/personality/publicity/consent assessment:
Platform/provider notification or takedown path:
Customer/affected-person communication decision:
Competent authority and territorial analysis:
Decision maker, time, sources, rationale, deadlines:
```

Do not claim that the AI Act is the only relevant law. Do not state that an
incident is non-reportable merely because REELassati is not currently classified
as high-risk or a GPAI-model provider.

## 7. Recovery and re-enable gate

The affected route may be re-enabled only when all applicable items are true:

- [ ] Scope and root cause are documented; unknown exposure is bounded.
- [ ] Ongoing public/human/data/rights harm is contained.
- [ ] Required marking and corresponding detection both pass representative
      positive/negative/transform/tamper tests.
- [ ] Provenance is authoritative, owner-scoped, lifecycle-complete, and records
      the actual provider/model.
- [ ] Required human disclosure is present in the actual outgoing/public surface
      and passes accessibility/reshare/platform checks.
- [ ] Publication review is server-enforced and bound to immutable content,
      audience, provenance, disclosure and outbox intent.
- [ ] Ambiguous provider outcomes and duplicates are reconciled.
- [ ] Provider/model route and evidence register are current; Kimi test mode is
      correct for the target audience.
- [ ] Intended-use restriction and human-review requirements pass bypass tests.
- [ ] Monitoring detects recurrence and the alert was tested.
- [ ] A regression test covers the root cause.
- [ ] Protected entry/nav/upload behavior was replayed if touched.
- [ ] Legal/privacy/security notification and communication decisions are
      recorded.
- [ ] Required reviewers approve re-enable; limitations and follow-up owner/date
      are visible.

Do not use “tests pass” as the sole re-enable rationale.

## 8. Monitoring catalogue

Thresholds below are internal safety targets, not statutory guarantees. A
successful-control target of 100% means a covered operation must not be reported
successful when the safeguard failed; it does not mean monitoring can prove
that every legal classification was correct.

| Monitor ID | Signal and expected condition                                                                                                                          | Alert / response                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `M-001`    | Successful covered AI outputs with complete invocation and provenance record: target 100%.                                                             | Any missing record: `SEV-1`; stop affected operation and trace lifecycle.                                         |
| `M-002`    | Covered final outputs reported successful with `marking.status=verified`: target 100%.                                                                 | Any `pending`/`failed` success: `SEV-1`; block output/export and investigate.                                     |
| `M-003`    | Detector known-positive/negative canary availability and correctness.                                                                                  | Availability/authenticity/result regression: `SEV-1`; disable affected claim/output path.                         |
| `M-004`    | Scheduled/published posts with current policy review bound to exact intent: target 100%.                                                               | Missing/mismatched review: `SEV-0/1` depending exposure; freeze publication path.                                 |
| `M-005`    | Triggered synthetic/public-interest posts with disclosure in actual provider payload and sampled destination: target 100%.                             | Missing disclosure: `SEV-0/1`; contain/correct public output.                                                     |
| `M-006`    | Claimed editorial exceptions with responsible person, reviewed version, substantive review, and no later material AI edit: target 100%.                | Incomplete exception: require disclosure; investigate exposed posts.                                              |
| `M-007`    | Ambiguous publishing intents by age/status; duplicate provider post IDs or content submissions: expected bounded ambiguity and zero unsafe duplicates. | Breached age window or duplicate: `SEV-1`; lock/reconcile, never blind retry.                                     |
| `M-008`    | Provider/model route equals approved release manifest; no unregistered fallback/alias drift.                                                           | Any drift: `SEV-1`; stop affected route and update evidence.                                                      |
| `M-009`    | Kimi test mode in public/official environment: expected disabled unless separately approved.                                                           | Unexpected enabled state: `SEV-1`; disable and scope affected outputs.                                            |
| `M-010`    | Operator identity/release status/readiness blockers.                                                                                                   | Public environment with missing identity or blocker: `SEV-1`; stop compliance claims/affected launch.             |
| `M-011`    | Intended-use blocks and repeated bypass patterns.                                                                                                      | Credible prohibited/high-impact use or bypass: `SEV-0/1`; contain account/route and review abuse.                 |
| `M-012`    | Cross-owner provenance, assets, reviews, intents or detector-private-data access: expected zero.                                                       | Any occurrence: `SEV-0`; security/privacy response.                                                               |
| `M-013`    | Provider keys or signing material detected in client bundle, logs, errors, workspace, tickets, or detector response: expected zero.                    | Any occurrence: `SEV-0/1`; contain, rotate if needed, scope exposure.                                             |
| `M-014`    | AI-literacy onboarding/refresher/role-change evidence current.                                                                                         | Overdue/gap: `SEV-2`; restrict untrained sensitive roles if necessary.                                            |
| `M-015`    | First-interaction cue and disclosure component present/accessibility tests passing.                                                                    | Missing/inaccessible legal cue: `SEV-1/2` by exposure.                                                            |
| `M-016`    | Entry first-paint/second-half reveal, exact navigation order, and upload/drop parity regression suite.                                                 | Product-invariant regression: `SEV-2`, or higher if it hides/bypasses a legal control.                            |
| `M-017`    | Official-source review completed and affected controls assessed.                                                                                       | Monthly/pre-release review missed or material official change: `SEV-2`; block affected release if impact unknown. |
| `M-018`    | Public compliance/certification/signatory language scan.                                                                                               | Unsupported claim: `SEV-1/2`; remove/correct and assess audience exposure.                                        |

## 9. Review cadence

- **Continuous:** `M-001`–`M-013` where telemetry and queries permit.
- **Every release affecting a mapped flow:** all relevant monitors plus the
  release evidence bundle in `CONTROL_MATRIX.md`.
- **Monthly:** marking/detection transform corpus; provider/model drift;
  unresolved outbox states; public disclosure sampling; official-source review;
  operator/readiness blockers; incident trend and corrective actions.
- **Quarterly:** provider evidence packet, owner/access review, role/GPAI
  classification, intended-use abuse patterns, AI-literacy coverage, and
  end-to-end generation → save → export → detect → review → publish exercise.
- **After material provider/law/product change:** immediate targeted review; do
  not wait for the calendar.

The review record must state query/test coverage and blind spots. “No alerts” is
not evidence when the monitor is absent or broken.

## 10. Post-incident review

Within the organisation's defined post-incident window, record:

1. factual timeline and decision log;
2. root cause and contributing organisational/technical/provider factors;
3. affected people/content/territories/routes and confirmed versus estimated
   scope;
4. control IDs that failed, detected, contained, or were absent;
5. why pre-release tests/monitoring did or did not detect the issue;
6. corrections, notifications, takedowns, provider actions and customer support;
7. code/config/process/training/documentation changes;
8. new regression tests and monitor thresholds;
9. whether role, intended use, provider evidence, policy version, legal copy, or
   public readiness changed;
10. remaining limitations, risk owner and due date;
11. sign-off and closure criteria.

Update `CONTROL_MATRIX.md`, `ARCHITECTURE_INVARIANTS.md`,
`MODEL_PROVIDER_REGISTER.md`, and `CHANGE_REVIEW_CHECKLIST.md` when the incident
reveals a durable requirement. Do not erase the historical decision or reuse a
retired control ID.

## 11. Honest closure language

Appropriate:

> The identified failure was contained, the affected flow was corrected and
> verified against the documented controls, and monitoring was added. The
> incident record lists remaining limitations and related-law review.

Not appropriate:

- “The platform is now fully EU AI Act certified.”
- “This proves 100% compliance.”
- “No legal issues remain.”
- “The provider is responsible, so REELassati has no exposure.”
- “Human review means no AI disclosure is ever required.”

Closure establishes completion of the recorded incident response, not a legal
guarantee for every current or future use.
