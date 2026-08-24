# Protected architecture and product invariants

These invariants are part of REELassati's compliance memory and product-quality
baseline. They are not all statutory requirements. They are recorded together
because a compliance change must not accidentally regress the approved Studio
experience, and a UX/debugging change must not silently remove a compliance
control.

Any change affecting an invariant must:

1. name the invariant and related stable control IDs in the change record;
2. explain why the invariant remains satisfied or why a replacement is needed;
3. add or update regression evidence;
4. complete `CHANGE_REVIEW_CHECKLIST.md`;
5. obtain the relevant product, engineering, compliance, and legal review;
6. never weaken a server-side safeguard through client-only logic.

## A. Compliance contract and authoritative state

### `INV-COMP-001` — One versioned policy contract

- `contracts/compliance.ts` is the canonical shared type/constant boundary.
- `AI_COMPLIANCE_POLICY_VERSION` must be stored on provenance, invocation,
  compliance-event, publication-review, and release-evidence records.
- A new policy version requires an explicit migration/compatibility decision.
- Unknown or inconsistent policy versions must not be silently coerced into the
  current version on marking, detection, review, or publication paths.
- Stable control IDs in `CONTROL_MATRIX.md` are never renumbered for cosmetic
  convenience.

Protects: `GOV-005`, `EVD-001`.

### `INV-COMP-002` — Server authority, client declaration

- The server derives the authenticated owner from trusted hosting identity
  headers; it never trusts a browser-supplied user ID.
- Provenance, content fingerprints, provider/model route, marking status,
  detection authenticity, compliance-event history, and outbox state are
  server-owned.
- A client review answer can be stored as the authenticated deployer's factual
  declaration, but is not proof of copyright ownership, licence, consent,
  identity, editorial responsibility, or legality.
- The server must validate review-field consistency and cross-check authoritative
  asset/script/job provenance before schedule or publication.
- An edit-plan record may be projected onto an operation only when its signed
  metadata binds the same project ID, operation ID, and normalized immutable
  recommendation hash. A copied authentic aggregate record must never seal an
  arbitrary, mutated, or cross-project edit operation.
- The edit-plan record's content fingerprint covers the normalized summary and
  immutable operation projection actually returned to the client, never the
  provider's unnormalized JSON response.

Protects: `PRV-001`, `PUB-001`, `SEC-001`.

### `INV-COMP-003` — Origin survives every lifecycle transition

AI origin and its stable provenance ID must not disappear when content is:

- returned by generation;
- saved as a script, job, asset, or edit proposal;
- copied into a project or Library item;
- edited into a variant;
- selected in Publisher;
- exported/downloaded;
- scheduled, submitted, reconciled, or reported as published.

Substantive derivatives must reference the parent/variant relationship and
record their own origin/operation where appropriate. A missing provenance field
does not prove that content is human-authored. A narrow standard edit may be
classified separately only when it does not materially change meaning, style,
intent, or message.

Protects: `PRV-001`, `PRV-002`, `TRN-002`, `PUB-001`.

### `INV-COMP-004` — Marking and detection are inseparable

- Covered final outputs must have both a machine-readable mark and a
  corresponding human-understandable detection result.
- A provenance database record by itself is not sufficient if an exported file
  or final text cannot be associated with it after leaving the workspace.
- Final generated text carries a signed invisible token; generated MP4 output
  carries a top-level UUID box; generated MP3 output carries an ID3v2 private
  frame. Each token resolves through the public detector and is checked against
  the unmarked-content fingerprint. HTTP headers and sidecars are supporting
  evidence, never the only mark.
- A visual “AI-generated” badge by itself is not Article 50(2) marking.
- Marking state cannot move from `failed` or `pending` to `not-required` merely
  to unblock a flow.
- Generation, export, or publication must fail clearly when its required
  marking cannot be created and verified.
