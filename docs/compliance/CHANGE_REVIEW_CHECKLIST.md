# Compliance and protected-behavior change review

Complete this checklist for every change that can affect AI behavior, content
origin, upload, storage, editing, export, Library, Publisher, provider routing,
operator configuration, legal/transparency copy, Studio navigation, or entry
animation. Attach it to the controlled change/release record; do not commit
secrets, private contracts, or personal data here.

“No code change” is not an exemption. Hosted environment changes, provider/model
updates, prompt/policy changes, contract changes, operational procedures, and
public claims can all trigger this review.

## Change identity

```text
Change title:
Change/release identifier:
Author/owner:
Reviewer(s):
Date:
Target environment and audience:
Policy version before:
Policy version after:
Affected stable control IDs:
Affected invariant IDs:
Affected route IDs:
Data/schema migration:
Hosted configuration change:
Public copy/claim change:
Summary of what changes:
Summary of what explicitly does not change:
```

## 1. Trigger classification

Check every applicable item:

- [ ] New or changed AI feature, prompt, tool call, agent, model, provider,
      endpoint, model alias/version, fallback, fine-tune, retrieval source, or
      safety filter.
- [ ] New or changed text, image, audio, video, multimodal, interactive, export,
      download, share, or publication output.
- [ ] Content may now be saved, copied, edited, combined, imported, exported,
      downloaded, or published through a new path.
- [ ] Change to provenance, marking, detection, hashing, signatures, tokens,
      metadata, detector access, or compliance-event storage.
- [ ] Change to publication review, disclosure, public-interest classification,
      deepfake/realistic synthetic media, real-person/voice, rights/consent,
      audience disclosure language, editorial review, or editorial
      responsibility.
- [ ] Change to the durable outbox, canonical request, provider payload,
      idempotency, retry, ambiguous-delivery, conflict recovery, reconciliation,
      or workspace synchronisation.
- [ ] Change to authentication, owner scoping, storage, logging, retention,
      security, hosted variables, or incident monitoring.
- [ ] New territory, audience, legal operator, release status, pricing/access
      model, reseller/white-label arrangement, or intended-use instruction.
- [ ] Change may enable a high-risk/prohibited/unassessed use or a decision about
      a person.
- [ ] Change to the Studio entry animation, first paint, lazy-loading boundary,
      theme/reduced-motion behavior, navigation order/grouping, or upload/drop
      behavior.
- [ ] Change to public legal/compliance claims, EU icons, code-of-practice
      statements, certification language, or provider-responsibility wording.
- [ ] Upstream terms, data use, copyright, retention, subprocessor, security,
      marking/detection, model version, or incident posture changed.
- [ ] Official EU law, guidance, code, Q&A, icon guidance, standard, template,
      authority decision, or application date changed.
- [ ] None of the above. Explain why this checklist is still attached:

## 2. Scope and role assessment — `GOV-001` to `GOV-005`

- [ ] Confirmed the exact legal operator; no identity was invented.
- [ ] Confirmed release status and audience; production releases use public.
- [ ] Confirmed intended purpose remains creative/marketing-only.
- [ ] Tested that the change does not enable emotion/biometric inference, social
      scoring, high-impact decisions about people, medical/legal/law-enforcement/
      migration decisions, or another unassessed use.
- [ ] Reassessed whether REELassati is provider, deployer, importer, distributor,
      product manufacturer, or another role for the changed flow.
- [ ] Reassessed whether training, fine-tuning, weights, self-hosting, model
      modification, or marketing under REELassati's name creates GPAI-model-
      provider status.
- [ ] Recorded any role uncertainty as an open blocker rather than choosing the
      lowest-obligation classification.
- [ ] Reviewed the current [consolidated AI Act](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A02024R1689-20260727)
      and affected official guidance from `OFFICIAL_SOURCES.md`.
- [ ] Updated `CONTROL_MATRIX.md`, `MODEL_PROVIDER_REGISTER.md`, policy version,
      or official-source register where required.
- [ ] If no update was needed, recorded the reason and reviewer.

Decision/evidence reference:

```text

```

## 3. AI literacy and human responsibility — `LIT-001`, `LIT-002`

- [ ] Identified staff, contractors, support, reviewers, operators, and customers
      whose role or risk changed.
- [ ] Updated role-specific guidance/training for the real system, including
      limitations, hallucination/quality risk, synthetic media, rights/privacy,
      human review, intended-use boundary, and incident escalation.
