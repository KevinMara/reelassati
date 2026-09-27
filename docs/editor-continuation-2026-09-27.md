# Editor continuation — 27 September 2026

## Changes in this release

- Removed duplicate header AI auto-edit and timeline Adjust clip; undo/redo sit beside timeline zoom. Selection and Alt-placement guidance lives in Shortcuts. Chat composer uses compact, normal-weight sans-serif text.
- Optional actions can be approved/skipped while another action executes. Selection circles support batch include-selected/skip-rest and the inverse. Decisions persist separately from execution; one runner drains the queue, respects Stop and plan approval, and rechecks an action atomically before starting it.
- Find sections directly requests evidence-bound story markers. It does not populate chat, change clips or generate captions. Missing source observations are analyzed first; the server restricts this task to markers. Source changes during the request invalidate stale markers.
- Chat accepts documented nested edits and unambiguous legacy flat edits. Missing, locked and unknown targets are rejected before the legacy mapper; the current selection cannot override explicit targets. A bounded repair keeps the same credit reservation and references. Unrepairable malformed plans return an error with released planning credits.
- Shared footage transform engine: position, scale, rotation, opacity, flips, frame crop, ellipse/rounded masks, up to 24 eased source-time keyframes, dissolve/wipe/slide/zoom visual transitions. Preview and FFmpeg use the same timing and composition. New transitions anchor to the current clip independently of the preserved pose clock. AI pose edits update existing animation paths.
- Fixed export pixel-center handling for flips/rotation and reduced repeated transform expressions. Installed browser WASM tests cover the actual filter, including maximum keyframes.
- Real provider word timestamps survive transcription, timeline movement/retiming and workspace persistence. Captions highlight actual spoken words and stay static in gaps or when timing is absent. Cue boundary edits do not stretch speech timing. Trimmed word-timed cues drop words no longer audible. ASS export shares line breaks/highlighting with preview.
- Shared font-metric wrapping for motion graphic text and callouts fixes preview/export disagreement.

## Actual account/asset work

The authenticated owner account was verified in the browser. The 41 intact files (40 WAV and Copy of 4 MP4) are uploaded to Library → Futuristic SFXs in the test brand. No timeline insertion was performed. The remaining Copy of 2 (sfx).mp4 is still incomplete locally and Google Drive displays download failure in the browser. Expected original: 44,697,857 bytes; SHA-256 c5c983c5e4821e21a7694dddeb5310dcb019f7a6b3bed1fcf1def0bdc0aefa2e. Do not upload the truncated local copy or claim 42 files imported.

No repeat credit grant. Existing owner credit access remains. USD pricing, Managed Payments and paid subscription rules for other users are unchanged.

## Remaining limits — do not claim complete parity

- Supplied Drive assets are private owner uploads; a public Drive URL does not establish redistribution rights for the shared customer catalog. Existing verified CC0 catalog remains available.
- Custom generated SFX still requires the configured provider connection and actual commercial rate; music uses the existing OpenRouter integration.
- Supported dimensional titles/shapes are not native Adobe After Effects project support, arbitrary camera tracking or full OpenCut/Agent28 parity.
- Word timestamps depend on provider output. Do not invent alignment when absent.
- Paid generation/model quality is not established by mocked provider tests. The current release needs real provider/account checks for any quality claims.
- The prescribed managed-preview control-browser skill is unavailable in this environment. Do not claim new browser visual QA for this release. Unit/integration/native rendering/installed WASM verification and build/deployment status are reported separately.

The durable external continuation file records the final commit, test counts, deployment IDs and the exact next step after publication.
