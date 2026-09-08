# Request completion audit — 8 September 2026

## Included in the current source

- Checkout-only terms/refund notice; no pre-checkout checkbox or cancelled-checkout/activation banners. Initial billing state loads without flashing “unavailable”. Real checkout errors remain visible when an attempted checkout fails.
- Exclusive-tax Stripe validation for existing EUR and USD options. No USD-only switch or price change has been made: the user's explicit confirmation is still required.
- Distinct purple brand-workspace selector with separate brand data and existing management screen.
- Existing essential legal/privacy pages, tracking consent and truthful feature copy are retained.
- Multipart original uploads and URL-based video analysis retained; completed MP4 renders now also save through multipart upload with streamed provenance marking and verification, removing the 24 MB finished-video restriction.
- Editor: duration follows remaining clips; explicit total duration, fit-to-content, ripple interval removal, timeline-selected AI range, undo/redo duration restoration, composed multitrack preview, framing, speed, volume, visual/audio fades, colour controls, larger workspace.
- AI suggestions execute actual supported timeline operations instead of merely changing acceptance status. Locked clips are respected. Missing supporting media is left unresolved, never labelled applied.
- Autonomous mode gathers a style brief and target duration, shows a credit estimate and optional generated-media counts, analyzes footage, prepares/transcribes speech, requests an executable edit plan, generates supporting images/videos within the selected counts, and saves an editable timeline with undo history. Existing Library assets are reused. Paid provider failures use existing ledger refunds.
- Inline image, video, voice, Library audio and original procedural sound effects. Speech is extracted into 16 kHz mono PCM chunks; original footage is preserved. Billing derives prepared speech duration from WAV bytes.
- Browser rendering mounts source blobs instead of copying all footage into WASM memory; the artificial aggregate-source-size, 180-second and 40-clip caps are removed. Device memory still limits a browser renderer, particularly its encoded output.
- Trends use multi-step search across brand cohorts, exact source-backed dates and labelled performance counts, explicit brand-promotion evidence, viral thresholds, duplicate/brand diversity filtering and equal Reels/TikTok selection. The permissive metricless fallback and citation-overwrite bug are removed. The cache version is changed so the old weak feed is not reused.

## Verification and remaining practical boundaries

- 159 automated tests passed, including real FFmpeg output and streamed saving/verification of a render above 24 MB. TypeScript, lint and production build are the publication gates.
- No authenticated production purchase or paid full autonomous edit has been performed in this turn. No real customer charge has been submitted.
- A new live weekly research run has not been verified. Sources that fail the stricter evidence gates are omitted; a balanced feed may contain fewer results or none. Public search coverage cannot establish the absolute most viral posts on either platform.
- Autonomous orchestration currently runs in the open browser tab; provider jobs and completed Library assets persist, but closing the tab does not continue the entire orchestration in the background. Server-durable orchestration remains further work.
- Motion design/keyframes, arbitrary effect plugins, a full music-generation engine and a durable server rendering service are not implemented by this update. The new integrated controls do not imply those capabilities.
- The main custom domain still needs the pending Vercel release. The previous direct-source Vercel deployment was rejected by automatic approval review because its review context was too large. It must not be retried or bypassed without the appropriate approval. Earlier GitHub write attempts returned 403 and the earlier PAT was invalid. Sites source publishing remains separately available.
- See USD_PRICING_PROPOSAL_2026-09-08.md for the requested USD proposal. All stated margins are modeled contribution, not guaranteed or measured net business profit.