- [ ] Updated concise in-product guidance where the user's task changed.
- [ ] Preserved dated acknowledgement/training evidence without claiming a
      generic certificate proves compliance.
- [ ] Confirmed a human remains accountable for editorial and publication
      decisions; AI-only review is not treated as substantive human review.

Decision/evidence reference:

```text

```

## 4. Interactive transparency — `TRN-001`, `TRN-008`, `UX-001`

- [ ] Identified every first genuine direct interaction with AI in the changed
      flow.
- [ ] A concise AI cue appears before or at first interaction unless a written,
      reviewed “obvious AI” rationale applies.
- [ ] The cue is clear, distinguishable, understandable, accessible, and tested
      in every affected locale, viewport, and theme.
- [ ] The cue is not available only through terms, a manual, settings, metadata,
      a URL, or a hidden help panel.
- [ ] Riskier/repeated interactions were assessed for reminders.
- [ ] No unrelated page received a blanket warning or low-trust scare copy.
- [ ] Progressive disclosure preserves a premium experience while keeping the
      legally relevant fact noticeable.

Screenshots/copy/rationale:

```text

```

## 5. Provenance lifecycle — `PRV-001`, `PRV-002`, `PRV-003`

For every affected AI operation/output:

- [ ] Server records owner, stable record/entity ID, origin, operation, actual
      provider/model, policy version, time, input/output fingerprint, marking
      method/status, and parent/variant relation where applicable.
- [ ] API/workspace projections preserve provenance without becoming the
      authority.
- [ ] Save, reload, duplicate, edit, variant, Library, export, download,
      Publisher, schedule, publish, and reconciliation paths preserve origin.
- [ ] Missing provenance is handled as unknown/risk, not automatically human.
- [ ] Standard-edit classification is narrow and does not cover substantive
      meaning, structure, style, message, or intent changes.
- [ ] Intermediate versus externally usable final output is documented.
- [ ] Migration handles existing records conservatively and never fabricates a
      provider/model/origin.
- [ ] Cross-owner access/tampering tests pass.
- [ ] Marking/provenance failure is explicit and cannot be silently downgraded.

Lifecycle test matrix/evidence:

```text

```

## 6. Machine-readable marking and detection — `TRN-002`, `TRN-003`

- [ ] Assessed Article 50(2) coverage for every affected final text, image,
      audio, and video output.
- [ ] Applied a machine-readable mark as early as technically possible.
- [ ] Verified association survives normal save/export/download/transformation;
      a server row alone is not treated as an exported-file mark.
- [ ] Provided a corresponding detector with a human-understandable result.
- [ ] Detector authenticates the record and distinguishes verified, unmatched,
      malformed, and tampered cases without leaking private owner data.
- [ ] Positive, negative, altered, compressed, transcoded, cropped, reformatted,
      copied, and tampered cases appropriate to the modality were tested.
- [ ] Recorded false-positive/false-negative limitations, transform robustness,
      interoperability, availability, abuse controls, and recovery behavior.
- [ ] Marking and detection failures block covered final output or clearly place
      it in a non-success state.
- [ ] Upstream marking/detection was independently verified for the exact route,
      model, modality, and transformation path before reliance.
- [ ] No copy calls the selected format/vendor mandated, certified, or the only
      compliant solution while standards remain unsettled.
- [ ] If transitional treatment is relied on, confirmed the system was placed
      on the market before 2 August 2026 and limited reliance to Article 50(2)
      until 2 December 2026.

Test corpus/results/limitations:

```text

```

## 7. Deepfake and synthetic-media disclosure — `TRN-004`, `TRN-005`, `TRN-008`

- [ ] Assessed whether image/audio/video resembles an existing or plausibly
      existing person, object, place, entity, or event and could falsely appear
      authentic; deceptive intent was not required.
- [ ] Assessed real person, likeness, and cloned/synthetic voice facts.
- [ ] Required a human-perceivable disclosure at first exposure when triggered;
      metadata/machine marking alone was not accepted.
- [ ] For creative/artistic/satirical/fictional use, preserved disclosure while
      making it compact and non-obstructive.
- [ ] Did not apply the lighter creative presentation automatically to purely
      informational/commercial material or mixed content dominated by an
      informative purpose.
- [ ] Assessed viewers joining a video late and disclosure survival through
      download/reshare/platform transformation.