- A generated object's R2 metadata is supporting evidence, not proof of current
  bytes. Full `GET` and `HEAD` delivery must read back and verify the embedded
  token and unmarked-content hash. Range delivery may cache that exact
  verification only against the current object ETag, with a short bounded
  lifetime; an overwrite must force complete revalidation.
- If marked speech storage, readback, asset persistence, or invocation
  finalization fails, the object is deleted or made unreachable and provenance,
  invocation, and asset state fail together through a sanitized compensating
  transaction. A provider/storage exception is never stored as event detail.
- The detector must authenticate its record and distinguish unmatched,
  malformed, tampered, and verified results without exposing private owner data.
- A copied token embedded in different text or media must not authenticate that
  different content. Format/transcode survival remains a tested operational
  property, not an assumed guarantee.

Protects: `TRN-002`, `TRN-003`, `PRV-003`.

### `INV-COMP-005` — No blanket warning UX

- Do not add a permanent site-wide warning, modal on every page, or large
  statement that AI output is inherently untrustworthy.
- Interactive AI gets a concise first-interaction cue.
- Provenance detail is progressively disclosed where the user acts on or
  inspects AI output.
- Realistic synthetic media and qualifying public-interest text receive a clear
  first-exposure disclosure when required.
- Creative disclosure can be compact and non-obstructive, but cannot be hidden
  solely in terms, metadata, documentation, settings, or a help page.
- Legal clarity and accessibility remain mandatory; “premium” cannot mean
  invisible.

Protects: `TRN-001`, `TRN-004`–`TRN-008`, `UX-001`.

## B. Studio entry animation

The entry animation is a protected product behavior, not a place for compliance
copy. Compliance UI added elsewhere must not alter its timing, typography,
theme behavior, or first-paint guarantees without explicit product approval.

### `INV-ENTRY-001` — Animation is the first Studio paint

- Direct navigation to a `#/dashboard` route must show the theme-matched boot
  cover from `index.html` before React/lazy Studio code loads; the spinner or
  Studio page must not flash first.
- `EntryAnimation` remains mounted in the immediate `StudioRoute` layer, outside
  the lazy `Dashboard` suspense boundary in `src/App.tsx`.
- `EntryAnimation` removes the static boot cover in a layout effect only after
  its own overlay is ready.
- The real Studio may load underneath, but it must not replace the animation as
  the initial visible frame.

### `INV-ENTRY-002` — Continuous second-half reveal

- Logo slices assemble bottom → middle → top in a fast, readable sequence.
- The wordmark starts as the logo finishes/moves; there is no dead pause between
  the complete mark and `REELassati` appearing.
- The background starts becoming transparent during the latter half while the
  wordmark/lockup is still visible, progressively revealing the real Studio.
- The transition ends directly on Studio: no landing-page layer, page-melting
  effect, blank frame, completed-lockup hold, or delayed second transition.
- Current approved boundaries in `EntryAnimation.tsx` are:
  `BACKDROP_FADE_START_MS = 620`, `BACKDROP_FADE_DURATION_MS = 620`,
  `LOCKUP_FADE_START_MS = 940`, and `LOCKUP_FADE_DURATION_MS = 360`.
  These values may change only through an explicit animation request and a
  light/dark/reduced-motion replay review.

### `INV-ENTRY-003` — Brand and accessibility

- Preserve the exact light/dark mark assets, `REEL` plus italic `assati`
  typography, baseline alignment, and absence of the prior violet artifact
  beneath the top line.
- Reduced-motion users receive a short, non-blank, accessible transition.
- The overlay exposes a concise live status for assistive technology and never
  traps scrolling after completion or fail-safe exit.
- Compliance labels must not be inserted into the animated lockup.

Evidence: direct Studio load; landing-to-Studio navigation; light/dark mode;
new session/repeat session; slow lazy-load simulation; reduced motion; console
errors; video or frame captures around first paint and both fade boundaries.

## C. Studio navigation order

### `INV-NAV-001` — Exact order and grouping

Desktop and mobile navigation must share this order and these group breaks:

