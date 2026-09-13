# Editor continuation — 13 September 2026

Continued from source `094e8d3e47f118aa4740e5bc3ec0e05d26a224af` (Sites v88). The supplied conversation is the requirements record; prior deployment claims are not evidence of paid output quality. The earlier 1,000-credit grant was not repeated.

## Changes

- Added editable text, callouts, counters, countdowns, arrows and highlights to the creation dock and clip inspector. Graphics are actual overlay clips, survive workspace saves and undo revisions, and export through libass. Preview and export share a deterministic 30 fps animation clock. No generation fee is needed for manual graphics.
- Added executable graphic operations to the paid AI planner, including selected-range edits. Unknown operation types are discarded instead of becoming unintended speed changes.
- Caption/audio observations are persisted per source, with review dates and timestamped moments. Checks can distinguish observed source captions, no observed captions, and unassessed footage. Checks and transcript assistance review every source video; their displayed credit total includes all those analyses. These are model observations, not guaranteed frame-by-frame coverage or a certified output audit.
- Auto-edit respects the captions option and skips new transcript overlays when source captions were detected. It also rejects automatic caption suggestions over footage with detected source captions. Existing user-authored captions remain editable.
- Library search includes saved source observations across projects/folders, with matched timestamped notes. This is text search of actual saved observations, not an embedding index or analysis of unreviewed files.
- Added reference structure analysis to script generation: hook structure, story beats, sentence pacing, proof/payoff and CTA; passed into the original-writing brief.
- Added draggable start/end handles and keyboard range adjustment; clamped ranges after duration changes.
- Corrected the narrow-column audio generator, enabled its supported 0.5-second SFX minimum and removed the misleading claim that a free catalog is below it.
- Shared clean pricing/editor URLs now resolve into the existing hash router instead of opening the homepage. Authentication callbacks and existing hash links are preserved.

## Reference review

The attached CapCut screenshot and both new PDFs were accessible. The Playbook's useful principles are source timing, motivated graphics, deterministic rendering, local assets and export verification. The Sandcastles document describes a separate paid MCP service; no subscription was purchased.

Notion's CapCut breakdown was accessible in the browser. Its countdown/counter workflow informed editable graphics. Ootto's links, reel guide and skills guide were accessible, together with the public Ootto watch/content-skills READMEs. Their useful pattern is timestamped visual evidence plus transcript evidence and reusable brand context. We did not install an unrelated marketing/automation stack into this application.

The six Natnael Girma reel pages could play in the authenticated browser. Visual samples showed prompt-driven cuts/caption changes, inserted overlays, a keypad graphic, a sports insert and a launch montage. This is visual sampling, not a claim to have audited every frame/audio track or measured Agent28's actual processing speed. Agent28's public site is a feature description/waitlist, not an accessible editor benchmark.

Agency Agents was reviewed as role/workflow guidance. Google Skills is primarily Google product/cloud integration guidance. Neither supplies a drop-in editing renderer. Earlier repository review decisions remain in `editor-upgrade-2026-09-10.md`.

## Sound retrieval

All 42 source files (40 WAV, 2 MP4; 117,061,210 bytes) were downloaded and ffprobed. A private downloadable ZIP includes checksums/durations. No sound files were added to public Git or the shared catalog.

The supplied folder includes Bluezone BC0296 samples. Bluezone's primary FAQ explicitly prohibits redistribution of individual samples, even modified: https://www.bluezone-corporation.com/faq . A Drive link does not establish permission to offer those files to every platform customer. Other files have no license documentation in this folder. This conflicts with the user's requirement for zero legal issues, so shared publication remains blocked pending appropriate rights or a different pack.

## Remaining gaps — do not claim completion

- AI music/SFX requires `ELEVENLABS_API_KEY`, `ELEVENLABS_COMMERCIAL_ENABLED=true`, and actual per-second music/SFX delivery rates. These were absent from the reviewed Sites runtime configuration. No guessed prices or connector credentials are embedded.
- Social reference URLs work only when the analysis provider can access playable media. Universal social download support and exact effect/audio replication are not implemented; uploaded references are supported.
- Full Agent28 parity, tracked 3D effects, arbitrary After Effects compositions, subject tracking and a semantic vector media index are not implemented.
- Automatic editing quality and generated audio have not been verified end-to-end against the user's account. No paid generation was silently claimed as tested.
- End-of-content instructions use observed timestamps and preserve unknown material. This is not a guarantee of perfect scene/word boundaries for arbitrary footage.

## Verification

The test suite includes native FFmpeg rendering of all six graphics, visibility before/during/after their interval, MP4 duration/dimensions, subtitle-command escaping, invalid timing, caption evidence normalization and shared-link routing. Existing billing, permissions, provenance and range-edit regression tests remain in place. Full type checks and both production build targets are required before publication.
