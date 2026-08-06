# Release evidence — 7 August 2026 owner-only functional audit

## Release identity

- **Evidence record ID:** `rel-2026-08-07-sites-v31-functional-audit`
- **Product release:** Sites version `31`
- **Deployment audience:** owner-only custom access; no workspace group or
  external visitor access
- **Source commit:** `93878dd1a8fe12285b49c264518ba9de0716aadb`
- **Compliance policy:** `eu-ai-act-2026-08-04.v1`
- **Sites project:** `appgprj_6a5bd4f335cc81918891aeec6f2155da`
- **Saved version:**
  `appgprj_6a5bd4f335cc81918891aeec6f2155da~appgver_788d3346c8dc8191bf6ab6014ecbef89`
- **Deployment:** `appgdep_6a7507d13e88819198575b8bb0dcd59f`
- **Production URL:** <https://reelassati.kevinbiz.chatgpt.site>
- **Terminal deployment status:** `succeeded`
- **Environment revision:** `2`
- **Deployment terminal time:** `2026-08-06T22:17:21.518993Z`
- **Release owner:** current verified Sites owner; exact legal operator identity
  remains a public-release blocker
- **Functional review:** repository-wide route, control, upload, API, state,
  persistence, accessibility, failure-state and integrity audit

This record documents an engineering checkpoint. It is not a claim that every
external provider will remain available, a legal opinion, certification,
public-release approval, or proof of behavior on every browser and device.

## Audit scope delivered

- Enumerated every public and Studio route, native file input, drop zone,
  button, link, range, media element, clipboard path, object-URL download,
  client API call, Worker route family and workspace mutation.
- Traced representative critical paths through client state and validation,
  transport, Worker authorization/validation, D1/R2/provider boundaries,
  authoritative responses and persisted UI.
- Added shared picker/drop validation, real upload progress, explicit malformed
  response handling and bounded failure states.
- Repaired state refresh/concurrency, dangling asset references, async mutation
  failures, download cleanup and clipboard fallback behavior.
- Repaired navigation recovery, hash targeting, theme synchronization,
  pre-React theme paint and Studio route splitting.
- Converted the Editor transport from decorative controls into synchronized
  playback, seeking, in-point, speed, mute and volume behavior.
- Added truthful transcript/caption states and preserved the honest boundary
  that final renderer output is not available.
- Added modal focus/Escape/scroll behavior, explicit button types, semantic
  ranges, accessible control names and repository-wide JSX accessibility lint.
- Repaired referral claims so private-beta billing is not represented as live;
  qualification now requires a signed, recent, idempotent server webhook and
  remains unavailable without real billing configuration.

The detailed route/function inventory and defect dispositions are in
`docs/qa/FUNCTIONAL_AUDIT_2026-08-07.md`.

## Upload and drop coverage

All six native file inputs have matching local drop behavior:

1. Editor new-project media input.
2. Editor selected-project media input, exposed through preview and timeline
   drop surfaces.
3. Voice Studio audio input.
4. Analyze video input.
5. Content Library media input.
6. Public Provenance Detector file input.

Picker and drop paths converge on the same validation contract. It rejects
empty selections, wrong media purpose, unsupported types, SVG/active content,
oversized files, mixed-invalid batches, too many files and single/multiple
mismatches. The client and Worker share the same 64 MB general and 24 MB
direct-AI limits; server authorization, MIME/content, owner and storage checks
remain authoritative.

## Protected behaviors verified unchanged

- Approved first-paint Studio entry animation, timing and light/dark variants.
- Animation background reveals Studio during the second half with no page melt,
  loading flash or post-word pause.
- Exact Studio sidebar order and grouping, including the preserved hidden Goals
  route.
- Owner-only Kimi test routing for default text and explicit OpenRouter routing
  for Gemini, Whisper, MiniMax, Kling and other configured non-Kimi models.
