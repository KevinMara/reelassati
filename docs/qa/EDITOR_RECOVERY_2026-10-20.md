# Editor insertion and auto-edit recovery — 20 October 2026

The editor's media dock accepted `onInsert` and `playhead` props but did not pass them to its Library. Library items consequently exposed only preview/drag actions. The Library now defaults to compact rows with direct **Add** buttons and a choice of **At playhead** or **At end**. Insertions share measured source bounds and free-lane allocation with drag/drop, preserve existing clips, and use the existing saved Undo history. Pending insertions are guarded against duplicate clicks and changed account/brand destinations.

At tablet widths, Library and preview sit beside one another above the timeline. The Library scrolls within a bounded panel. Removing a forced child height also prevents its footer from overlapping media cards. Folder movement remains available under each row. The new interface copy is translated in all 28 supported interface languages.

Auto-edit now identifies the failed stage, HTTP status and safe provider support reference. Retrying the open editor reuses successfully completed source reviews and speech preparation for the same source, project, workspace, language and platform. Cancellation or scope changes cannot advance the next step. Source preparation remains separate from the final timeline replacement. A successful save closes the setup modal, returns focus to the timeline, and displays the returned edit summary.

## Verification

- 75 focused tests passed across eight files, including source-preparation recovery, cancellation, scope changes, insertion bounds, audio routing, Undo, API failure references and the actual media-dock interface.
- TypeScript checks passed; the strict localization audit found no missing used keys or raw static interface copy across 28 languages.
- The isolated browser used production editor components, local synthetic footage and simulated provider responses. Direct insertion at 2 seconds added a separate lane; Undo restored the original. Append placed a clip at the 4-second content end. A simulated HTTP 400 planning failure showed its stage/reference; retry saved the edited timeline and closed the modal.
- At the reported 1011×668 viewport and a 390×844 mobile viewport, document width did not overflow. The Library footer began at the dock's bottom, without overlapping cards.

## Authorized production test

The user authorized one real auto-edit test, capped at 35 existing credits. A disposable project, `project-161d57fa-a8ac-4bf5-9ad0-51d016cdc472` (QA auto-edit diagnosis — 20 October 2026), used the existing four-second synthetic video `QA audio and motion — 14 October 2026.mp4`. The quote was 17 credits: review 10, speech timing 2, planning 5, optional media 0. Build was submitted exactly once at 14:04:51 UTC on 20 October. No subsequent paid retry was made.

The request failed during video review with HTTP 400 and support reference `daab0620-d474-4814-a792-27ee35733a56`, before transcription or edit planning. A fresh Billing page confirmed 801 credits before and after the test, a net cost of zero. No generated images or videos were requested or created. The original source clip remains in the diagnostic project.

After the user signed into OpenRouter, its Upstream Requests log independently confirmed `google/gemini-2.5-flash` / Google AI Studio, HTTP 400, one upstream attempt, 2.3 seconds, generation ID `gen-1792505102-io4yKLGK7CI2zXigOKBv` (16:05 CEST). The request-detail drawer exposes routing and status but no error body. Native Sites Worker-log calls still returned “not available to the model.” The precise rejected field therefore remains unconfirmed.

## Retrieved Worker evidence and bounded diagnostics

The user explicitly authorized a read-only diagnostic request to the existing publishing chat “Recupero file mancanti.” Delivery was independently confirmed in destination turn 01a159d2-53b3-7082-9f5a-7535592d41c5; the request ran once and completed without a retry, provider call, deployment or configuration change. Its working Sites connection retrieved the exact matching Worker event at **14:05:06.055 UTC / 16:05:06.055 CEST**, with Worker request ID eb668ce16d062932be701b826182153f, Cloudflare Ray ID a4d8931bea85ea59, route POST /api/ai/analyze, OpenRouter HTTP 400, and the same support reference. The event was not truncated. Inspection of the deployed handler confirmed that the detailed error body had been read and discarded, so it cannot be reconstructed from this record. The chat verified Sites version **112**, source a523e5d699e365b36bd4d22e8a9ad39d1d9739cc.

The OpenRouter failure handler now projects the existing error payload into private Worker diagnostics: recognized request IDs and error codes, a fixed schema/media/context/parameter issue category when reported, and a bounded field path with unknown names redacted. It also correlates chat failures with the internal invocation ID, configured model and purpose. It never logs raw error bodies, free-form messages, prompts, media, URLs, authentication headers or arbitrary provider metadata. The customer response retains only the existing generic message and safe support reference.

Regression coverage includes a real Worker route with in-memory D1/R2 and a simulated provider HTTP 400. It checks one provider request, complete credit release, correlated private diagnostics and no diagnostic leakage into the public response. Separate cases reject unsafe field paths, redact unknown names, ignore malformed/oversized nested payloads and constrain copied request IDs and codes. These tests use no live provider calls. This corrects the observed diagnostic loss; it does not retroactively recover the historical error or prove its cause.

## Schema compatibility correction and remaining limit

The analysis schema previously encoded fit as a nullable string type with a mixed enum `["cover", "contain", null]`. It now uses `anyOf` with a string enum `["cover", "contain"]` and a separate null branch. This preserves the accepted values while avoiding adapters that represent string enum entries as strings. Google's structured-output documentation describes string enums as string values and documents nullable unions: <https://ai.google.dev/gemini-api/docs/structured-output>.

The combined schema and diagnostics changes passed 69 focused tests across seven files, including independent JSON-schema parsing of accepted/rejected fit values, four-channel evidence and source bounds, private diagnostic redaction, actual Worker credit release, API support references and auto-edit preparation recovery. Active TypeScript checks, targeted lint and the rebuilt Worker passed; the prior schema-only GitHub release passed all 941 tests and both production builds. This is a compatibility correction, **not proof of the live HTTP 400's cause**. It does not remove strict structured output, change the model, add a fallback generation, or relax the server's audiovisual evidence and full-coverage checks.

No backend binding, model route, access policy or production backend version was changed during this investigation. The live AI rejection is **not verified as repaired**. GitHub publication delivers client changes but does not deploy the existing Sites Worker; a backend rollout and a separately authorized live verification remain outstanding.