1. Dashboard
2. Trends
3. Interview Me
4. Script
5. AI Video
6. Voice Studio
7. Edit
8. Analyze
9. Publish
10. Analytics
11. — separator —
12. Clients
13. Calendar
14. Weekly Coach
15. — separator —
16. Library
17. Social
18. Refer & Earn
19. — separator —
20. Settings
21. Studio Status

- `Goals` is intentionally absent from the sidebar; its route/data must not be
  deleted merely because it is not in navigation.
- Translation changes may localise labels but cannot reorder destinations.
- A new compliance page should normally be reached contextually or from legal
  information, not inserted into this sequence without explicit product
  approval.
- Collapsed, expanded, and mobile modes must route to the same destinations and
  indicate the current page accessibly.

Evidence: `navItems` order in `src/pages/Dashboard.tsx`; route map; desktop,
collapsed, keyboard, and mobile navigation checks.

## D. Upload and drag-and-drop parity

### `INV-UPLOAD-001` — Every upload surface also accepts a drop

Any section that offers a file picker must accept files dropped directly into
the corresponding visible section. Do not add one unrelated global drop target
as a substitute.

Current surfaces to preserve:

- Edit: new-edit upload panel, source-preview section, and timeline section;
- Voice Studio: audio upload section;
- Analyze: video upload section;
- Library: video/audio/image upload section.
- Public Provenance Detector: supported media/document inspection section.

Any new file input creates a checklist trigger: define its local drop surface,
accepted types, disabled/busy state, feedback, error path, accessibility, and
tests before release.

### `INV-UPLOAD-002` — Picker and drop use one validation path

- Picker and drop must call the same downstream upload/validation logic.
- Client filtering is user feedback, not a security boundary. Server limits,
  allowed media prefixes, active-content rejection, size limits, owner scoping,
  safe filename handling, and storage checks remain authoritative.
- The current upload boundary accepts image/audio/video media, rejects active
  SVG markup, caps general uploads at 64 MB, and caps direct AI media use at
  24 MB. Changing these requires storage, security, runtime-memory, UX, and
  compliance review.
- Invalid files produce a local, specific error; they are not silently ignored
  or uploaded under a misleading type.

### `INV-UPLOAD-003` — Interaction quality

- Nested drag enter/leave events must not flicker the highlighted state;
  `useFileDropZone` maintains drag depth.
- `preventDefault`/`stopPropagation` are limited to the local drop interaction.
- Busy/disabled targets reject drops and communicate that state.
- Drag-over feedback is high quality in light/dark mode and does not replace
  the click/touch path.
- Hidden inputs remain labelled by their visible trigger; keyboard and touch
  users can perform the same upload.

Evidence: picker/drop parity tests with accepted, mixed, invalid, oversize, busy,
nested-element, keyboard, touch, and server-rejection cases.

## E. AI model and provider routing

### `INV-MODEL-001` — Kimi subscription mode is isolated and test-only

- `KIMI_TEST_MODE=enabled` may redirect only default text operations where no
  explicit model is selected.
- It uses the server-only Kimi credential and `KIMI_CODE_MODEL` default.
- It must not become the official/public route through an unrelated deployment,
  environment copy, refactor, or fallback.
- Disabling test mode restores the default text route through OpenRouter.
- A public release record must state whether test mode is disabled; absence of
  that evidence is a release blocker.

### `INV-MODEL-002` — Explicit non-Kimi routes stay on OpenRouter

Analysis, trend research, transcription, speech, and video generation remain explicit
OpenRouter routes even when Kimi test mode is enabled:

- analysis: `OPENROUTER_ANALYSIS_MODEL`;
- trend research: `OPENROUTER_TREND_MODEL`, defaulting to Kimi with grounded web search;
- transcription: `OPENROUTER_STT_MODEL`;
- speech: `OPENROUTER_TTS_MODEL` plus configured voice;
- video generation: `OPENROUTER_VIDEO_MODEL`.