- Compact contextual compliance disclosure instead of global warning walls.
- Server-enforced provenance, publication review, intended-use and public-
  release fail-closed controls from the 4 August compliance checkpoint.
- Existing human-approved generation and editing workflow.

## Engineering gate

| Gate                                            | Result                          |
| ----------------------------------------------- | ------------------------------- |
| TypeScript application, Node and Sites projects | Passed                          |
| ESLint, React Hooks and JSX accessibility       | Passed                          |
| Unit/integration/regression tests               | `75/75` passed across 10 files  |
| Production client and Worker build              | Passed                          |
| Build output secret-pattern scan                | Passed; no configured key found |
| `git diff --check`                              | Passed                          |
| Targeted formatting                             | Passed                          |
| Final authoritative deployment status           | `succeeded`                     |

The bounded local full-stack visual preview could not start its Cloudflare
compatibility runtime in the available environment. It was not retried beyond
the prescribed recovery limit. Component, contract, integration, build and
deployment gates passed; authenticated rendered/device checks remain owner
smoke checks rather than being falsely reported as completed.

## Durable regression and change-control evidence

- `src/functional-regressions.test.ts` protects upload/drop coverage, shared
  limits, button types, API families, upload progress, theme synchronization,
  navigation, route splitting, clipboard/download behavior, media alternatives,
  Editor transport and referral integrity.
- `src/lib/file-validation.test.ts` protects EN/IT picker/drop validation.
- `src/lib/platform-api.test.ts` protects structured errors, malformed/HTML
  response rejection and real upload progress.
- `src/compliance-regressions.test.ts` continues to protect animation timing,
  navigation groups, Studio drop behavior and publication language.
- Worker tests protect authentication, storage, routing, provenance,
  publication, generated media and referral qualification boundaries.
- `docs/compliance/ARCHITECTURE_INVARIANTS.md` includes stable
  `INV-FUNC-001`–`INV-FUNC-004` controls.
- `docs/compliance/CHANGE_REVIEW_CHECKLIST.md` makes this audit, its tests and
  all protected product behaviors mandatory inputs to later changes.

## Honest remaining external/runtime checks

1. Upstream OpenRouter, Kimi, Zernio and social-provider availability at every
   future request cannot be guaranteed by repository tests.
2. A real paid-plan referral event was not simulated. The server webhook remains
   unavailable until a genuine billing sender and server-only secret exist.
3. Provider OAuth, authenticated playback and drag/drop from every operating
   system/file manager require owner/device smoke checks.
4. Final video rendering, external performance analytics import and public
   billing remain explicitly unavailable instead of being represented by fake
   success states.
5. The legal/operator/evidence blockers in the 4 August 2026 AI Act release
   record remain unchanged and continue to block public release.

## Post-deployment owner smoke checks

- Open Studio in EN and IT and confirm there is no loading flash before the
  approved entry animation.
- Drop a valid and invalid sample into every upload surface; repeat each through
  the picker and compare the result.
- In Edit, play/pause, seek, change in-point/speed/volume/mute, and export the
  edit brief with one owned audio and one owned video asset.
- Exercise save/delete failure recovery with a temporary project, draft, goal,
  trend and Library asset.
- Check Showcase modal keyboard behavior, mobile navigation, collapsed sidebar,
  theme synchronization in two tabs and system-theme fallback.
- Verify Refer & Earn creates/copies/claims a code but labels rewards pending and
  does not claim that private-beta billing is active.
- Repeat the provider and provenance smoke checks from the version 30 release
  record using owned test material only.

## Decision

**Approved only as an owner-only private engineering checkpoint. Public release,
external publishing and any claim of universal defect-free operation remain
fail-closed.**

The rollback target is the previously live Sites version `30`. Any later change
to an audited route, control, upload, API, state flow, theme, navigation,
animation, provider route, compliance control or external integration must use
`CHANGE_REVIEW_CHECKLIST.md`, rerun the mapped regressions and create a new
dated audit or release-evidence record.
