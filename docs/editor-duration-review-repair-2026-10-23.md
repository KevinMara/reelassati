# Flexible edit duration and shared review repair

## Reported failure and retained evidence

The owner reported the AI editor's Review stage and the standalone Analyzer returning HTTP 422, `The video review was incomplete. No analysis credits were used.` Existing invocation records viewed read-only in Sites identify both recent failures as `analysis_missing-story-assessment`:

- `65c67f52-0315-4c5e-94b3-926d780d6e03`, created 2026-10-23 15:54:00.912 UTC, failed 15:55:22.982 UTC.
- `f957c06f-4ac0-475a-b575-e0a62aa0ce94`, created 2026-10-23 16:01:10.396 UTC, failed 16:02:22.539 UTC.

Both use Kimi K3. Raw rejected responses are not retained, so these records establish the rejection category, not the particular malformed or contradictory summary entry. The bounded log and database diagnostic chats stopped; the originating active chat retrieved the records through the existing database UI without inference or mutations.

## Resulting behavior

- AI auto-edit defaults to **No target duration**. A preferred minimum/maximum range accepts positive ordered decimal seconds. It is a content-aware preference, not a hard cutoff: never pad, repeat footage, cut speech or invent material to meet it. Invalid values block preparation before any paid action. Meaningful-ending detection remains independent. The same component serves reference-, template- and analyzer-initiated auto-edits. Script/experiment durations and provider-priced generation lengths remain separate controls.
- The five-function story summary is an index over the timestamped evidence. Preserve explicit uncertainty. If the provider's summary is omitted, duplicated or contradicts those observations, derive only supported functions from the observed roles and role reasons; leave unsupported/conflicting functions uncertain. Do not invent a missing hook, proof, payoff, CTA, interval or score. Development/demonstration can satisfy core, and resolution can satisfy payoff, consistently in validation and navigation.
- Actual incomplete coverage, unsupported channels, missing evidence and unsafe executable operations still fail and release the reservation. This repair does not turn a partial review into a complete score or bypass operation validation.
- Canonicalize at most one millisecond of source-end timestamp rounding for observed intervals, recommendations and proposed operations. Larger out-of-source values remain invalid, and missing content is never filled.
- Reuse a complete saved review only for the same immutable asset ID, platform, schema and source duration (one-millisecond precision tolerance), in the current private workspace. Validate evidence and the section index before reuse. The review quote uses the same eligibility. Snapshots do not grant credits or permission to run inference. Never match by filename alone.
- Retain an allowlisted failure reason and safe request reference in both interfaces. Rejections log only fixed reason/correlation/count/coverage metadata, never prompts, model outputs, source media or credentials. Unknown provider strings are not exposed as diagnostic details.
- New duration controls and rejection explanations are translated for all 28 interface languages. A derived uncertainty note is localized when displayed.

## Verification boundary

Deterministic Worker integration tests cover omitted, contradictory and uncertain summaries using one mocked provider response and the real reservation/settlement flow. Incomplete evidence and unsafe edit plans retain their existing release tests. Client tests cover allowlisted error details and zero automatic retries. Preparation tests prove that eligible saved reviews avoid another provider call while missing speech preparation remains separate. Duration tests cover no-target mode, decimals and invalid bounds before paid preparation. The actual editor component was inspected in an isolated browser fixture; no paid action was executed there.

The broad local run passed 1,119 of 1,121 tests; two unchanged media/hash checks exceeded their original timing limits under concurrent load. Both files then passed all ten tests in isolation with unchanged limits/assertions. A final focused run passed 183 tests, including the shared Worker/client contract and locale loading. Types, changed-source lint and strict localization checks passed.

No paid provider test, refund, credit grant, schedule, resource or account/model/environment change is authorized by this document. K3 and the permanent research shutdown remain intact. Publication and a new live auto-edit check require their separately authorized visible actions; deterministic tests do not establish completed-edit quality.