- [ ] Kept rights, consent, copyright, privacy, publicity/personality rights,
      advertising, and platform legality as separate review items.

Classification, disclosure, and rights evidence:

```text

```

## 8. Public-interest text and editorial exception — `TRN-006`, `TRN-007`

- [ ] Assessed audience: broad/indeterminate public versus private/internal/
      one-to-one.
- [ ] Assessed purpose: informing the public versus another purpose.
- [ ] Assessed subject: politics, public services, justice/rights, safety,
      public health, environment, consumer safety, economic/financial,
      scientific/cultural developments, or another public-debate matter.
- [ ] Reviewed advertising/product claims involving health, safety,
      sustainability, finance, or similar public-interest topics rather than
      automatically excluding all marketing.
- [ ] If in scope, included a visible/perceivable disclosure unless every
      editorial-exception requirement was proven.
- [ ] Any exception records substantive human review/editorial control, the
      identified responsible natural/legal person, reviewed version/hash,
      fact-check/edit evidence, time, and no material AI edits after sign-off.
- [ ] Grammar-only review, AI-only review, or a generic checkbox was rejected as
      insufficient.
- [ ] Later material edits invalidate the exception and trigger a new review.
- [ ] The exception was not used to remove Article 50(2) marking or deepfake
      disclosure.

Classification/review evidence:

```text

```

## 9. Publication review and outbox — `PUB-001` to `PUB-004`

- [ ] Draft saving remains separate from schedule/publish approval.
- [ ] Schedule/publish requires the current policy-version review and validates
      it server-side.
- [ ] Review answers are internally consistent and cross-checked against
      server-owned asset/script/job provenance.
- [ ] Rights/consent values are stored as declarations, not represented as
      verified proof.
- [ ] Required visible disclosure is present in the actual outgoing caption or
      media, not merely in the review UI or metadata.
- [ ] Review snapshot, disclosure-bearing content, selected media, audience,
      account/platform, time, provenance, and policy version bind to the same
      immutable owner-scoped stable intent.
- [ ] Any material mutation invalidates the review rather than reusing the ID.
- [ ] Intent is persisted before the provider call; exact provider request is
      persisted before transmission.
- [ ] Stable provider request ID and duplicate/conflict recovery are preserved.
- [ ] Concurrent, timeout, connection-loss, 408/425, 409, provider 5xx, provider
      accepted/workspace-sync-failed, partial delivery, and reconciliation cases
      were tested.
- [ ] Ambiguous outcomes lock unsafe retries; modified content is never sent
      under the same ID.
- [ ] UI status comes from provider-confirmed/reconciled state and does not
      fabricate “published.”
- [ ] Post-publication sampling verifies disclosure survival where required.

Outbox and publication evidence:

```text

```

## 10. Provider/model and hosted configuration — `SUP-001`, `SUP-002`, `SEC-001`

- [ ] Updated every affected `ROUTE-*` entry in
      `MODEL_PROVIDER_REGISTER.md`.
- [ ] Recorded the actual runtime provider/model/configuration without secret
      values.
- [ ] Kimi subscription mode remains owner-only/test-only and redirects only
      default text requests with no explicit model.
- [ ] Analysis, transcription, speech, and video remain on explicit OpenRouter
      routes while Kimi test mode is enabled.
- [ ] Public/official release evidence confirms Kimi test mode is disabled unless
      a separately approved architecture decision replaces it.
- [ ] No silent fallback, alias/version ambiguity, or unregistered provider
      change was introduced.
- [ ] Provider keys remain server-only and absent from client bundles, workspace
      records, logs, detector responses, errors, screenshots, and documentation.
- [ ] Completed/updated `PE-01` through `PE-10`; unknowns are gaps, not assumed
      compliance.
- [ ] Independently validated inherited marking/detection; provider assertions
      alone were not accepted.
- [ ] Reassessed GPAI-model-provider status.

Register/evidence revision:

```text

```

## 11. Protected product behavior

### Entry animation — `INV-ENTRY-001` to `INV-ENTRY-003`

- [ ] Direct Studio load shows the theme-matched animation frame before any
      spinner/Studio flash.
- [ ] Animation remains outside the lazy Dashboard boundary.
- [ ] Bottom → middle → top assembly remains fast and readable.
- [ ] Wordmark begins continuously with no pause.
- [ ] Background reveals Studio during the latter half while the lockup remains
      visible; no page melt, blank frame, landing layer, or completed-lockup hold.
