# Release evidence — 4 August 2026 owner-only checkpoint

## Release identity

- **Evidence record ID:** `rel-2026-08-04-sites-v30-owner-only`
- **Product release:** Sites version `30`
- **Deployment audience:** owner-only custom access; no workspace group or
  external visitor access
- **Source commit:** `faa0d7d1a680683182eb4929289d16ca2b9ac0ed`
- **Compliance policy:** `eu-ai-act-2026-08-04.v1`
- **Sites project:** `appgprj_6a5bd4f335cc81918891aeec6f2155da`
- **Saved version:**
  `appgprj_6a5bd4f335cc81918891aeec6f2155da~appgver_daa10500e9888191b95945f3d5e895c1`
- **Deployment:** `appgdep_6a71aaec9564819181536cc3a224c933`
- **Production URL:** <https://reelassati.kevinbiz.chatgpt.site>
- **Terminal deployment status:** `succeeded`
- **Environment revision:** `2`
- **Deployment terminal time:** `2026-08-04T09:05:46.965935Z`
- **Release owner:** current verified Sites owner; exact legal operator identity
  is not established by this technical record
- **Engineering verification:** Codex root gate plus independent integrity,
  product, disclosure, and provenance-lifecycle reviews
- **Compliance/legal reviewer:** not appointed; remains a public-release blocker

This record documents an engineering checkpoint. It is not a certificate,
legal opinion, public-release approval, Code of Practice signature, or claim of
full compliance.

## Scope delivered

- Official-source AI Act register current through 4 August 2026, including
  Regulation (EU) 2026/1744, the consolidated Act current from 27 July 2026,
  final Article 50 guidance and official Q&A, and current Article 4 guidance.
- Versioned compliance contract, stable control IDs, architecture invariants,
  provider register, change-review checklist, incident/monitoring runbook, and
  reusable release-evidence template.
- Contextual Article 50 interaction cues and EN/IT public transparency pages.
- Server-owned signed provenance for AI invocations and supported outputs.
- Invisible signed text marks, embedded MP3 and MP4 marks, exact-artifact
  detector, record-only result separation, key-ID/keyring rotation path, and
  fail-closed generated-asset delivery.
- Owner-scoped, tamper-resistant provenance through scripts, transcripts,
  projects, revisions, assets, Library, edit operations, exports and Publisher.
- Explicit publication classification, rights/consent review, audience-language
  selection, disclosure-first canonical provider payload, exact outbox record,
  review invalidation, idempotency and public-release readiness gate.
- Creative/marketing intended-use signals, source authorization controls, human
  review, error redaction, incident references and runtime route reporting.
- Owner-only Kimi direct-test isolation while explicit Gemini, Whisper,
  MiniMax, Kling and non-Kimi model routes remain on OpenRouter.

## Protected product behaviors verified unchanged

- Approved Studio entry animation timing and light/dark variants.
- Animation visible from first paint; Studio revealed during its second half.
- Exact Studio sidebar order and grouping.
- One drag-and-drop surface for each of five file inputs.
- Owner-only Kimi test routing; explicit non-Kimi OpenRouter routing.
- Compact contextual disclosures rather than global warning banners.
- Existing human-approved editing and generation workflow.

## Engineering gate

| Gate                                            | Result                                     |
| ----------------------------------------------- | ------------------------------------------ |
| TypeScript application, node and Sites projects | Passed                                     |
| ESLint full repository                          | Passed                                     |
| Unit/integration/regression tests               | `53/53` passed across 7 files              |
| Production Vite/server build                    | Passed                                     |
| `git diff --check`                              | Passed                                     |
| Targeted repository/document formatting         | Passed                                     |
| Sequential migration review                     | Passed during independent integrity review |
| Rendered landing/public-policy EN/IT review     | Passed in agent preview                    |
| First-paint entry animation review              | Passed in agent preview                    |
| Final authoritative deployment status           | `succeeded`                                |

The secure authenticated Publisher and full Studio could not be visually opened
in the unauthenticated agent preview. Their contract, source, build, interaction
and regression gates passed; the owner should perform the post-deployment
authenticated smoke checks below.

## Integrity findings corrected before release

