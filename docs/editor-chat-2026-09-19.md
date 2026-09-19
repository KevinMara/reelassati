# Editor chat and workspace update — 2026-09-19

This update makes the editor a single workspace: media and creation tools on the left, preview in the center, **Reel**, the editing assistant, on the right, and the timeline below. This document describes implemented behavior and verification scope; it is not a claim of complete parity with another editor.

## Workspace and guidance

- Library, Video, Image, Audio, Captions, and Graphics are grouped on the left. Audio combines voiceover, music, and sound effects. Clip adjustments are contextual; project format and duration are kept with project controls.
- Library assets can be placed at a timeline position. Generated files remain manageable Library assets; generation alone does not imply insertion.
- Numbered visual and audio tracks, distinct media colors, clip selection, seeking, split, duplicate, clipboard operations, and undo/redo support direct editing alongside chat.
- Discoverable page guides explain the functions of each route, including editor shortcuts. Guides open on demand, support keyboard navigation, and do not interrupt users with automatic tours.

## Reel and action execution

Reel accepts ordinary editing requests, selected clips or a selected time range, and optional references from its attachment menu. A dedicated menu choice is not required to request captions, images, or other supported actions.

The shared action contract covers timeline edits, transcription, source/reference analysis, image/video/voice/music/SFX generation, free catalog audio, asset insertion, project settings, seeking, undo/redo, replanning, and editable story-section markers. Story markers organize the narrative without cutting footage unless a separate split operation is requested.

The conversation shows action status and results while work proceeds. In **Ask** mode, requested and necessary actions proceed; proposed additions outside the request receive inline approval or skip controls. **Auto** mode permits those additions within the selected credit ceiling. Scope approval does not remove credit limits or provider requirements.

Image, speech, video and generated-audio requests use stable identities; image and speech endpoints now use durable owner-scoped claims and cached responses to prevent duplicate provider calls and debits.

Plans retain request identifiers, dependencies, status, and recoverable job information. Execution checks the project version before timeline mutations, preserves completed work when retrying, and prevents approval controls from restarting completed or running actions. Undo/redo includes chat timeline changes. A failed or blocked operation is reported rather than represented as completed.

## References, analysis, and assets

Text-bearing PDFs are parsed locally using a bundled, same-version PDF.js worker. Limits are 10 MB, 200 pages, and 16,000 extracted characters per reference; oversized documents receive an actionable error rather than silent truncation. Scanned/image-only and password-protected PDFs receive explicit messages. This is text extraction, not OCR or visual understanding of PDF pages. Chat also bounds the number of references and total extracted text.

Video analysis prepares a bounded proxy while preserving the full source duration and audio. Encoded duration is checked to catch incomplete proxies. Files outside supported limits are rejected instead of silently analyzing only their beginning.

Free catalog audio can be imported into Library and explicitly placed on the timeline. The audio asset itself costs zero generation credits; an AI planning request can still consume credits. All **42 files** from the supplied sound ZIP were downloaded and verified. Their private account import remains pending, and they have not been published as redistributable stock: public availability of an archive does not itself establish redistribution permission.

## Reference observations and limits

Frame inspection of the supplied [Agent28](https://www.agent-28.com/) demonstrations informed the chat-first layout, visible action progress, and timeline feedback. Promotional frames do not establish uninterrupted processing time; comparative latency was not measured. The supplied private Narrative project required login, so its project contents could not be inspected.

The implementation draws on reviewed editor patterns, including [OpenCut](https://github.com/OpenCut-app/OpenCut), but does not claim every OpenCut feature. Native Adobe After Effects project execution, reliable object-tracked 3D compositing, universal social URL access, and exact reproduction of arbitrary reference videos are not achieved. Available graphics and animation controls should not be described as an After Effects replacement. Paid generation quality and the complete provider-backed editing flow still require end-to-end verification.

## Verification

Final verification: **396 automated tests across 62 suites** and all application/Worker type checks passed.

Browser verification exercised page guides, extraction with the real PDF worker, actual free-audio placement, inline optional-action skipping, and timeline undo/redo. Automated coverage includes action validation, scope decisions, budget bounds, stale-project handling, caption timing/range preservation, catalog import, and real PDF fixtures. These checks do not establish paid-provider output quality or universal media compatibility.

From a checkout with its declared dependencies installed:

```sh
npm run check
npm test
npm run build:client
```

The client build prepares the bundled renderer and PDF resources. Live provider checks require a configured deployment and are separate from these reproducible local checks.
