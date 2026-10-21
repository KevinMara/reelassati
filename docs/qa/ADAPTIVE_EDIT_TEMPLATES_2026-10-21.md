# Adaptive editing templates and review failure containment — 21 October 2026

## Request and spending boundary

Fix the reported auto-edit review error and let creators save a reusable editing
language from an edited project or a reference video/direct video file link.
Preserve Kimi K3. Kevin prohibits unattended model work and additional paid tests.
All tests in this change use mocks, local data, or deterministic build tools.
Saving, selecting and deleting a template do not invoke a provider. Reference
inspection still requires the user's separate measured analysis quote; saving its
already-returned style profile does not buy another analysis.

## Incident evidence

Read-only Sites database UI inspection found the exact reference
`2935306f-e30a-404e-85e6-38918e6cf2a5` in `compliance_events`:

- Event `incident.unhandled-request`, created `2026-10-21T15:59:47.619Z`.
- Details: POST `/api/ai/analyze`, error type `SyntaxError`.
- Time-correlated invocation `9ccb40a9-6395-427c-99ee-567a5c6a06e9`:
  OpenRouter, `moonshotai/kimi-k3`, video-analysis, created
  `15:57:48.336Z`, failed `15:59:46.860Z`, `provider_or_parse_failure`, no output.
- This establishes a parsing failure, but does not distinguish malformed provider
  envelope JSON from malformed model report JSON. No paid reproduction was run.

Release `c41fbedaa982189517ebb48a3e078c8888856648` was separately deployed as
Sites **116**, deployment `appgdep_6ad8e9c7fd088191901287dc517474b1`, saved version
`appgprj_6a5bd4f335cc81918891aeec6f2155da~appgver_e5f22c1a14248191baf4ca202030515c`,
environment revision **16**, succeeded at **16:36:15 UTC**. Its one specifically
authorized deployment turn finished and the hosting chat returned idle.
The root chat refreshed authenticated owner billing afterward and observed **801**
available credits, restoring the previously verified **791** by exactly ten.
Screenshot is retained locally in ignored verification assets. This does not
refund the historical upstream provider charge. No new paid request was made.

## Failure handling

The prior foreground streaming, five-minute deadline, explicit cancellation and
idempotent credit recovery remain intact. Malformed JSON and non-object model
reports now fail with a safe incomplete-review response (502), an invocation
reference and `provider_invalid_json`, rather than escaping as a generic 500.
The enclosing paid action releases its SQL reservation. No content repair,
automatic model retry, provider fallback or reasoning/body logging is added.
Auto-edit and reference entry points require the foreground analysis contract
before they can submit paid work. Original footage and timeline stay unchanged
on review failure, and completed in-session preparation remains reusable.

## Template contract

`contracts/edit-style-template.ts` owns a bounded, versioned, allowlisted profile:

- Pacing, framing, color impression, motion, transitions, caption language,
  graphic function and sound direction, with explicit unknown values.
- Measured primary-shot quartile ranges and graphic density are guidance, never
  a fixed sequence, quota or cut clock. B-roll and transition handles do not
  inflate the primary-shot rhythm.
- An edited project can retain its actual caption appearance, grade and graphic
  families, palette, animation types and typical size. It drops all source words,
  claims, counter values, assets, media links, times, crops, subject coordinates
  and motion paths. A reference profile cannot assert exact editor settings.
- A maximum of 50 templates per existing account/brand workspace; normalizers
  discard malformed rows, unknown fields, invalid settings and duplicate IDs.
- Selecting a template stores a normalized snapshot on the target project. Later
  deletion from the library does not erase that project's chosen direction.

Both normal edit planning and the editor assistant receive this profile with
explicit target-adaptation rules. Every cut, caption, graphic and sound placement
must be justified by the new footage's observed story, words and positions. The
planner must preserve speech/holds/locked clips, respect the current media budget,
omit irrelevant style elements and report unsupported effects. It must not copy
reference dialogue, facts, assets, music, crops or event sequences. Native caption
treatment uses new target words and avoids duplicating burned-in source captions.
Undo snapshots include the resulting caption settings.

## Workflow and rollout

The editor's saved styles section includes the template library, profile review,
selection, save and management controls. Successful auto-edit also offers saving
that edit as a template. Reference review offers saving its style after an
explicitly quoted analysis, using the selected reference aspects only. It extracts
style in that same response, rather than making an additional paid call.
Missing requested style output releases the analysis reservation instead of
charging for a missing template profile.

The backend advertises `editStyleTemplates`. Until it is deployed, new template
controls stay hidden and edit-reference analysis requiring the new schema remains
disabled. This prevents an older backend silently discarding templates during a
staggered frontend/backend release. Labels, explanations and trait descriptions
are translated in all 28 interface languages, including the lazy locale loader.

## Validation

- Unit tests cover content isolation, primary footage, ordered shot ranges,
  allowlisting, invalid profiles, deduplication, limits and adaptation rules.
- Authenticated Worker/SQLite integration tests cover malformed SSE, malformed
  report JSON, array JSON, safe references, one mocked provider call, reservation
  release, unchanged workspace, reference grammar extraction and missing-style
  refunds. Signed workspace PUT/storage/GET retain template snapshots.
- Existing API, preparation recovery and locale-loader suites remain included.
- Local browser QA used the real editor components with a mock workspace and
  externally disabled API adapter: selected a template, saved a new one, observed
  `Template saved` and library count 2/50, and inspected the profile. No production
  edit, reference inspection or generation was submitted.
- Types, changed-source lint, strict localization and production build are run
  before publication; CI validates the exact pushed source.

Live paid editing/analyzer report quality remains untested under Kevin's explicit
no-paid-tests instruction. Provider availability and valid output cannot be
guaranteed; their failures must remain bounded, visible and financially recoverable.
Permanent scheduled research shutdown and other manual-only protections remain
unchanged. No schedules, model workers, queued follow-ups or new resources are added.