- Missing operator-owner configuration previously fell back to the current
  user; it now fails closed.
- A canonical disclosure appearing late in a caption could bypass first-exposure
  placement; the server now canonicalizes it at the prefix.
- Edit-operation provenance was not bound to the exact normalized operation;
  project, operation ID and operation hash are now signed and reconciled.
- Speech storage failures could leave pending/in-progress evidence; failures now
  clean up object and D1 state transactionally.
- Generated assets were authenticated by metadata without revalidating current
  bytes; full GET/HEAD and ETag-bounded range delivery now fail closed on
  corruption or overwrite.
- Provider errors could reach clients and Zernio conflict recovery consumed its
  response twice; client errors are sanitized and conflict metadata is parsed
  once without exposure.
- Media disclosure wording inferred generation/manipulation from real-person
  presence; it now uses accurate neutral EN/IT combined wording.
- Disclosure language followed interface language; each release now requires a
  server-bound EN/IT audience-language decision.
- Transcript provenance could disappear on save/export and structured script
  fields could drift from signed text; both full projections and lifecycle
  exports are now authoritative and marked.
- Rejected saves could create provenance rows and historical manual transcript
  revisions could be relabelled retroactively; validation now precedes mutation,
  provisional rows roll back, and historical revisions are exact-match only.

## Hosted configuration disposition

The environment contains the existing OpenRouter and Kimi secrets plus a new
server-only provenance signing key and exact operator/test-owner bindings. No
secret values are included in this record.

The following evidence statuses are deliberately `pending`:

- independent marking/detection validation;
- upstream provider evidence;
- non-AI-law legal review;
- incident/monitoring operations;
- provenance lifecycle validation.

Kimi subscription test mode remains enabled for the verified owner only. That
state itself blocks public readiness. External publishing is also unavailable
without its separately configured provider credential.

## Open public-release blockers

1. Confirm the exact legal operator name, legal form and public contact.
2. Confirm the first EU placing-on-the-market/put-into-service date and whether
   the product audience and public-release status.
3. Confirm that the intended use remains permanently restricted to creative and
   marketing production; reassess if any high-impact people decision is added.
4. Complete and approve each provider evidence package, including contractual,
   data-handling, model/version and inherited-marking facts.
5. Independently validate marking/detection across every supported final output,
   transform, download/export and third-party lifecycle; record limitations,
   false results and detector availability.
6. Appoint incident/monitoring owners, configure alerts, run an exercise and
   approve retention/escalation decisions.
7. Complete separate Italian/EU review for privacy/data protection, copyright,
   likeness/voice, consumer/advertising, platform/DSA, accessibility, security
   and any applicable sector law.
8. Complete role-specific AI-literacy measures and evidence for every person
   operating or reviewing the systems on the operator's behalf.
9. Disable Kimi test mode and verify the official route snapshot before any
   public release.

Until these are closed, public publishing and any claim that the platform is
fully EU-ready, certified, compliant, or free of legal risk remain prohibited.

## Post-deployment owner smoke checks

- Open Studio in EN and IT; confirm the approved entry animation and sidebar.
- Generate one test script and verify save, edit derivative, copy and detector.
- Transcribe one owned test file; verify save, revision, marked edit-brief export
  and detector, then alter the text and confirm mismatch.
- Generate one test MP3 and one test MP4; verify download and detector, then
  confirm a tampered copy is blocked or mismatched.
- Review Publisher in both EN and IT audience languages; confirm the exact
  outgoing preview begins with the compact cue and changing any fact, account,
  language or schedule invalidates approval.
- Confirm Studio Status remains blocked with the open items above and does not
  display a public-release or certification claim.
- Confirm the sanitized runtime route register shows Kimi only for the verified
  owner's default-text test and OpenRouter for every explicit non-Kimi route.

## Decision

**Approved only as an owner-only private engineering checkpoint. Public release
and external publishing remain fail-closed.**

The rollback target is the previously live Sites version `29`. Any later change
to mapped code, hosted configuration, legal copy, provider/model, export,
publication, provenance or protected product behavior must use
`CHANGE_REVIEW_CHECKLIST.md` and a new release-evidence record.
