# Platform follow-up — 15 October 2026

## Delivered source changes

- Analyzer v2 requires full-duration source coverage, all four audiovisual editorial channels, explicit story classification and specific strengths/improvements. The provider receives a strict JSON schema in the existing single model call; the server validates it before successful settlement. An incomplete response returns 422 and releases its credit reservation.
- Overall editorial score is derived from duration-weighted attention (45%), clarity (35%) and processing ease (20%). Stimulation describes intensity and is required but does not earn an automatic reward. Missing channels prevent an overall score. These product weights are not a scientifically calibrated attention, retention or neural predictor.
- Unknown roles are unclassified, rather than silently becoming Other. Hook/core/proof/payoff/CTA have present/absent/uncertain assessments. Missing CTA is reported honestly. Recommendations are independent of safe executable timeline edits, so an empty machine plan cannot silently replace editorial guidance.
- The interface shows synchronized source playback, four signal cards, overall score, actual stepped observations, selectable roles, review thresholds and detailed evidence/improvements. The sidebar uses the matching Lucide BrainCircuit icon.
- Shared Studio controls now use consistent feedback, focus, sizing and typography, semantic button contrast, compact selector dimensions and logical RTL alignment. Prompt Director's narrow grid overflow is fixed.
- Trends accepts the blank broad-discovery request promised by its UI. Bounded discovery uses substantive cohorts. Source-backed search evidence survives social-site access blocks, while known deleted posts and unsupported dates/metrics remain excluded. Access-limited sources are identified as such rather than called directly verified.
- Credit migration excludes modern trend runs already debited through the ledger. A provable excess in a prior migration is corrected once, in the original included/top-up buckets. Tests cover owner isolation, same-millisecond boundaries, released reservations and negative credit balances. No live customer refund has been claimed or manually issued during this work.

## Localization scope

Static UI copy now goes through reactive translation resources; interface and generated-content language remain separate. The header and Settings offer the same 28 locales. Catalogs load on demand; English does not download the additional language catalogs. Critical analyzer/shared-control phrases have 222 translations per non-English locale. The Italian audit has no currently used literal UI-key gaps.

This is not complete platform translation in the other 26 locales: approximately 1,953 broader used phrases per locale still need translation at this checkpoint. Imported descriptors, API error text and user/generated content require origin-aware review. `node scripts/localization-audit.mjs --output <path>` reports exact gaps rather than filling them with English and counting them as translated. The local offline translation experiment is separate from released, reviewed catalogs.

## Validation

- Full suite: **884 tests passed across 113 files** at the first final integration checkpoint; subsequent focused checks cover small localization/CSS refinements.
- App/Node and Worker TypeScript, ESLint, app build and Worker build passed.
- Isolated 390 × 844 frame layout review covered 20 routes. Content widths fit the 380-pixel area after correcting Prompt Director. This is responsive layout verification with synthetic data, not a live delivery/generation test.
- Analyzer CUA checks covered actual source seeking, channel visibility, thresholds, tabs, legacy incomplete reports, missing clarity and English/German/Greek narrow layouts. Four rendering regressions cover incomplete-score and role behavior.
- No paid generation or external load-testing calls were made.

## Release boundaries

GitHub publication deploys the official Vercel client. The existing Sites Worker, D1 and R2 are a separate release target. Native Sites publishing tools have not been available in this session despite the user's authorization; a GitHub token does not provide that Sites write credential. The new client refuses to buy an old/incomplete analyzer response until the backend advertises `video-analysis-v2`.

The earlier capacity and audio evidence remains in [SCALE_AUDIO_REVIEW_2026-10-15.md](SCALE_AUDIO_REVIEW_2026-10-15.md). The isolated 100,000-account test does not establish 100,000 concurrent production users or overcome free-tier service limits. Existing saved audio comparisons are not a controlled same-script listening test and establish no provider quality winner.

## Requested compliance UI removal

The large status control panel and repetitive explanatory banners are not themselves required by Article 50. Applicable underlying obligations can still include machine-readable marking and audience disclosure for qualifying synthetic/deepfake content; removing a dashboard panel does not remove those duties. The publisher keeps relevant provenance behavior while simplifying the user flow. Primary references: [European Commission Article 50](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50), [Commission transparency FAQ](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act).

Research principles used by the rubric: [Lang, 2000](https://doi.org/10.1111/j.1460-2466.2000.tb02833.x), [Sweller, 1988](https://doi.org/10.1207/s15516709cog1202_4). Neither validates the numerical product weighting or a neural reading from video alone. OpenRouter search integration follows its [official server-tool documentation](https://openrouter.ai/docs/guides/features/server-tools/web-search).
