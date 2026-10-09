# Editor continuation — 9 October 2026

## New editing features

- Beat cuts measure percussive onsets from actual decoded audio. Source trims, playback speed and timeline placement determine cut points. The user can preview points, adjust sensitivity, choose every Nth onset and set minimum spacing. Only explicit picture targets and their listed linked AV peers split; independent music and other layers stay in place. Bounds: measured sources up to five minutes / 16 MB, 48 cut points and 500 resulting timeline clips. No invented tempo grid or inferred downbeat labels.
- Speech autozoom alternates restrained punch-ins at measured phrase changes. Word timing must belong to the picture or its explicitly linked audio. Existing paths require explicit replacement. Source-time keyframes preserve the result across trims, splits and speed changes. This is editorial zoom, without face or camera tracking.
- Both rhythm actions are available to Reel chat. Action execution uses zero extra credits; ordinary planning retains its existing charge. Server and replay validation enforce exact targets, whole-clip scope, locks, supported controls, linked peers and source bounds. Applying an already saved action cannot cut or animate twice.
- Four more measured word-caption animations: word pop, word rise, word fade and word type. Missing timing displays the whole phrase; speech pauses stay clear. Type reveals complete Unicode graphemes. Preview and ASS export use shared motion and project/export FPS. There are now 22 caption presets and nine animation choices.
- Editable polygon masks have three to twelve points, with even-odd fill in preview and export. Crop and transforms share source coordinates. Six blend modes join normal compositing: multiply, screen, overlay, darken, lighten and difference. Export restores upper-layer alpha after RGB blending, preserving masks, fades, contain padding and timeline gaps.

Every manual rhythm apply creates one saved revision. Chat stores each completion with its reversible revision. Workspace PUT, stored JSON and GET retain polygon/blend settings, source-time motion and the new caption appearance.

## Verification and boundaries

All 609 tests across 87 files pass, and the application, Node and Sites TypeScript checks pass. Whole-repository ESLint passes without errors or warnings. Actual native FFmpeg and the installed browser WASM core verify pixels for all six blend modes with polygon masks, partial opacity and timeline gaps. Native caption rendering verifies entrances and empty speech gaps. Rhythm regressions cover actual opposite-phase stereo impulses, source/time mappings, exact linked AV cuts, caption clocks, independent music, undo, motion replacement, stale plans and replay. Production builds are checked at publication.

The previous lint findings are resolved: clip/duration drafts synchronize on source changes during render, timeline background seeking has a native keyboard control, trim handles expose keyboard sliders, graphic easing has a correctly labelled control, and intentional control-byte sanitization remains intact. Checkout callback dependencies are stable; prices and entitlement rules are unchanged.

Authentication/provider verification remains a separate live-account check. A secure browser sign-in attempt timed out in the new session, so no new successful paid-provider result is claimed. The previous release's manual eight-second live export remains valid evidence for that earlier workflow.

Remaining major systems include native Adobe .aep/.mogrt rendering, arbitrary GLB rendering and camera reconstruction, person matting/depth/rotoscoping, semantic embeddings, universal social-video ingestion, complete reference-driven generative matching and full professional-editor parity. Native Adobe needs a supported licensed runtime. Custom SFX still needs a real eligible provider configuration and measured usage rate. The implementations above do not establish those systems or exact reproduction of every supplied reference.