Never implement a global “Kimi if enabled” wrapper around these operations.
Routing tests must inspect provider URL and selected model without printing
credentials.

### `INV-MODEL-003` — Route facts are server-recorded

- Provider keys remain server-only; no browser bundle, workspace record, log,
  detector response, or error message may expose them.
- Each AI invocation records its actual provider, model, operation/purpose,
  policy version, owner, timestamps, status, and input/output fingerprints.
- Provenance uses the actual route chosen at request time, not a UI label or
  configured default guessed later.
- Environment overrides are treated as material configuration changes and are
  copied into the release evidence manifest without secret values.
- Provider failure must not silently fall back to an unregistered model or
  remove marking/provenance.

Protects: `GOV-001`, `PRV-001`, `SUP-001`, `EVD-001`.

## F. Publishing review and durable outbox

### `INV-PUB-001` — Review is server-enforced before provider submission

- Draft saving may remain available without a completed publication review.
- Scheduling or immediate publishing requires a review conforming to the
  current policy contract.
- The server validates intended use, rights declaration/basis, synthetic-media
  facts, real-person/voice facts, creative context, public-interest-text facts,
  substantive review, later AI edits, editorial responsibility, and disclosure.
- Internal contradictions are rejected. Examples: asserting no disclosure is
  required while declaring realistic synthetic media; claiming the editorial
  exception without an editorially responsible person; or claiming substantive
  review while admitting material AI edits after sign-off.
- The selected asset's server-owned provenance informs the review. The client
  cannot convert an AI-generated asset to “human” through a request field.
- The deployer must explicitly choose English or Italian as the
  audience-facing disclosure language for each release. Studio/profile locale
  is never a proxy for the audience language; the server derives the canonical
  disclosure copy from the release facts and that explicit choice.
- A realistic synthetic-media disclosure uses neutral combined wording
  covering AI generation or AI manipulation. It must not infer which operation
  occurred from whether an identifiable real person or voice is depicted.
- Rights and consent declarations are preserved as declarations, not treated as
  legal proof.

Protects: `PUB-001`, `TRN-004`–`TRN-007`.

### `INV-PUB-002` — Review and content are one immutable intent

The compliance review is bound to the same owner-scoped, stable publication ID
and canonical request as the outgoing content. After review, a change to any of
the following requires a new review/intent rather than mutating the approved
request:

- caption or material hashtag/claim;
- selected media or media bytes/provenance;
- destination account/platform/audience;
- immediate versus scheduled mode or scheduled time where context changes;
- required disclosure text, method, or audience language;
- public-interest, realistic-synthetic, real-person/voice, creative-context,
  human-review, later-edit, rights, consent, or editorial-responsibility facts;
- compliance policy version.

Protects: `PUB-002`, `PUB-004`, `EVD-001`.

### `INV-PUB-003` — Outbox idempotency and ambiguity safety

The publishing flow must preserve all of these properties:

1. A stable publication ID is required and bound to one owner and one canonical
   request.
2. The durable intent exists before the external submission.
3. The exact provider payload is stored before the network call.
4. A deterministic provider request ID is derived from the intent.
5. Concurrent submissions cannot both acquire the submission lease.
6. A provider duplicate/conflict can be resolved back to the original post.
7. A timeout, connection loss, 408/425, or provider 5xx after the call begins is
   treated as an ambiguous outcome, not an ordinary retry.
8. Ambiguous intents are locked outside the bounded safe recovery window;
   modified content is never resubmitted under the same ID.
9. Provider response/state is persisted and reconciled; the UI does not invent
   “published.”
10. If the provider accepted the post but workspace synchronisation fails, the
    accepted outbox record remains recoverable.

Compliance review must remain part of this outbox contract, never only a
client-side modal that can be bypassed by calling the API. Source-level binding
still requires end-to-end release evidence before it can be treated as
operationally verified.

Protects: `PUB-002`, `PUB-003`, `PUB-004`.

### `INV-PUB-004` — Actual outgoing disclosure

