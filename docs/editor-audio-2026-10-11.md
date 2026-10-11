# OpenRouter voice pricing and independent Adobe rendering — 11 October 2026

The user rejects dependence on their personal Asus VivoBook: it is intermittently off and will be replaced. Their PC is not a production worker. The hosted site and provider calls continue independently if it is off, replaced or destroyed. Native Adobe rendering requires a separate Windows/macOS host with After Effects; that host has not been provisioned or connected. No Adobe subscription, cloud machine, background service or capacity purchase was created in this release.

## Voice model and charges

Voice uses the existing OpenRouter key. Sarah remains the default. All 21 documented ElevenLabs premade voices now use `elevenlabs/eleven-v4-turbo`: it offers expressive audio tags and 90+ languages at the same per-character price tier as Flash v2.5. This is a choice based on documented capabilities and price, not a claimed listening-quality benchmark. The 332 existing MiniMax voices retain their IDs and `minimax/speech-2.8-turbo` model. Previews are cached per exact model, voice and sample text.

Charges are proportional to actual Unicode code-point count, rounded up to whole credits, minimum 1. The old whole 1,000-character block minimum is removed for all voices. v4 Turbo costs $20/M characters during OpenRouter's 50% launch discount, then $40/M. The known offer ends 19 October 2026 at 8am Pacific (15:00 UTC); the shared pricing contract expires it automatically. MiniMax remains $60/M. Each tariff allocates 150% of provider inference expense to the delivery budget: this includes room for OpenRouter funding fees and variable delivery, and is not a margin percentage. Funding minimums and actual storage/transfer costs have not been measured for each call.

| Characters | v4 Turbo during offer | v4 Turbo after offer | Existing MiniMax |
| --- | --- | --- | --- |
| 100 | 1 credit | 2 credits | 3 credits |
| 1,000 | 10 credits | 20 credits | 30 credits |
| 1,001 | 11 credits | 21 credits | 31 credits |

The UI, credit guide, planner, Reel quotes and backend share the same tariff. The UI sends the accepted quote, including planned/queued speech, without silently recomputing a higher approved amount. The backend rejects changed quotes before provider usage and credit debit. Existing idempotency, failed-action credit release, private output storage and embedded provenance remain intact. Existing transcription remains Scribe v2 at 2 credits per started minute, measured from prepared 16 kHz mono PCM rather than client metadata, with word timestamps and speaker labels.

## Accepted margin basis recovered from prior decisions

The accepted 9 September pricing implementation uses the $0.003 modeled provider-delivery budget per customer credit, USD base prices, local-currency checkout, Managed Payments, customer-paid taxes, and 1/5/10 social connections. Its modeled contribution margins were:

| Tier | Monthly | Annual |
| --- | --- | --- |
| Creator | 36.39% | 27.81% |
| Pro | 35.55% | 25.67% |
| Studio | 38.83% | 29.28% |

Top-ups of 1,000/$9, 2,000/$17 and 5,000/$39 modeled 51.79%, 51.35% and 49.14% respectively. These historical estimates assume full credit consumption, $3/social account at the reference scale, payment/FX/Managed Payments fees, hosting and a 3% reserve. They exclude salaries, advertising, accounting and income tax. They are not measured current net profit. The older 8 September EUR-converted proposal is superseded for this basis. Plan/top-up prices and allowances are unchanged; audio tariffs continue to fit the accepted delivery budget. A 50% cost allowance is not a 50% gross margin.

## SFX research and remaining blocker

OpenRouter currently lists nine ElevenLabs TTS models and two transcription models, but not its dedicated text-to-sound-effects generator. An OpenRouter key cannot authenticate the direct ElevenLabs SFX endpoint. That route remains disabled without its separate supported configuration; this release does not request another key or purchase a subscription.

OpenRouter lists `bytedance-seed/seed-audio-1-0` at $0.15/minute ($0.0025/generated second). Its description includes sound effects, optional voice/reference guidance and a maximum 120-second output. It is a candidate, not rejected as categorically incapable of SFX. The inspected OpenRouter speech schema and provider endpoint metadata do not establish a hard requested-duration limit for this model. A five-second prompt therefore does not establish a five-second bill; the documented maximum could cost $0.30 inference, equivalent to 150 credits with the current delivery allowance. No unverified five-second rate or guessed provider option is enabled. Custom AI SFX through OpenRouter remains incomplete pending verified bounded generation/billing and non-speech output. The existing licensed sound library and configured OpenRouter music generation remain available.

Other speech prices checked in the public catalog include Fish S2.1 Pro at $15/M characters, Mistral Voxtral Mini TTS at $16/M, and English-only Orpheus/CSM at $7/M. No audition proves these outperform the selected voice route, and they do not resolve standalone SFX billing.

## Adobe capacity

A dedicated Adobe render host would add native After Effects template/composition rendering independently of any user's personal PC. The web app would submit jobs to that host and receive rendered output. Growth is driven by concurrent renders and job duration/complexity, not registered-user count alone. A queue can absorb occasional peaks; sustained queue delays require more render workers or faster workers, plus sufficient asset storage/transfer capacity and provider limits. Those recurring costs must be measured and included in render credit quotes before enabling commercial Adobe rendering. The current release has not deployed this service.

## Verification

818 tests across 106 files pass, including actual worker/SQLite fixtures for v4 Turbo routing, exact accepted credit debits, replay without a second charge, preserved legacy voices, expired launch quote rejection before provider use, Unicode counts and delivery-budget coverage. Existing tests cover measured Scribe billing and timestamp/speaker provenance through storage/reload/export. App/Node/Sites TypeScript and whole-repository ESLint pass. Production build is required before publication. Provider responses are mocked; no fresh live paid audio generation, listening audition or authenticated browser QA is claimed.

Primary sources checked 11 October 2026:
- https://openrouter.ai/blog/announcements/elevenlabs-on-openrouter/
- https://openrouter.ai/elevenlabs/eleven-v4-turbo
- https://openrouter.ai/api/v1/models?output_modalities=speech
- https://openrouter.ai/api/v1/models/bytedance-seed/seed-audio-1-0/endpoints
- https://openrouter.ai/bytedance-seed/seed-audio-1-0
- https://openrouter.ai/docs/client-sdks/typescript/models/speechrequest
- https://openrouter.ai/pricing
- https://helpx.adobe.com/after-effects/desktop/render-and-export/automate-rendering/automated-rendering-network-rendering.html
