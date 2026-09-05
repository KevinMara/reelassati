# Connected platform release — 5 September 2026

Engineering evidence for the user-authorized update to the existing public
REELassati deployment. The source revision is the Git commit containing this
record; the hosting version records that exact full revision. Policy remains
`eu-ai-act-2026-08-04.v1`. Engineering reviewer: Codex. Product authorization:
the owner's instruction to apply the platform audit and publish all changes.
No legal review, certification or universal provider readiness is asserted.

## Scope and change review

- Real local MP4 rendering: timeline cuts, speed, gaps, images, mixed audio and
  burned captions; save to Library, download and continue to Publisher.
- AI-derived exports inherit server-recorded parent provenance, receive an
  embedded signed MP4 mark, and pass protected delivery verification. A failed
  mark or save cannot make an unmarked AI export available through the UI.
- Six-hour signed media delivery supports native media elements across the
  frontend/backend origins; authenticated downloads retain owner/brand checks.
- Owner-scoped brand workspaces preserve the existing default workspace and
  share one billing balance. Social account quotas aggregate across brands.
- Top-ups use the member's monthly or annual plan rate, rounded down to cents;
  historical purchases retain their original credit quantity.
- Stripe event leases, live subscription reconciliation, prorated upgrades,
  proportional top-up refunds and dispute adjustments protect the ledger.
  Spent-credit reversals reduce future available credits rather than granting
  them again. Unmatched subscription adjustments remain visible for review.
- Social analytics preserve unavailable metrics as missing, cache snapshots,
  and label lifetime post metrics accurately; no synthetic engagement data.
- Goal-based creation, project handoffs, Library favorites/project filters,
  saved scene direction, cached voice samples, publication readiness, plan
  calculator and restrained contrast/feedback improvements.
- Owner operations, account data export and a confirmed deletion-request flow.
  A deletion request does not claim immediate erasure or cancel billing.
- Daily GitHub maintenance uses verified OIDC identity bound to this exact
  repository ID, owner ID, main branch and workflow. It runs weekly trend
  refreshes, annual credit renewal and bounded provider reconciliation.

Affected controls: `PRV-001`–`PRV-003`, `TRN-002`–`TRN-003`,
`PUB-001`–`PUB-004`, `SEC-001`, `SUP-002`, `MON-001`, `EVD-001`;
invariants `INV-COMP-002`–`INV-COMP-004`, `INV-MODEL-002`–`INV-MODEL-003`,
`INV-PUB-001`–`INV-PUB-004`, `INV-FUNC-001`–`INV-FUNC-004`.
Entry animation, intended creative/marketing use, upload validation and human
publication approval remain protected. No training, weights or model provider
change was introduced. Voice previews use the existing explicit speech route
with fixed, bounded sample text and shared caching; customer charges stay zero.
The renderer is local, not a new model route. Hosted secret values are not
stored in this record. No hosted environment configuration was changed.

## Verification evidence

- Native FFmpeg test decodes a rendered MP4 with cuts, gaps, speed, captions and
  audio. A browser preview ran the actual WebAssembly renderer and produced a
  720×1280, four-second MP4 of 1,036,446 bytes after worker-loading repair.
- Worker integration verifies an AI-source timeline export is marked, saved
  and delivered with its original payload and matching provenance token.
- Existing tamper, signing, cross-owner, generation failure and publication
  safeguards remain in the full suite.
- Real SQLite tests cover brand isolation/quotas, historical balances, partial
  refunds, refund-before-checkout, duplicate/out-of-order adjustments, dispute
  restoration and mid-month upgrade allocation. Schema migrations 0011–0014
  preserve existing workspace and ledger rows.
- Final gates passed: TypeScript for application/Node/Worker, ESLint,
  138 tests across 19 files, and the production client/Worker build. Vite
  reports its existing large initial-bundle advisory; it is not a build error.
- Browser rendering verification used synthetic local material. Live paid
  checkout, provider generation, OAuth and external publication were not
  represented as tested without their actual production configuration.
- Export engine license notices, pinned upstream source/build references and
  font license accompany the distributed renderer. This is engineering
  documentation, not a legal license-compliance opinion.

## Activation gaps and release limits

Production environment inspection found no Stripe secret/webhook/price
configuration and no Zernio API key. Existing redacted AI/signing secrets were
correctly treated as configured, not absent. Billing and external social
actions retain their capability gates until the owner configures the missing
services. Signed media URLs expire; reloading renews them. Local rendering is
bounded to 180 seconds, 40 media clips, 160 MiB input and 24 MB saved output;
mobile/device memory can impose a lower practical limit.

Operator review is still required for deletion requests, unmatched subscription
refunds/disputes, provider funding and any outstanding external/legal evidence.
Provider configuration presence is not a balance check or an end-to-end success
claim. The owner operations screen makes failures and missing setup visible.
No third-party watermark survival or independent interoperability certification
is inferred from exact-byte delivery tests. No public legal-compliance claim is
changed by this release.

Publication uses the existing public audience under the owner's standing
authorization. The hosting deployment record is authoritative for terminal
status, environment revision and URL; GitHub records maintenance execution.
Rollback baseline: `8ee165fd62510daa1e298693cbbc03a2f1753c87` (Sites version 64).

## First production maintenance observation

The authenticated GitHub workflow reached production successfully; its first
trend invocation failed after 55 seconds with `all_search_requests_failed`.
This does not establish a funding failure. The follow-up gives search 90 seconds,
disables optional reasoning for concise evidence extraction, caps each platform
at three results and records per-platform timeouts/statuses without secret data.
The same Kimi route and strict date/organic/virality/source requirements remain.
No current verified snapshot existed for the strict weekly scope at inspection.
The feed now distinguishes active preparation, unavailable picks and a previous
verified edition; an expired edition is never called this week's evidence.
Vercel analytics loads only on Vercel/custom-domain frontends, removing an
irrelevant missing-script request on the Sites backend origin.
