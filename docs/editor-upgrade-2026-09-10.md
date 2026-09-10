# Editor upgrade — 10 September 2026

## Implemented

- Full-width viewer and timeline; inspector below the timeline with a responsive control grid, reset controls and a dialogue-bed audio preset.
- Original navigation order restored, including the generation subgroup and three original section breaks.
- Visible creation tools inside the timeline section, alongside library/upload/editing controls.
- Distinct library surface and image/video previews, including the global media tray.
- One-decimal seconds with a decimal dot; precise source durations remain unrounded internally. Missing audio/video duration is probed with a timeout, never guessed as five seconds.
- AI auto-edit with automatic content duration, speech timing independent of caption output, source-timestamped visual observations, concrete style recipes and deterministic source-bound/locked-clip validation. Reversible revisions remain available.
- Free MP3 catalog: 17 effects and two music beds, with native previews and insertion at the playhead. Removed procedural beeps and excluded generic error/question/success notification tones. Licenses and primary-source records are in public/editor-audio/licenses. These are CC0 assets, not verified trending or viral recordings. No per-use provider or royalty fee; normal storage/transfer costs still exist.
- AI instrumental music and SFX API integration with a server-calculated quote, explicit credit acceptance, duplicate-request claim, existing credit reservation/refund handling and embedded provenance. Not activated without provider configuration.
- Trend selection deduplicates tracking variants of the same direct source while retaining the existing balanced Instagram/TikTok, dated, organic-brand evidence criteria.

## Reference review and decisions

Reviewed the two supplied transcripts as workflow examples, not proof of output quality. Adopted media inspection, timestamped speech, deliberate style recipes and reviewable stages. No claim that this reproduces a desktop editor or guarantees one-shot professional results.

| Reference | Decision |
| --- | --- |
| https://github.com/barckley75/resolve-claude-mcp | Learn explicit timeline operations and review/render separation. Desktop Resolve Studio dependency; not deployed into the web runtime. |
| https://github.com/palmier-io/palmier-pro | In-editor media generation is relevant. Current product has platform/proprietary constraints; no source imported. |
| https://github.com/OpenCut-app/OpenCut | Useful editor/headless architecture reference. Current rewrite is not a replacement for the deployed editor. |
| https://github.com/bradautomates/claude-video | Adopt timestamped source inspection and caption/scene evidence. |
| https://github.com/digitalsamba/claude-code-video-toolkit | Adopt staged composition and delivery checks. Open-source models still require compute; no free-generation claim. |
| https://github.com/Bomx/super-video-maker-skill | Workflow inspiration only; no code copied without a verified license. |
| https://github.com/Panniantong/Agent-Reach | Source acquisition ideas; no service installation or bypass of platform access controls. |
| https://github.com/siddharthvaddem/openscreen | Desktop screen recording is outside this editor upgrade. |
| https://github.com/AgriciDaniel/claude-ads | Paid-ad workflow is outside the organic-content research scope. |
| https://github.com/getmaxun/maxun | Separate browser extraction infrastructure and AGPL obligations; not installed. |
| https://github.com/browser-use/browser-use | Browser automation infrastructure; not embedded into a Worker as a shortcut. |
| https://github.com/D4Vinci/Scrapling | Adaptive extraction reference; no unsupported scraping service added. |
| https://github.com/daijro/camoufox | No anti-detection browser deployed or access-control bypass introduced. |

## AI audio activation

Production currently has no ElevenLabs credentials. Set the following on both runtime targets after confirming the account's commercial/API terms and effective provider costs:

- ELEVENLABS_API_KEY (secret)
- ELEVENLABS_COMMERCIAL_ENABLED=true
- ELEVENLABS_MUSIC_USD_PER_SECOND
- ELEVENLABS_SFX_USD_PER_SECOND

Rates must conservatively cover the account's billing minimums and associated variable delivery costs. The quote rounds `seconds × rate / $0.003` up to a whole credit. There is no guessed default rate and no free-generation promise. Instrumental music is limited to 3–60 seconds; SFX to 0.5–30 seconds in the API. The editor currently exposes 3–30 seconds for effects.

Official API references: https://elevenlabs.io/docs/api-reference/music/compose and https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert. These are the actual music and sound-generation endpoints, not TTS substitutes.

## Verification limitations

Type checks and 172 tests passed before packaging. The browser preview reached the real sign-in page; no authenticated editor session was available. No auth bypass or fabricated production media was used. Live paid AI audio execution remains untested until provider activation. Structural timeline checks do not replace listening to the mix or visually reviewing a final export.