- [ ] Approved timing constants were unchanged, or an explicit animation review
      and light/dark/reduced-motion evidence is attached.
- [ ] Exact wordmark, baseline, logo assets, and absence of violet artifact were
      preserved.

### Navigation — `INV-NAV-001`

- [ ] Exact order and three separators match
      `ARCHITECTURE_INVARIANTS.md` on desktop/mobile/collapsed modes.
- [ ] Goals remains absent from the sidebar without deleting its route/data.
- [ ] No compliance page was inserted into the approved sequence without
      explicit product approval.

### Upload/drop — `INV-UPLOAD-001` to `INV-UPLOAD-003`

- [ ] Every file picker has a corresponding local drop surface.
- [ ] Picker and drop share validation/upload behavior.
- [ ] Edit, Voice Studio, Analyze, Library, and public Provenance Detector drop
      surfaces still work.
- [ ] Accepted/invalid/mixed/oversize/busy/nested drag cases pass.
- [ ] Client filtering did not replace server MIME/active-content/size/owner
      enforcement.
- [ ] Keyboard, touch, light/dark and accessible feedback pass.

### Functional integrity — `INV-FUNC-001` to `INV-FUNC-004`

- [ ] Every added/changed visible control performs its stated action and has a
      success, disabled/busy, empty and failure state where applicable.
- [ ] Async workspace mutations surface failures and preserve backup, retry and
      revision-conflict recovery.
- [ ] Editor transport/native media synchronization, downloads, clipboard
      fallback, route/hash shortcuts and theme synchronization pass.
- [ ] Native button types, names/labels, focus, keyboard input, media
      alternatives and reduced-motion behavior pass.
- [ ] External provider, publishing, billing, analytics and rendering states do
      not imply configuration or success that the server cannot verify.
- [ ] `src/functional-regressions.test.ts` and the dated QA audit were updated
      for any changed invariant.

Protected-behavior evidence:

```text

```

## 12. Separate related-law review

The AI Act is not the only applicable law. Check and record whether the change
requires specialist review for:

- [ ] GDPR/data protection, including lawful basis, transparency, processors,
      transfers, automated decision-making, biometrics, children, and rights;
- [ ] ePrivacy/cookies/communications;
- [ ] copyright, database rights, trade secrets, licences, moral rights;
- [ ] personality/publicity/likeness/voice and consent;
- [ ] consumer protection, unfair commercial practices, price/claim accuracy;
- [ ] advertising, endorsements, health/environmental/financial claims;
- [ ] Digital Services Act or platform/intermediary duties;
- [ ] media, election, defamation, professional/sector rules;
- [ ] platform terms and destination-specific synthetic-media policies;
- [ ] security, breach notification, contract, employment, tax, or accessibility.

The repository must not claim these issues are solved merely because AI Act
controls pass.

Related-law decision/evidence:

```text

```

## 13. Verification and evidence package — `MON-001`, `EVD-001`

- [ ] Unit/integration tests for affected controls pass.
- [ ] Negative and bypass attempts pass; client/API direct calls cannot skip
      server review.
- [ ] Real runtime route/model facts were verified without exposing secrets.
- [ ] Light/dark/mobile/desktop/keyboard/reduced-motion UX checks pass where
      relevant.
- [ ] Monitoring/alerts/queries were updated and tested.
- [ ] Incident runbook owner and escalation contacts are current.
- [ ] Release evidence manifest includes commit/version, environment/audience,
      policy version, providers/models, tests, screenshots, reviewer/date, open
      limitations, remediation owner and deadline.
- [ ] Open gaps are visible; no blocker was relabelled as “accepted risk” without
      named legal/business authority.
- [ ] Documentation uses only official EU external sources.
- [ ] No claim implies certification, Commission approval, code signatory status,
      100% compliance, or zero legal risk.

Evidence bundle location and open issues:

```text

```

## 14. Approval record

```text
Engineering owner — name/date/decision:
Product/design owner — name/date/decision:
Compliance owner — name/date/decision:
Security/privacy reviewer — name/date/decision:
Qualified legal reviewer when triggered — name/date/decision:
Business/legal operator — name/date/decision:
Open blockers:
Remediation owner and due date:
Release decision: approved / conditional / blocked
```

No individual signing this record should describe it as EU certification. A
conditional decision must identify the exact condition, owner, deadline, and
whether the affected route remains disabled until closure.
