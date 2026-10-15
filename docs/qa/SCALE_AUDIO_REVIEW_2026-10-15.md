# Capacity, existing audio, and video review — 14–15 October 2026

The user’s operating constraint is free verification and a long-term cost view.
No hosted load generator, paid upgrade, new audio generation, or paid analysis
was purchased for these checks. These checks did not debit account credits;
821 was the last independently verified balance. Local QA files and personal audio stay outside Git.

## What the capacity exercise establishes

`node scripts/scale-check.mjs` runs the actual application Worker in local
workerd, with real local D1/R2 bindings and external requests disabled. Synthetic
trusted gateway identities replace the hosting identity boundary; Supabase Auth,
distributed edge capacity, provider quotas, media traffic and browser rendering
are outside this measurement. This is **not certification of 100,000 concurrent
production users**.

Both runs seeded 100,000 workspaces, 500,000 asset metadata rows, 200,000 jobs,
100,000 credit accounts, 100,000 billing accounts, 100,000 brand rows and 300,000
ledger entries: 1.4 million rows. A workspace contains three synthetic script
drafts and 4,372 bytes before its owner identity is substituted. No media objects
were uploaded, rendered or generated in the capacity workload.

The baseline ran 300 requests at each concurrency of 1, 10, 50, 100 and 250,
then 5,000 mixed requests at concurrency 100. The mixed workload completed with
zero errors, 16.68 requests/s and 7,957 ms p95. The 250-concurrent burst had
23 local `fetch failed` transport errors; those are retained in the evidence.
Do not attribute those failures to a production D1 outage or quote these local
Windows transport timings as a Cloudflare production limit.

Brand navigation unnecessarily loaded a complete billing summary. Its endpoint
now checks subscription/workspace entitlement directly. Query count fell from
15 to 3 statements, an 80% reduction for that route. Active, expired and unpaid
plan behavior is covered by SQLite integration tests. Credit migrations, usage
aggregation and payment-provider readiness no longer run just to list brands.

The repeat ran the same concurrency ramp and 1,000 mixed requests at concurrency
10, with zero errors throughout. The mixed workload measured 18.43 requests/s,
745 ms p95. The comparable 300-request concurrency-10 phase measured 23.06
requests/s and 537 ms p95. Host activity and workload size differ: a causal
throughput improvement of a particular percentage is not established.

All sampled workspace responses preserved owner/asset/job separation. Twenty
simultaneous stale saves produced one successful save and nineteen 409 conflicts;
the winning revision persisted. A cross-owner brand request returned 404. The
four sampled workspace/asset/job/ledger query plans used indexes. External
network attempts were zero. The measured local database occupied **835,985,408
bytes**, including metadata and indexes.

Raw evidence is in ignored `verification-assets/scale-baseline.json` and
`verification-assets/scale-optimized.json`. The repeat began before the patch
commit, so its HEAD field still says `3f947780`; its Worker contained the brand
navigation patch subsequently committed as `2b76bf4`. It predates the later
analyzer/UI changes. Baseline source was `3f947780`.

## Free operation over the long term

The synthetic dataset already exceeds the documented 500 MB limit of one D1
Free database. D1 Free also has daily allowances of 5 million rows read and
100,000 rows written. Indexed writes count additional index rows. Cloudflare
documents a single database as processing queries serially; loading a large
number of account records alone does not prove concurrent serving capacity.
See [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) and
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

