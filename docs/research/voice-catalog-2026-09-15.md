# Voice catalog and samples — 15 September 2026

The editor and standalone Voiceover page share `VoiceSelector`. It exposes the complete documented MiniMax system catalog: 332 voice IDs with 24 native language groups, searchable names and description tags, and a compact sample player. Native language is a catalog filter, not an instruction to translate a user's script. Generation keeps using the chosen voice ID and the existing OpenRouter speech provider. No new API key is needed for these voices.

Sources checked:

- [MiniMax system voice IDs](https://platform.minimax.io/docs/faq/system-voice-id): all 332 IDs and names imported verbatim; capitalization, punctuation and spaces preserved.
- [OpenRouter MiniMax Speech 2.8 Turbo](https://openrouter.ai/minimax/speech-2.8-turbo): arbitrary MiniMax voice IDs accepted.
- [OpenRouter TTS documentation](https://openrouter.ai/docs/guides/overview/multimodal/tts): `/api/v1/audio/speech` returns raw audio, and model discovery uses `?output_modalities=speech`.
- [Live speech model catalog](https://openrouter.ai/api/v1/models?output_modalities=speech): `minimax/speech-2.8-turbo` present; price `$0.00006` per input character; 45 English IDs advertised as default choices; model description explicitly permits arbitrary MiniMax voice IDs.

Tags are derived from the provider's descriptive voice names; they are not fabricated quality ratings or popularity claims. Language coverage displayed in the UI is the 24 native groups actually represented in the catalog, not the provider's larger multilingual synthesis claim.

Samples are real provider-generated MP3s from the existing `/api/voice-preview` endpoint. Selecting a voice alone makes no sample request. Clicking Listen requests the selected sample and plays it; the shared server cache and generation lease reuse it across listeners. Existing eight preview scripts remain byte-for-byte unchanged so their saved samples are reusable. New scripts are short and in the native language. Samples incur a small platform provider cost only when uncached; they are not advertised as zero-cost generation. No user-credit pricing was modified.

Verification: catalog invariants, exact legacy IDs/cache text, native sample coverage, unusual ID punctuation, and combined language/style/search filters are tested in `contracts/voices.test.ts`; targeted ESLint passes. The new catalog was not exhaustively generated: 332 live calls would add avoidable cost. Representative live playback should be checked through the authenticated editor after deployment.
