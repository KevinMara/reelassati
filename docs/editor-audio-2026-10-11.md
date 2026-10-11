# OpenRouter voice/SFX pricing and independent Adobe rendering — 11 October 2026

The user rejects dependence on their personal Asus VivoBook: it is intermittently off and will be replaced. Their PC is not a production worker. The hosted site and provider calls continue independently if it is off, replaced or destroyed. Native Adobe rendering requires a separate Windows/macOS host with After Effects; that host has not been provisioned or connected. No Adobe subscription, cloud machine, background service or capacity purchase was created in this release.

## Voice model and charges

Voice uses the existing OpenRouter key. Sarah remains the default. All 21 documented ElevenLabs premade voices now use `elevenlabs/eleven-v4-turbo`: it offers expressive audio tags and 90+ languages at the same per-character price tier as Flash v2.5. This is a choice based on documented capabilities and price, not a claimed listening-quality benchmark. The 332 existing MiniMax voices retain their IDs and `minimax/speech-2.8-turbo` model. Previews are cached per exact model, voice and sample text.

Charges are proportional to actual Unicode code-point count, rounded up to whole credits, minimum 1. The old whole 1,000-character block minimum is removed for all voices. v4 Turbo costs $20/M characters during OpenRouter's 50% launch discount, then $40/M. The known offer ends 19 October 2026 at 8am Pacific (15:00 UTC); the shared pricing contract expires it automatically. MiniMax remains $60/M. Each tariff allocates 150% of provider inference expense to the delivery budget: this includes room for OpenRouter funding fees and variable delivery, and is not a margin percentage. Funding minimums and actual storage/transfer costs have not been measured for each call.

| Characters | v4 Turbo during offer | v4 Turbo after offer | Existing MiniMax |
| ---------- | --------------------- | -------------------- | ---------------- |
| 100        | 1 credit              | 2 credits            | 3 credits        |
| 1,000      | 10 credits            | 20 credits           | 30 credits       |
| 1,001      | 11 credits            | 21 credits           | 31 credits       |

The UI, credit guide, planner, Reel quotes and backend share the same tariff. The UI sends the accepted quote, including planned/queued speech, without silently recomputing a higher approved amount. The backend rejects changed quotes before provider usage and credit debit. Existing idempotency, failed-action credit release, private output storage and embedded provenance remain intact. Existing transcription remains Scribe v2 at 2 credits per started minute, measured from prepared 16 kHz mono PCM rather than client metadata, with word timestamps and speaker labels.

## Accepted margin basis recovered from prior decisions

The accepted 9 September pricing implementation uses the $0.003 modeled provider-delivery budget per customer credit, USD base prices, local-currency checkout, Managed Payments, customer-paid taxes, and 1/5/10 social connections. Its modeled contribution margins were:

| Tier    | Monthly | Annual |
| ------- | ------- | ------ |
| Creator | 36.39%  | 27.81% |
| Pro     | 35.55%  | 25.67% |
| Studio  | 38.83%  | 29.28% |

Top-ups of 1,000/$9, 2,000/$17 and 5,000/$39 modeled 51.79%, 51.35% and 49.14% respectively. These historical estimates assume full credit consumption, $3/social account at the reference scale, payment/FX/Managed Payments fees, hosting and a 3% reserve. They exclude salaries, advertising, accounting and income tax. They are not measured current net profit. The older 8 September EUR-converted proposal is superseded for this basis. Plan/top-up prices and allowances are unchanged; audio tariffs continue to fit the accepted delivery budget. A 50% cost allowance is not a 50% gross margin.

## Custom SFX through OpenRouter

Custom sound effects now use `bytedance-seed/seed-audio-1-0` with the existing OpenRouter key. The official full TTS guide explicitly documents non-speech prompts for sound effects and ambience: POST `/api/v1/audio/speech` with `model`, `input` and `response_format: "mp3"`, omitting voice, references and provider options. Input is capped at 3,000 characters and generated audio at 120 seconds. The platform reserves wrapper space by limiting the description to 2,700 characters. No direct ElevenLabs key or invented duration parameter is used.