- When a human-visible disclosure is required, the exact outgoing caption or
  media must contain it at first exposure.
- A checked review box, provenance record, invisible text token, metadata field,
  internal preview, or Library badge does not substitute for the public label.
- After provider acceptance, periodic sampling verifies the destination still
  presents the disclosure; platform transformations and truncation are tracked
  as operational risks.
- Joining a video after its first frame and resharing/downloading are considered
  when deciding whether a one-time label is sufficient.

Protects: `TRN-004`, `TRN-006`, `TRN-008`, `PUB-004`.

## G. Non-goals and forbidden shortcuts

Do not “solve” compliance by:

- globally disabling useful AI features without analysing the affected duty;
- placing all disclosures in Terms of Service;
- labelling every normal page with a large warning;
- converting server validation to a client checkbox;
- marking content only in D1 while downloaded bytes/text lose the association;
- presenting a detector that accepts any syntactically valid token as authentic;
- calling C2PA, an EU icon, a vendor watermark, or this scheme “EU certified”;
- treating provider/model names configured today as permanent;
- treating Kimi test mode as a global provider replacement;
- bypassing the outbox to simplify publishing;
- removing drag-and-drop, changing navigation order, or altering the entry
  animation as collateral damage from compliance work;
- claiming that passing tests, a successful deployment, code comments, or this
  documentation proves legal compliance.

## H. General functional integrity

### `INV-FUNC-001` — A visible control performs its stated action

- Buttons, links, filters, transport controls, refresh actions, copy/share
  actions, downloads, destructive actions, and route shortcuts must not be
  decorative or silently no-op.
- The editor transport controls the actual selected audio/video element. Play,
  pause, native media controls, playhead sliders, clip in-point, speed, mute and
  volume must stay synchronized.
- A control that depends on an unavailable provider or renderer is disabled or
  labelled as unavailable. It must not fabricate success, progress, analytics,
  billing, publishing, generation, or export completion.
- Destructive actions require clear scope and confirmation where an accidental
  click would permanently remove user work.

### `INV-FUNC-002` — Failures remain visible and recoverable

- Asynchronous workspace mutations must catch and present failures. An
  unhandled rejected promise must not leave the interface looking saved.
- Optimistic workspace state remains marked unsaved until the authoritative
  revision is accepted. Conflict reload, backup and retry paths remain
  available.
- Reloading the authoritative workspace clears stale optimistic/conflict state
  and invalidates older local mutation callbacks.
- API clients reject HTML/SPA fallbacks, malformed success bodies and network
  failures with a bounded, user-facing error rather than parsing them as data.
- Downloads attach the temporary anchor before activation and revoke object
  URLs after the browser has consumed the click.

### `INV-FUNC-003` — Navigation, theme and accessibility are state-consistent

- Unknown public and Studio routes use explicit safe redirects; lazy hash
  targets are retried for a bounded period and header shortcuts land on/focus
  the control they name.
- Theme state is shared between all mounted controls, synchronized across tabs,
  follows system changes only when no explicit preference exists, and is
  applied before first paint.
- Native buttons specify their type. Icon-only controls have accessible names;
  overlays, dialogs and timeline controls retain keyboard/focus behavior.
- Audio/video previews expose names and a caption, transcript or truthful
  missing-alternative status. Accessibility text must describe real available
  content, not invent captions.

### `INV-FUNC-004` — External rewards and provider states fail honestly

- Referral claims may be stored before billing verification, but credits become
  verified only after a current, signed, time-bounded and idempotent billing
  event for the referred account.
- When billing verification is not configured, the interface says rewards are
  pending and never presents them as earned or available.
- Provider capability flags and runtime route facts come from the Worker. A
  missing external credential disables the affected action without weakening
  unrelated local/manual work.

Evidence: `src/functional-regressions.test.ts`, endpoint and integrity tests,
`docs/qa/FUNCTIONAL_AUDIT_2026-08-07.md`, production build output, and the
release-specific evidence record.
