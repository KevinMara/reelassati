# Observed reference direction

The editor and script reference panels first import an owned video or a CORS-readable final media file, measure its duration, and save the private original. Analysis is a separate action with the measured credit quote and explicit source submission rights confirmation. A web page or inaccessible social post is not a video import. Reference selection, importing, and duration measurement create no AI analysis request.

`buildReferenceEvidence` retains the selected asset ID, its measured duration, and the source clock. It accepts up to twenty distinct observed intervals from at most one hundred provider rows. It discards reversed, empty, nonfinite, negative, string-valued, out-of-duration and foreign-source intervals without clamping them. Provider edit suggestions are not copied into observations. Caption and audio visibility may be present, absent, or unknown; exact technical parameters remain unknown. Deselected caption and audio aspects are not carried into the brief.

The generated brief is labeled untrusted observations. The actual editor-chat provider system message separately instructs the model:

> Reference timestamps describe the reference source, never the project timeline. Map stylistic patterns to measured source/word timings in target footage. Unobserved technical parameters or unsupported effects must remain unknown/unsupported, never silently simulated.

Reference source seconds must not be applied directly as target project seconds. Measured target clip in-points, starts, speed, and word timings remain the basis for editing. The reference feature establishes editable style direction; it does not claim automatic reconstruction of unknown fonts, colors, camera settings, sound identities, or unsupported effects. It does not recover missing reference URLs or an unavailable writing guide.

The panel pins owner ID, normalized email, selected brand, project and source before each asynchronous task. The request carries the captured authenticated scope; source changes and cancellation invalidate the task, and unmount aborts it. After import or analysis, it verifies the request scope and the still-current selected project/source before saving or emitting a brief. The caller must also guard its workspace write against an account or project change.

## Verification

On 2026-10-09 UTC, the focused batch covering reference evidence, scoped owner diagnostics, the server diagnostic route, and actual editor-chat provider payloads passed 41 tests. After adding deselected-aspect coverage, the reference helper passed all seven tests. The actual route test confirms that the rule above reaches the provider as a system instruction, while forged reference instructions remain user data and never enter that system message.

An isolated Chromium 153.0.8010.0 run rendered the real React `ReferenceStylePanel` and `ServiceDiagnosticsPanel`, using test authentication/workspace providers and deferred test-only service responses. Nine checks passed: no automatic diagnostic request; an account switch aborts diagnostics and ignores its late response; completed diagnostic output clears when email or brand changes; late reference analysis is ignored after explicit cancellation, project change, account change, brand change, and unmount; a completed reference preserves its asset ID and source interval 1.25–2.5 seconds. There were zero external requests and zero page errors. The run did not sign into, fetch, or mutate a production account and did not call a paid provider.

These checks establish evidence validation, provider message separation and React lifecycle handling. They do not establish a live provider generation, access to an unavailable reference, or an end-to-end paid owner edit. Full project TypeScript, lint, build and test checks remain release gates.
