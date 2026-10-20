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

## Schema compatibility correction and remaining limit

The analysis schema previously encoded fit as a nullable string type with a mixed enum `["cover", "contain", null]`. It now uses `anyOf` with a string enum `["cover", "contain"]` and a separate null branch. This preserves the accepted values while avoiding adapters that represent string enum entries as strings. Google's structured-output documentation describes string enums as string values and documents nullable unions: <https://ai.google.dev/gemini-api/docs/structured-output>.

Seventeen focused tests passed across five files, including independent JSON-schema parsing of accepted/rejected fit values and checks that four-channel evidence, story structure, source bounds and nullable scores remain required. Active TypeScript checks, targeted lint, and the production client and Worker builds passed. This is a compatibility correction, **not proof of the live HTTP 400's cause**. It does not remove strict structured output, change the model, add a fallback generation, or relax the server's audiovisual evidence and full-coverage checks.

No backend binding, model route, access policy or production backend version was changed during this investigation. The live AI rejection is **not verified as repaired**. GitHub publication delivers client changes but does not deploy the existing Sites Worker; a backend rollout and a separately authorized live verification remain outstanding.
