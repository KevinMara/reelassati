# Editor insertion and auto-edit recovery — 20 October 2026

The editor's media dock accepted `onInsert` and `playhead` props but did not pass them to its Library. Library items consequently exposed only preview/drag actions. The Library now defaults to compact rows with direct **Add** buttons and a choice of **At playhead** or **At end**. Insertions share measured source bounds and free-lane allocation with drag/drop, preserve existing clips, and use the existing saved Undo history. Pending insertions are guarded against duplicate clicks and changed account/brand destinations.

At tablet widths, Library and preview sit beside one another above the timeline. The Library scrolls within a bounded panel. Removing a forced child height also prevents its footer from overlapping media cards. Folder movement remains available under each row. The new interface copy is translated in all 28 supported interface languages.

Auto-edit now identifies the failed stage, HTTP status and safe provider support reference. Retrying the open editor reuses successfully completed source reviews and speech preparation for the same source, project, workspace, language and platform. Cancellation or scope changes cannot advance the next step. Source preparation remains separate from the final timeline replacement. A successful save closes the setup modal, returns focus to the timeline, and displays the returned edit summary.

## Verification

- 75 focused tests passed across eight files, including source-preparation recovery, cancellation, scope changes, insertion bounds, audio routing, Undo, API failure references and the actual media-dock interface.
- TypeScript checks passed; the strict localization audit found no missing used keys or raw static interface copy across 28 languages.
- The isolated browser used production editor components, local synthetic footage and simulated provider responses. Direct insertion at 2 seconds added a separate lane; Undo restored the original. Append placed a clip at the 4-second content end. A simulated HTTP 400 planning failure showed its stage/reference; retry saved the edited timeline and closed the modal.
- At the reported 1011×668 viewport and a 390×844 mobile viewport, document width did not overflow. The Library footer began at the dock's bottom, without overlapping cards.

## Production verification limit

The live official site also showed the existing generic AI-provider failure on Analyze. Native Sites project, credential and Worker-log calls returned “not available to the model,” so no production upstream status or provider message could be retrieved. The signed-in account did not expose the owner-only connection diagnostic. No backend binding, provider/model route or deployed backend version was changed.

No paid AI generation was run during these checks. A real test capped at 35 existing credits was requested separately because the user requires free operation. The live AI rejection is **not verified as repaired** by the simulated recovery test. GitHub publication delivers the client workflow fixes; it does not establish provider availability or generated editing quality.
