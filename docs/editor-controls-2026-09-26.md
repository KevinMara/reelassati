# Editor controls and execution release — 26 September 2026

This release strengthens the existing editor. It does not claim complete OpenCut parity, native Adobe execution, reliable footage tracking, or verified paid-generation quality.

## Reel

- Seven structured, server-owned workflows: motion design, captions, image generation, voice/audio, reference matching, story structure and time-range editing. Choosing one adds a removable composer chip; it does not paste a short instruction into the message.
- Planning mode produces a reviewable plan. Only Apply plan authorizes its execution, separately from approval of optional extras and the credit ceiling.
- AI auto-edit is visible beside the edit controls and in Reel's header. Setup starts from a practical editorial recipe; references and paid media allowances are optional disclosures.
- Existing motion graphics can be revised through the supported graphic operation, retaining their identity, timing, lane and untouched design. Blocked operations no longer produce a misleading Finished state.
- The default per-request budget is 200 credits. Legacy default preferences migrate; historical request budgets and newly chosen custom limits remain intact.
- Server instructions restrict Reel to editing, reject unrelated work and protect private platform, provider and owner details. This is scoped behavior, not a claim of infallible model secrecy.

## Manual editing

- Shift-select and select-all, grouped drag, copy/cut/paste, duplication and deletion; layer spacing and relative timing are preserved. Locked selections cannot be moved or deleted.
- Audio detachment, trim-to-playhead, mute/lock commands, broader playback navigation, timeline zoom shortcuts and a searchable keyboard shortcut dialog.
- Speech cues now carry source-clip ownership. Music edits preserve speech captions; detached audio keeps ownership. Name/color-only adjustments preserve cross-cut cues. Legacy cues use conservative source inference.
- Original source handles can be restored after trimming. Splits preserve outer fades and remove accidental interior fades.
- Separate preview aspect-ratio, inspection zoom (25–400%, with pan) and adjustment controls. The adjustment dialog groups timing, picture, sound, graphics and canvas/duration.
- Timeline zoom spans 25–1600% with adaptive rulers and a stable view anchor. Upload / Add from library selects and reveals the actual Library panel.
- Looks and transitions are available in the left tools. Existing transitions are fades/dissolves, not a full compositor transition engine.

## Captions, graphics and visual consistency

- Caption color, background, size, outline, case, weight, placement, safe margins and wrapping are editable with a live sample, shared preview/export settings and undoable saves.
- Cues can be split at the text cursor/playhead and merged. Timing, overlap and reading-speed feedback helps prevent broken subtitles. Word-level recognition or karaoke timing has not been added.
- Six editable motion choreographies add entrance, hold and exit phases, easing and opacity keyframes. Preset cards and the graphic composer show actual animated previews. Blank graphics require real supplied text.
- Preview and FFmpeg export share the same sRGB color transform; a native colored-pixel test checks agreement. Web Audio gain supports source amplification and StrictMode lifecycle reconnection.
- Elevated, opaque popovers and menus improve separation in both themes. Complex controls have contextual help; shortcut keys use compact keycaps. Free sound wording is “Free to use · no AI credits”.

## Validation and limitations

- 410 tests across 63 suites passed, including the real Worker normalization/paid replay path for a structured motion preset, manual-caption ownership, group layer preservation, planning guards and native FFmpeg color output.
- Application, Node and Worker TypeScript checks passed.
- No fresh browser walkthrough in this session: the Sites preview workflow's required control-browser skill was unavailable. Automated checks are not a substitute for that check.
- Live paid generation quality, provider recovery with real paid jobs, the recovered 42-file private account import, native Adobe projects, arbitrary 3D imports, tracking/rotoscoping and full OpenCut/Agent28 parity remain outstanding. No claim that every historical request is complete.
