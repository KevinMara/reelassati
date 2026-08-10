# REELassati platform functional audit — 7 August 2026

## Purpose and decision standard

This record inventories the current owner-only REELassati checkpoint, documents
the defects found during a platform-wide functional review, and binds each
repair to repeatable evidence. It is deliberately stricter than a visual smoke
test: a screen is not considered functional merely because it renders.

For each user path, the review followed the complete boundary where applicable:

`control → client validation/state → API transport → Worker authorization and
validation → D1/R2/provider boundary → authoritative response → persisted UI`.

The release standard is:

- the visible control performs the action it names;
- picker, keyboard/touch and drag/drop paths converge on the same behavior;
- busy, empty, invalid, provider-unavailable, conflict and network-failure
  states are explicit;
- no success, progress, billing, analytics, publishing or export state is
  fabricated;
- owner scoping, provenance, publication review and other compliance controls
  remain server-enforced;
- protected animation, navigation, provider routing and disclosure UX do not
  regress;
- durable tests and architecture invariants make later removal conspicuous.

Passing this audit is engineering evidence, not a claim of zero defects, legal
certification, provider availability, or successful operation of an external
service that was not invoked during the audit.

## Audit methods and evidence

1. Enumerated all public and Studio routes, every native file input, every
   `useFileDropZone` use, all client API calls, all Worker API dispatch families,
   native buttons, links, media elements, range controls, clipboard paths,
   object-URL downloads, workspace mutations and external capability gates.
2. Reviewed the existing compliance control matrix, architecture invariants,
   provider routing register and previous owner-only release record before
   changing code.
3. Added JSX accessibility linting and ran the repository-wide TypeScript and
   ESLint gates.
4. Exercised request parsing, upload progress, shared file validation, Worker
   routing, authorization, workspace concurrency, provider-error handling,
   provenance, publishing, referral qualification and protected product
   behaviors through unit/integration/regression tests.
5. Built the production client and Worker artifacts using the same repository
   build pipeline used by Sites.
6. Attempted the bounded local full-stack/browser preview workflow. The local
   viewer could not run the Cloudflare Worker compatibility runtime in this
   environment. No third restart was used. Render-dependent authenticated smoke
   checks therefore remain a post-deployment owner check; source, component,
   API, build and regression evidence are recorded here.

## Route and function inventory

### Public shell

| Route                   | Primary functions reviewed                                                                 | Disposition                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `/`                     | Landing navigation, theme/language, in-page sections, local edit-plan specimen, Studio CTA | Links use router-aware hash navigation; theme is synchronized and applied before first paint. |
| `/pricing`              | Honest current public availability and billing state                                       | No fake checkout or plan activation.                                                          |
| `/support`              | Support and product guidance navigation                                                    | Route and links resolve; no false live-support workflow.                                      |
| `/showcase`             | Category filters, modal open/close, Escape, focus trap/return, real-tool links             | Modal semantics, focus and scroll locking repaired and linted.                                |
| `/templates`            | Search, filter, selection and handoff to AI Video                                          | Empty filters no longer retain a stale selection; subject/template query state reaches Video. |
| `/ai-transparency`      | EN/IT disclosures and official-source links                                                | External links are safely opened and the compact compliance hierarchy is preserved.           |
| `/responsible-use`      | Intended-use boundaries and official-law links                                             | Route and external-link behavior verified; no blanket warning inserted.                       |
| `/provenance`           | Text/file inspection, picker/drop, EN/IT errors and detector result states                 | Public file input now has matching drop support and shared validation.                        |
| `/auth/login`           | Authenticated workspace continuation                                                       | No local password illusion; failure is shown when the hosting identity is unavailable.        |
| `/auth/signup`          | Authenticated workspace creation/continuation                                              | No fake account form; button type and failure state verified.                                 |
| `/auth/forgot-password` | Correct no-password explanation and return path                                            | Route is truthful for hosting-identity authentication.                                        |
| `/auth/oauth-success`   | Session verification and safe redirect                                                     | Success/failure destination is explicit.                                                      |
| `/entry`                | Forced animation replay and theme preview                                                  | Preview theme is restored on exit; real Edit link replaces a decorative fake action.          |
| unknown public route    | Recovery                                                                                   | Explicit redirect to `/`; no stale component rendered under an invalid URL.                   |

