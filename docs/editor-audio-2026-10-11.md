# ElevenLabs audio integration — 11 October 2026

The user rejects dependence on their personal Asus VivoBook: it is intermittently off and will be replaced. Native Adobe work must use a separate supported render host when implemented. No personal-machine worker, Adobe cloud renderer, purchase or background service was created in this change.

Voice generation uses the existing OpenRouter key. Sarah is the default, and 21 documented ElevenLabs premade voices route to elevenlabs/eleven-flash-v2.5. The 332 existing MiniMax voices retain their model and IDs; previews remain cached per model, voice and exact sample text. Unknown/unpriced voices are rejected before paid provider usage. The speech endpoint checks a supplied accepted credit quote; UI and Reel planning use the same selected-voice rate and Unicode code-point count. Original idempotency, credit release and marked private output storage are preserved.

Transcription uses elevenlabs/scribe-v2 with verbose word timestamps and speaker diarization. Word-only responses become bounded caption cues with measured clocks and speaker labels. All hosted billing uses verified 16 kHz mono PCM duration, not a mutable client duration or missing metadata. The voice-notes page prepares speech through the existing lazy FFmpeg workflow and reads recording duration before enabling transcription. Direct non-PCM calls must supply prepared segments; duplicate segments and more than 100 segments are rejected. Provider calls have a three-minute bound per segment.

Credit costs: each started 1,000 characters costs 20 credits for ElevenLabs or 30 for existing MiniMax voices; each started transcription minute costs 2 credits. The existing $0.003 modeled delivery budget per credit, plan prices, plan allowances and top-ups remain unchanged. These rates use regular provider costs ($40/M characters for Flash, approximately $0.000061/second for Scribe, $60/M characters for MiniMax) and preserve the original voice tariff's 50% delivery allowance. Temporary launch discounts are not a permanent pricing baseline.

Primary sources checked 11 October 2026:
- https://openrouter.ai/blog/announcements/elevenlabs-on-openrouter/
- https://openrouter.ai/elevenlabs/eleven-flash-v2.5
- https://openrouter.ai/elevenlabs/scribe-v2
- https://openrouter.ai/api/v1/models?output_modalities=speech

The listed ElevenLabs models do not expose its dedicated standalone SFX generator. The existing private SFX catalog remains available; custom non-speech SFX is not enabled by this update and no OpenRouter key is sent to direct ElevenLabs endpoints. Existing music routing is preserved.

Validation: 815 tests pass, including actual worker/SQLite fixtures for model routing, displayed credit debits, repeat-request replay, legacy voice preservation, stale-quote/unpriced-voice rejection before provider usage, measured 61-second Scribe billing, and speaker/word timestamp provenance across storage/reload/export. These are isolated provider-response fixtures: no fresh live paid audio or quality audition is claimed. App/Node/Sites TypeScript, whole-repository ESLint and production client/server build are required before publication.