Supabase documents 50,000 monthly active users on Free. Thus 100,000 registered
accounts and 100,000 monthly active accounts are different operating scenarios.
See [Supabase allowances](https://supabase.com/docs/guides/platform/billing-on-supabase).
These are vendor plan limits, not a statement of which plan Sites runs internally.

Keep client-side editing/export and reusable CC0 library assets as the free core.
Avoid unnecessary billing queries and provider calls from routine navigation.
Track active accounts, database bytes, rows read/written, media operations and
provider spend separately before expanding cloud entitlements. Do not fund an
unbounded free cloud-media tier from a nominal per-credit inference margin.
Strictly free operation at 100,000 active users is not demonstrated by this test;
no paid plan or alternate infrastructure was enabled.

## Existing audio comparison

Offline FFmpeg decoding, native-channel float samples, EBU-style loudness
measurement and an already-installed, cached Whisper base model were used.
`scripts/audio-quality-check.py` reproduces the signal/ASR checks without a
hosted AI call. Gain-matched voice listening copies target about −20 LUFS and
preserve dynamic range; both are rendered to 44.1 kHz mono PCM for playback.
Upsampling the older file does not add original detail.

| Existing output | Decoded duration | Native encoding | Integrated loudness | True peak | Clipped samples |
| --- | ---: | --- | ---: | ---: | ---: |
| Verified bilingual Sarah voice | 8.08 s | 44.1 kHz mono MP3 | −18.88 LUFS | −1.14 dBTP | 0 |
| Earlier editor voice | 1.46 s | 32 kHz mono MP3 | −21.10 LUFS | −7.72 dBTP | 0 |
| Generated click/whoosh take | 5.00 s | 44.1 kHz stereo MP3 | −34.66 LUFS | −11.65 dBTP | 0 |
| Included Crisp Click | 0.097 s | 44.1 kHz mono MP3 | Too short to establish | −1.23 dBTP | 0 |
| Included Quick Swish | 0.600 s | 48 kHz stereo MP3 | −13.75 LUFS | −1.39 dBTP | 0 |

Both voices decode cleanly. The newer voice is 2.22 LU louder; that alone is not
a quality advantage. Local transcription recovered the complete Italian/English
copy with `realissati` for the brand name. The earlier hosted transcription used
`Rilassati`. This supports reviewing brand pronunciation/spelling, not concluding
that the synthesis definitively mispronounces it. The older clip transcribed as
“Hello guys!”; its provider/model has not been independently established.

The generated SFX is mostly quiet: 14% of 20 ms windows exceed −50 dBFS, with a
1.4 s quiet tail. Its low whole-file RMS should not be interpreted as noise or
voice quality. The short CC0 click/swish are practical reusable alternatives
when timing and no generation expense matter. Private imported SFX were not
republished or added to the shared catalog.

Scripts and content differ, so these outputs do not establish a controlled
same-text provider ranking, subjective MOS, or a model winner. Native-channel
SFX measurements here differ from the earlier mono-downmix preliminary check.

## Analyzer and shared UI change record

User authorization: remove the analyzer notice and repeated rights checkbox;
adopt the supplied review-workspace references and improve selectors/player
proportions across the platform. The new review workspace synchronizes source
playback, interval navigation, four editorial traces, threshold markers, and
visual/audio evidence with strengths, improvements and rationale. Hook, core,
proof, payoff, CTA and other roles come from observed intervals; missing roles
are not invented. Legacy retention reports remain readable with only their
supported attention trace. Missing channel scores and coverage gaps stay empty.

The model receives the complete owned original video or a full-duration 8 fps
proxy with its available complete audio. The provider controls internal frame
sampling. This is not a claim that the model inspects every original frame.
Google documents provider video processing/sampling in its
[video understanding guide](https://ai.google.dev/gemini-api/docs/video-understanding).

The rubric distinguishes content intensity, competing information and clarity;
it uses [Lang’s limited-capacity message-processing framework](https://doi.org/10.1111/j.1460-2466.2000.tb02833.x)
as research context. Applying that framework to this editorial rubric is an
engineering inference. No EEG, measured brain-region activation, dopamine,
audience retention probability, validated lift, proprietary study corpus, or
hundreds of thousands of reviewed studies are claimed. Proposed edits remain
reviewable operations; original footage is not relabeled as a rendered rewrite.

Twenty source files now use shared keyboard-accessible selectors. The shared
menu, popover and dialog primitives use viewport bounds, consistent spacing and
reduced-motion handling. A shared audio player exposes the real media clock,
seek, mute and download controls. A token bug was fixed globally: applying an
opacity modifier to an already alpha-bearing border HSL value produced invalid
colors and bright inherited outlines. Light/dark edge channels now compose
opacity correctly.

Affected controls: SEC-001, PRV-001, EVD-001; relevant invariants INV-COMP-002,
INV-COMP-003 and INV-MODEL-002. The new server records `analysis.source-submitted`
for the authenticated Analyze action rather than manufacturing a checkbox
declaration. The client retains a legacy submission field for older backends
under accepted platform terms. That field is not ownership or consent proof.
The measured-price acceptance step, owned-asset boundary, full-duration proxy
validation, provider route, provenance and review-before-apply behavior remain
in force. No schema, hosted secret, policy version, tariff or public-launch
evidence status is migrated by this change. Formal legal approval is not implied.

Analysis output is bounded to at most 120 intervals, with a duration-dependent
token budget and a maximum of ten priority edit operations. Each interval has
an 80-word total target across its explanatory fields. This avoids an unbounded
JSON response while retaining timestamped observations; tariffs are unchanged.

## Additional publishing and navigation requests

The Media trigger no longer shows an asset count. The Weekly Review evidence
banner, redundant audience-metrics banner and large customer-facing compliance
control panel have been removed. Operational errors and actionable empty states
remain visible. Studio status cards now link to the matching workspace page and
provide hover, keyboard-focus and pressed feedback.

Publisher now provides a manual platform choice, connected destination account,
caption, hashtags, media, an English-default audience-language selector,
automatic/additional AI-origin labeling, source preview and date/time controls.
The release questionnaire and repeat confirmation checkbox are removed. Optional
AI assistance generates only the selected caption/hashtag fields, at the existing
five-credit text-generation tariff. It never selects a platform, account, asset
or publication time. Generation is canceled when the composer changes scope.
SQLite integration checks cover selected-field preservation, no-charge invalid
requests and refunds on empty output. These checks use a stubbed provider only.

The new automatic publication record is explicitly different from legacy human
declarations. It keeps realism, real-person depiction and public-interest status
unknown, and never claims documented consent, human review or rights verification.
Server-owned known AI origin forces a canonical visible label; clients cannot
remove it or supply replacement disclosure copy. Existing owned-asset access,
output-mark authentication and public-release readiness controls remain enforced.
The automatic composer is capability-gated until the matching backend is deployed,
so an older backend is not sent an unsupported publication request.

The large UI checklist is a product implementation, not itself a statutory
requirement. Applicable marking and audience-disclosure duties still matter;
see the [Commission's Article 50 guidance](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act).
This UI change does not certify compliance or assert completion of operator duties.

## Verification and release

Before the additional publishing requests, all 854 tests across 110 files passed,
along with application/Worker TypeScript, ESLint and production builds. After the
publishing changes, the focused suite passed 90 tests across four files. The final
full suite passed **859 tests across 111 files**. The production client build
and Worker bundle completed successfully. Existing large-chunk and mixed-import
warnings remain; no new dependency or infrastructure was added.

Release target: the existing KevinMara/reelassati GitHub repository and its
configured production deployment at reelassati.app. Sites retains its existing
project identity, database and bucket. At preparation time its publishing tools
were not callable in this chat, including after the user's Sites selection;
the mirror/backend deployment therefore must be confirmed separately. No Sites
publication or activation of the new backend is claimed from a GitHub push alone.

Browser checks exercised the actual shared selectors, source-time seeking,
evidence/improvement views, audio playback/download and the publisher form.
At 390 px width, analyzer/audio and publisher controls had no horizontal overflow.
The language menu defaults to English, supports keyboard selection, updates the
native form value and composer preview, and dismisses after selection. Downloaded
audio retains actual source bytes. QA fixture data remains isolated and ignored.

An analyzed video can create its edit project directly on the review page. The
paid result remains available for the existing source-time mapping/queue action,
without rerunning analysis merely to create a project. Queued edits link to the
exact owned project in Edit. New projects retain the complete original source
clock, and proposed operations still require review before acceptance.

The first official release was GitHub commit `4adc420`, confirmed successful by
both configured Vercel projects. Production browser review covered 21 desktop
routes and 20 mobile routes. At 390 px, long media/project titles exposed implicit
grid-track minimums in Library and saved Edit projects; those grids now use an
explicit single column and shrinkable cards/text. The other reviewed mobile
routes stayed within the viewport. The setup-card link was exercised and opened
Social Hub. This was read-only navigation, with no generation, analysis, social
posting, credit purchase or settings mutation.

Browser verification uses a clearly labeled, isolated interaction fixture with
the actual new components and an existing native-motion QA export. Fixture
scores are never inserted into the platform or presented as customer analysis.
The existing audio files are actual saved outputs. Live paid-model analysis
remains outside the free verification performed here.