### Studio shell and tools

| Route                  | Primary functions reviewed                                                                                                                                          | Disposition                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`           | Real workspace stats, onboarding, quick starts, recent activity, capability status                                                                                  | Bell now lands on Recent Activity; dates older than 30 days show an absolute date.                                                                                                                    |
| `/dashboard/trends`    | Evidence sources, hypothesis create/filter/delete                                                                                                                   | Save/delete failures surface; delete is confirmed.                                                                                                                                                    |
| `/dashboard/interview` | Question sequence, answer capture, script generation/copy                                                                                                           | Question focus is announced; controls are labelled; server-backed generation errors recover to the interview.                                                                                         |
| `/dashboard/script`    | Structured prompt, patterns, generation, save and provenance-aware copy                                                                                             | Capability and failure paths remain explicit.                                                                                                                                                         |
| `/dashboard/video`     | Prompt Director, URL/reference facts, rights checks, generation job polling, result copy/play                                                                       | Template handoff persists; controls use real provider/job state and truthful caption status.                                                                                                          |
| `/dashboard/voice`     | Audio picker/drop/upload, stored asset selection, transcription, script conversion, speech synthesis                                                                | Picker/drop parity, real progress, consent gate, labelled audio and transcript alternatives pass.                                                                                                     |
| `/dashboard/edit`      | Project create/select, media picker/drop, timeline, split/duplicate/delete, clip properties, undo/redo, transcript, AI plan review, preflight and edit-brief export | Timeline transport now controls real audio/video, including seek, in-point, speed, mute and volume. Async mutations and downloads fail visibly/reliably. Final renderer remains labelled unavailable. |
| `/dashboard/analyze`   | Video picker/drop or public HTTPS URL, rights gate, analysis, queue into editor                                                                                     | Picker/drop validation is identical; URL and provider failures are bounded; scores remain editorial estimates.                                                                                        |
| `/dashboard/publish`   | Draft, schedule, immediate publish, release review, disclosure language, queue, reconciliation and delete                                                           | Draft delete is confirmed; mutation failures surface; server review/outbox/provenance gates remain fail-closed.                                                                                       |
| `/dashboard/analytics` | Workspace-derived publishing summary                                                                                                                                | Missing external performance telemetry is stated; no fabricated reach/retention.                                                                                                                      |
| `/dashboard/clients`   | Brand DNA edit and bounded range controls                                                                                                                           | Labels/IDs corrected and saves surface errors.                                                                                                                                                        |
| `/dashboard/calendar`  | Month navigation and scheduled-post view                                                                                                                            | Controls route back to the real Publisher flow; no invented provider state.                                                                                                                           |
| `/dashboard/coaching`  | Seven-day workspace evidence review and refresh                                                                                                                     | Refresh now fetches authoritative workspace state, blocks during saves and reports failure.                                                                                                           |
| `/dashboard/library`   | Search/filter/view, upload/drop, open/copy/delete                                                                                                                   | Entire header is a drop target; Find Assets focuses search; copy and delete failures surface.                                                                                                         |
| `/dashboard/social`    | Provider account sync/connect/disconnect                                                                                                                            | Capability-gated; provider configuration and errors are not fabricated.                                                                                                                               |
| `/dashboard/referral`  | Code creation/share/copy/claim, pending/verified history                                                                                                            | False active-billing implication removed. Qualification requires a signed, recent, idempotent server webhook; unverified rewards remain visibly pending.                                             |
| `/dashboard/settings`  | Profile, Brand DNA, theme and capability settings                                                                                                                   | All mounted theme controls stay synchronized; save failures are shown.                                                                                                                                |
| `/dashboard/status`    | Runtime model routes and public-release/compliance blockers                                                                                                         | Server facts remain authoritative; protected secrets are not exposed.                                                                                                                                 |
| `/dashboard/goals`     | Preserved non-sidebar goal create/update/delete route                                                                                                               | Numeric validation, labels, mutation errors and delete confirmation repaired.                                                                                                                         |
| unknown Studio route   | Recovery                                                                                                                                                            | Explicit redirect to `/dashboard`; navigation order and hidden Goals route remain intact.                                                                                                             |

### Worker/API families

| Family                                              | Boundary reviewed                                                                                                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session/capabilities                                | Hosting identity only; local development identity limited to local hostnames; no browser-supplied owner.                                             |
| Workspace                                           | Revision conflict, optimistic save chain, backup/retry/reload and provenance reconciliation. Authoritative reload now clears stale optimistic state. |
| Assets                                              | Size/content/MIME/active-markup validation, owner scoping, D1/R2 rollback, GET/HEAD/range behavior, delete and stale-reference pruning.              |
| AI script/edit-plan/analyze/transcribe/speech/video | Capability gating, intended-use/rights checks, provider routing, sanitized failures, invocation/provenance records and output marking.               |
| Video jobs/webhook                                  | Stable request/job state, signed provider webhook path, storage/finalization and failure cleanup.                                                    |
| Publishing                                          | Account connection, canonical review, disclosure-bearing payload, durable intent, idempotency, ambiguity and status reconciliation.                  |
| Provenance detector                                 | Public bounded input, token/fingerprint/embedded marker, authentic-record versus exact-artifact result and no input retention.                       |
| Compliance                                          | Authorized operator only, evidence blockers and no public-ready claim while facts remain pending.                                                    |
| Referrals                                           | Owner-scoped code/claim, self-referral prevention, masked history and signed billing qualification with replay/idempotency protection.               |

## Defects found and repaired

### Uploads and file handling

- Six native file inputs now have corresponding local drop behavior: five
  Studio inputs across Edit, Voice, Analyze and Library, plus the public
  Provenance Detector.
- Edit exposes three intentional drop surfaces for its two input locations:
  new-project, source preview and timeline.
- Picker and drop paths call the same `validateFileSelection` contract.
- Empty, unsupported, active SVG, wrong-purpose, mixed, oversized, excessive
  batch and single/multiple mismatch states produce specific errors.
- The client and Worker import the same 64 MB general and 24 MB direct-AI media
  constants; server MIME, active-content, owner and storage checks remain
  authoritative.
- Upload progress now comes from `XMLHttpRequest.upload.onprogress`; the former
  simulated 5%→100% indicator was removed.
- Disabled/busy drop zones reject files and clear highlight state.

### State, persistence and failure recovery

- API JSON parsing now rejects Vite/SPA HTML fallbacks and malformed successful
  responses with a controlled error.
- Editor, Goals, Trends and Publisher mutations that could reject without a
  local handler now report failure instead of leaving an unhandled promise.
- Authoritative workspace refresh increments the mutation generation and clears
  stale unsaved/conflict state, preventing an old optimistic callback from
  reasserting discarded state.
- Workspace reload prunes project clips, active asset references and Publisher
  media references whose authoritative asset record no longer exists.
- Downloads attach/remove their temporary anchor and delay object-URL
  revocation until after click dispatch.
- Clipboard actions use one capability-aware implementation with a safe
  selection/`execCommand` fallback and visible errors.

### Navigation, theme and performance

- Router-aware in-page links replace raw hash anchors; lazy targets retry for a
  bounded two seconds.
- Find Assets routes to Library and focuses the real search input. The bell
  routes to a labelled Recent Activity section.
- Unknown public and nested Studio routes redirect explicitly.
- Theme state uses a shared external store, cross-tab storage events and system
  preference changes only when no explicit preference exists. `index.html`
  applies the resolved theme before React paints.
- Heavy Studio tools are route-split behind an accessible in-shell fallback so
  the Dashboard shell and protected entry sequence do not wait for every editor
  and provider screen.

### Editor and media quality

- The timeline Play button now starts/pauses the actual selected media element.
- Native controls and both playhead sliders synchronize bidirectionally.
- Clip in-point, speed, mute and volume apply to preview playback.
- A real range input replaces a non-semantic clickable timeline container.
- Video uses a generated WebVTT track when transcript data exists; audio exposes
  its transcript or an honest missing-transcript status; generated video states
  plainly when captions have not been added.
- Final video rendering remains visibly unavailable rather than generating a
  fake file; the authoritative edit brief export remains functional.

### Accessibility and interaction details

- Repository-wide JSX accessibility lint rules were added.
- Every native/motion button opening tag specifies a type, preventing accidental
  form submission.
- Mobile navigation overlay, collapsed sidebar controls, icon-only buttons,
  language/theme controls and ranges have names/state.
- Showcase modal supports Escape, focus entry/trap/return and scroll locking.
- Interview question focus, form labels and media alternative relationships
  were repaired without adding low-quality warning copy.

### Referral/billing integrity

- Refer & Earn no longer states that unverified purchases can already be
  verified when public billing is inactive.
- Links/codes/claims remain usable and pending.
- Reward qualification is accepted only at a server-only endpoint with a
  configured secret, a five-minute signed timestamp window, exact paid-event
  schema, purchaser match, one pending claim and a unique payment event ID.
- Replays return the existing qualification without awarding credits twice;
  invalid signatures and unmatched purchasers fail closed.

## Durable regression map

- `src/functional-regressions.test.ts` protects file/drop coverage, shared
  limits, button types, client/Worker route families, real progress, theme
  synchronization, navigation/focus shortcuts, route splitting, clipboard and
  download behavior, media alternatives, real editor transport and referral
  billing integrity.
- `src/lib/file-validation.test.ts` covers accepted and rejected picker/drop
  selections in EN/IT.
- `src/lib/platform-api.test.ts` covers malformed/HTML responses, structured
  errors and real upload progress.
- `src/compliance-regressions.test.ts` continues to lock animation timing,
  exact navigation order/groups, Studio drag/drop and publication-language
  behavior.
- Worker tests continue to cover storage, authentication, provider routing,
  provenance, publication integrity, generated media and referral qualification.
- `docs/compliance/ARCHITECTURE_INVARIANTS.md` now includes
  `INV-FUNC-001`–`INV-FUNC-004`; the mandatory change checklist references
  these tests and this dated audit.

## Current gate and remaining runtime checks

At the final pre-deployment gate for this audit:

- TypeScript application, Node and Sites projects: passed;
- ESLint with React hooks and JSX accessibility: passed;
- unit/integration/regression suite: **75/75 passed across 10 files**;
- protected entry timing, navigation, drop zones and provider routing:
  regression-protected and unchanged.

The production build, diff/format gate, source checkpoint and authoritative
owner-only deployment all passed. Exact release evidence is recorded in
`docs/compliance/releases/2026-08-07-owner-only-functional-audit.md`.

The following cannot honestly be declared universally proven by local tests:

1. Upstream OpenRouter/Kimi/Zernio availability at every future request.
2. A real paid-plan referral event, because public billing is intentionally not
   active; the qualification endpoint remains unavailable until its server-only
   secret and billing sender are configured.
3. Authenticated rendered playback on the owner's specific browser/device,
   drag/drop from every operating system/file manager, and provider OAuth in
   the owner's external account.
4. Final video rendering, external analytics import and public billing, which
   remain explicitly unavailable rather than simulated.
5. The separate legal/operator/evidence blockers already recorded in the AI Act
   compliance release record.

Those are post-deployment or external-integration checks, not silently passing
items. Any future change to an audited path must update this record or create a
new dated audit, update its regression evidence, and complete the protected
change-review checklist.
