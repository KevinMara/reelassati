# Editor continuation — 7 October 2026

## Editing controls

- Persistent clip groups and explicit linked audio/video pairs. Manual moves, trims, splits and deletion preserve compatible peers; copied clips receive fresh relationship IDs. AI edits require explicit targets for structural changes to linked pairs.
- Source-window slip, adjacent-cut roll and rate stretch, with source bounds, overlap, lock and transition checks. Caption word clocks follow the actual retained source.
- Track names, ordering, gain and independent sound/picture solo. Reordering keeps primary speech footage and its captions attached to the correct clip.
- Source-time audio gain automation and stereo pan shared by preview and export.
- Configurable keyboard shortcuts with conflict validation, reset and local persistence.
- Actual video filmstrips and audio waveforms, with bounded queues, cache, decoding and cancellation. Unmeasured or unsupported media is labelled unavailable.
- Word-based transcript cuts remove corresponding footage and audio through the ripple engine; Restore uses the prior saved revision.
- Reusable editable graphics, caption appearances and captured static looks. Saved styles survive server save/reload and are sanitized independently from source assets and tracking data.
- Footage search over measured transcripts, recorded scene observations and explicit clip names, mapping source evidence into each trimmed or retimed timeline occurrence.

## Export and persistence

- MP4 and WebM at 720p, 1080p and 4K, with 24, 25, 30 or 60 fps. Project frame rate persists and follows undo/redo; export can override it.
- WebM uses VP8/Vorbis because the shipped browser encoder failed non-silent Opus and VP9 tests. Export verifies format, codec, dimensions, frame rate and complete playback decoding.
- Signed WebM provenance supports the emitted Matroska structure, finite or unknown-sized Segments, streamed upload/download, range requests and tamper detection without re-encoding.
- Workspace normalization retains groups, links, audio automation, frame rate, mixer settings and saved styles across real server save/reload.

## Validation and remaining scope

The release is checked with unit and server integration tests, native FFmpeg output, the installed browser FFmpeg/WASM core, TypeScript checks and a production build. Deployment status and exact source files are checked separately. This is not a claim of authenticated browser or paid-provider end-to-end verification.

Native Adobe After Effects project rendering requires a supported licensed renderer. Projected graphics and bounded 2D region tracking do not implement arbitrary tracked 3D scenes, person matting or full professional editor parity. Footage search uses recorded evidence rather than semantic embeddings. Provider quality and private-account operations still require their actual account/provider checks.

The earlier caption ownership, measured word animation, editable motion graphics, adjacent transitions, region tracking and verified shared audio catalog remain part of this release.
