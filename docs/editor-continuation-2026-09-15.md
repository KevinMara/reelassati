# Editor continuation — 15 September 2026

This release continues from `66d60d1850578d10b8a316fdec6de444b69f8273`. The latest user requirements supersede older requests to keep Checks or a structural quality map. Those panels are removed; internal validation remains.

## Delivered editor behavior

- Library file cards preview on click and drag to an exact timeline time. Per-file insertion plus buttons are removed. Uploads, folders, sorting, search, and grid/list views remain.
- Video, image, voiceover, music and sound-effect requests have individual named file cards. Up to four video/image/voice files can be submitted together. Outputs save to Library and are never automatically inserted. Pending video jobs resume polling; recovery never repeats a paid generation request. Current names, folders and favorites survive asynchronous completions.
- Video and image layers use Video 1, Video 2, etc.; higher numbered layers cover lower ones. Audio, text and graphics have their own numbered layers and colors. Existing legacy overlay data remains readable without an Overlay lane label.
- Drag clips, trim their edges, seek by clicking the timeline, and use keyboard playback, delete, copy/paste/cut, duplicate, split, undo/redo and frame stepping. Undo history and its current position survive reopening and batch imports.
- Compact menus, a Files icon, subdued scrollbars, animated AI suggestion buttons with a wand, and animated text while AI works. Motion respects reduced-motion preferences. Reference wording is “Match a reference style or video.”
- 332 documented voice IDs across 24 native-language groups, search and description filters, and on-demand real sample controls. Catalog availability is documented; every individual voice has not been live-generated.
- 12 caption styles with shared preview/export typography, SRT/WebVTT import and SRT download; 19 graphic presets, eight color looks and five fade presets. Graphics can be customized before insertion.
- Editable 3D title extrusion, cubes and orbital rings use shared perspective/depth/shading geometry in preview and MP4 export. Short spatial titles use bundled licensed Latin glyph outlines. This is not native Adobe project support or footage camera tracking.
- 33 newly downloaded and bundled CC0 audio files: 27 sound effects and six music tracks. Source/license/checksum records accompany them. Audio can be previewed and saved as a normal Library file with no AI credits.

## Provider reliability

- Reproduced the generated-video failure in actual workerd: R2 rejects an ordinary response stream without a known length. Video finalization now uses bounded multipart storage and streaming hash/mark/readback verification, with atomic final job/credit updates and safe stage diagnostics.
- Added recovery of already-generated provider outputs after a failed save, without a new generation purchase. Recovery still requires authenticated ownership, a completed provider output and full marking/storage verification.
- Music retains the existing OpenRouter connection. Added validated native MP3 support alongside WAV, complete-frame trimming, gapless/seek metadata repair, robust streamed audio parsing and dynamic saved MIME/extension. A format compatibility gap was verified in official documentation; the exact cause of the earlier live music failure is not claimed proven.

## Validation and limitations

Release verification completed on 19 September: 265 tests across 44 suites and all app/Worker type checks passed. A real browser export containing spatial graphics, captions and layered audio completed and saved its MP4 to Library. The export verifier handles the shipped WASM probe's unset success code while still requiring fresh valid metadata and a full playback decode.

The final deployment checkpoint records the exact commit, final test count and deployment result. Browser checks used an isolated local component harness and the normal local Worker identity; production authentication was not bypassed or modified. Confirmed free sound save without insertion, drag to 5.0 seconds, duplicate, undo and redo after reopening. Native FFmpeg tests verify actual exported layer order, alpha blending, captions, motion graphics, 3D geometry and decoded MP3 output; an actual workerd/R2 regression verifies the stream fix.

Live paid generation, recovery of the previously failed provider outputs, and all voice samples still need production verification. The cloud-browser secure sign-in handoff returned to the login page during this session; a successful authenticated test is not claimed.

The supplied Drive folder was freshly listed: 42 files and no license document. Its prior complete download remains documented; identified commercial sample terms prohibit an extractable shared catalog. These files are not represented as newly published CC0 sounds. See `editor-asset-audit-2026-09-15.md` for exact source findings.

Dedicated generated sound effects still require a supported provider key, commercial-use entitlement and accurate delivery-rate configuration. No new subscription was purchased. Native Adobe `.aep`/`.mogrt` execution, arbitrary GLB imports, automated camera/object tracking, rotoscoping, universal social-video ingestion, exact reference replication and full OpenCut/Agent28 parity remain unfinished. Do not claim that this release completes those systems.

## Source review

See `editor-source-audit.md` for OpenCut and Classic snapshots, inspected implementations and decisions. See `research/voice-catalog-2026-09-15.md` and `research/music-format-2026-09-15.md` for provider evidence. The supplied editing transcript and MotionPrompt material reinforce iterative revisions, timestamped feedback, separate asset generation and shared render verification; their marketing claims are not treated as product capability evidence.
