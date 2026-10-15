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

Static UI copy now goes through reactive translation resources; interface and generated-content language remain separate. The header and Settings offer the same 28 locales. Catalogs load on demand; English does not download the additional language catalogs. Critical analyzer/shared-control phrases have 222 translations per non-English locale.

The expanded follow-up audit finds **3,284 used UI keys**, with no key gaps in English, Italian, Spanish, French, German, Portuguese, Dutch, Polish, Romanian, Turkish, Danish, Czech or Indonesian. It includes imported preset names, shortcuts, voice tags, known application-owned billing/activity labels, public feature/pricing descriptions, page guides, editor controls and accessibility templates. The remaining 15 locales each still have 3,094 broader key gaps in the integrated catalogs at this checkpoint; their supplements are in progress and are not counted until completed and connected. A separate list of 109 dynamic bindings remains classified by origin, including API errors and user/generated content. Key coverage is not a claim that arbitrary upstream text has been translated. User filenames, captions, prompts and model output are not silently translated. `node scripts/localization-audit.mjs --output <path>` reports exact gaps rather than counting English fallbacks as translations.

Calendar headings, weekdays and dates follow the interface locale. Analytics date labels update with the selected language; referral, feedback, generation, diagnostics and publishing dates/numbers use that same locale. Billing periods, plan details, credit-guide labels, Library controls, origin badges and publication statuses use translated copy. Existing Italian public-page, pricing and guide text is preserved while other languages share canonical UI keys. A mistaken Italian allowance label that described 1K-resolution images as thousands of images was corrected; a regression now preserves the resolution unit. Plan-card headings and descriptions have aligned spacing. Weekly review recommendations link directly to the appropriate action page with visible hover and keyboard focus feedback.

A bounded offline M2M100 trial used ten public UI phrases in three languages and no paid API. It failed meaning and placeholder checks, so none of its output entered the catalogs and no bulk job was started. Supplemental catalogs are manually authored and checked for interpolation, links and markup integrity.

## Validation

- Full suite: **887 tests passed across 113 files** at the source-origin integration checkpoint; subsequent focused checks cover the final guide/template/date localization refinements.
- Latest localization and functional checks: **41 tests passed across three files**, including per-language catalog integrity, preserved user content, resolution units, selected-file validation and analytics. Earlier follow-up checks also covered generated-file recovery and editor regressions. Catalog integrity is split by language so a larger combined catalog does not share one short test timeout.
- Czech/Indonesian follow-up: all **33 catalog tests** passed after integration, along with app/Node TypeScript and focused lint. Parenthesized display-condition branches are included in the static audit; the live billing fallback uses an existing translated label.
- App/Node and Worker TypeScript, ESLint, app build and Worker build passed.
- Isolated 390 × 844 frame layout review covered 20 routes. Content widths fit the 380-pixel area after correcting Prompt Director. This is responsive layout verification with synthetic data, not a live delivery/generation test.
- Analyzer CUA checks covered actual source seeking, channel visibility, thresholds, tabs, legacy incomplete reports, missing clarity and English/German/Greek narrow layouts. Four rendering regressions cover incomplete-score and role behavior.
- No paid generation or external load-testing calls were made.
- The official client releases `19e963b72c041481de27a96a99ef71153afefb1e`, `2a6acc0a71c308b1c83479baa9852218e705b880` and `d5528840cef3e43b3dc446a1b90d03f9dd558b50` were confirmed successful on both Vercel projects. Live checks confirmed the simplified publishing composer, English-default audience selector, hidden Media count, outline brain icon, removed coaching/status panels, working status-to-account setup navigation, weekly recommendation links, aligned plan cards, expanded guide copy and localized ledger descriptions. Czech, Indonesian and the final billing fallback form the next release; they must not be described as live based on the earlier deployment status.

## Release boundaries

GitHub publication deploys the official Vercel client. The existing Sites Worker, D1 and R2 are a separate release target. Native Sites publishing tools have not been available in this session despite the user's authorization; a GitHub token does not provide that Sites write credential. The new client refuses to buy an old/incomplete analyzer response until the backend advertises `video-analysis-v2`.

The earlier capacity and audio evidence remains in [SCALE_AUDIO_REVIEW_2026-10-15.md](SCALE_AUDIO_REVIEW_2026-10-15.md). The isolated 100,000-account test does not establish 100,000 concurrent production users or overcome free-tier service limits. Existing saved audio comparisons are not a controlled same-script listening test and establish no provider quality winner.

## Requested compliance UI removal

The large status control panel and repetitive explanatory banners are not themselves required by Article 50. Applicable underlying obligations can still include machine-readable marking and audience disclosure for qualifying synthetic/deepfake content; removing a dashboard panel does not remove those duties. The publisher keeps relevant provenance behavior while simplifying the user flow. Primary references: [European Commission Article 50](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50), [Commission transparency FAQ](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act).

Research principles used by the rubric: [Lang, 2000](https://doi.org/10.1111/j.1460-2466.2000.tb02833.x), [Sweller, 1988](https://doi.org/10.1207/s15516709cog1202_4). Neither validates the numerical product weighting or a neural reading from video alone. OpenRouter search integration follows its [official server-tool documentation](https://openrouter.ai/docs/guides/features/server-tools/web-search).