Seed is priced at $0.15/minute ($0.0025 per generated second). Requested duration is a prompt instruction, not a hard provider limit. The user accepts a **maximum 150-credit hold**, representing the documented 120-second bound and the existing 150% inference delivery allowance within the $0.003 budget per credit. After validated output is measured, the actual charge is `max(1, ceil(providerSeconds * 0.0025 * 1.5 / 0.003))`; the unused hold is atomically returned to its original included/top-up buckets. A true five-second generated take costs 7 credits, a 30-second take 38, and the maximum 120-second take 150. Trimming to a shorter editor excerpt does not erase the full generated take's provider expense. The UI discloses that distinction and shows an approximate requested-duration cost. The entire maximum balance is required before a provider call.

Native MP3 frame/gapless metadata are validated and measured before a lossless excerpt trim. Short one-shot output is accepted without invented silence or a retry charge. Invalid output, a provider failure or failed atomic settlement releases the full hold and returns no asset. Repeated/concurrent request IDs cannot repeat paid generation; operation keys now include the owner. Existing private storage, embedded marking, provenance, rights checks and sound library remain intact. Successful ledger rows keep actual debit plus original reserved credits; settlement/refund is idempotent.

This resolves the earlier duration/billing integration blocker with the documented global cap and measured settlement. Provider generation and listening quality are not live-auditioned; no claim of the best tested audio model or verified funding is made.

Other speech prices checked in the public catalog include Fish S2.1 Pro at $15/M characters, Mistral Voxtral Mini TTS at $16/M, and English-only Orpheus/CSM at $7/M. No audition proves these outperform the selected voice route, and they do not resolve standalone SFX billing.

## Adobe capacity

A dedicated Adobe render host would add native After Effects `.aep` composition and supported Adobe `.mogrt` template rendering independently of any user's personal PC: animated titles, lower thirds, logo animations, and complex template effects authored in Adobe. Current editing, captions, supported motion graphics, AI voice/SFX and ordinary exports do not require Adobe. The web app would submit jobs to that host and receive rendered output. Growth is driven by concurrent renders and job duration/complexity, not registered-user count alone. A queue can absorb occasional peaks; sustained queue delays require more render workers or faster workers, plus sufficient asset storage/transfer capacity and provider limits. Those recurring costs must be measured and included in render credit quotes before enabling commercial Adobe rendering. The initial setup does not guarantee permanent zero-maintenance operation or unlimited capacity at 100,000 users. The service needs host security/maintenance and template/font/plugin compatibility management, with worker capacity based on concurrency. The current release has not deployed this service.

## Verification

835 tests across 107 files pass, including native MP3 duration/bounds, included/top-up partial settlement, insufficient balance rejection before paid use, duplicate concurrent SFX requests, provider/invalid-output/settlement-failure full refunds, and actual worker/SQLite fixtures for v4 Turbo routing, exact accepted credit debits, replay without a second charge, preserved legacy voices, expired launch quote rejection before provider use, Unicode counts and delivery-budget coverage. Existing tests cover measured Scribe billing and timestamp/speaker provenance through storage/reload/export. App/Node/Sites TypeScript and whole-repository ESLint pass. Production client/server build passes. Provider responses are mocked; no fresh live paid audio generation, listening audition or authenticated browser QA is claimed.

Primary sources checked 11 October 2026:

- https://openrouter.ai/blog/announcements/elevenlabs-on-openrouter/
- https://openrouter.ai/elevenlabs/eleven-v4-turbo
- https://openrouter.ai/api/v1/models?output_modalities=speech
- https://openrouter.ai/api/v1/models/bytedance-seed/seed-audio-1-0/endpoints
- https://openrouter.ai/bytedance-seed/seed-audio-1-0
- https://openrouter.ai/docs/guides/overview/multimodal/tts
- https://openrouter.ai/docs/client-sdks/typescript/models/speechrequest
- https://openrouter.ai/pricing
- https://helpx.adobe.com/after-effects/desktop/render-and-export/automate-rendering/automated-rendering-network-rendering.html
