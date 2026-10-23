# Manual-only AI operations — 21 October 2026

## Kevin's clarification — 23 October 2026

Kevin explicitly authorized agents/subagents and similar help during visible, active work, including recovery of unfinished editor work: “just nothing that drains my codex usage after we end this session-visible work.” Bounded subagent work within the active chat is therefore permitted. Explain its model allowance use, duration and stop condition; finish or stop every owned agent before the visible turn ends. No scheduled, detached or queued continuation is authorized. Paid provider tests still require separate explicit approval. The original shutdown requirements below remain in force for unattended work.

Kevin explicitly ordered permanent shutdown of scheduled AI trend research and similar unattended credit-consuming work. New work must occur only in the visible, active chat turn for the current request. Do not enable schedules, heartbeats, model watchdogs, queued continuations or old stopped work. A separate chat or model worker requires Kevin's specific current authorization after explaining model use, cost risk, duration and stop condition. These operating instructions are not a server-side billing cap or a guarantee against third-party faults.

## Permanent source changes

- `vercel.json` declares an empty cron list. The retired `/api/trends-weekly` function returns HTTP 410 without reading credentials or making a network request, including for an old authenticated cron request.
- The backend `/api/internal/trends/weekly` route returns HTTP 410 before authentication, database initialization or provider access. The automatic refresh implementation, its scheduler identities and system research owner are removed. Existing tokens cannot reactivate it.
- Maintenance cannot research trends or resume pending AI video generation. Its GitHub schedule is removed. The Worker scheduled handler retains only database credit-renewal bookkeeping, with no provider requests.
- Existing trend snapshots remain readable. Responses declare `automaticResearchEnabled: false` and no next refresh time. The interface reports that automatic research is disabled, with the same copy in all 28 supported interface languages. User-requested custom research remains an interactive action with the existing explicit price, reservation and refund controls.
- No runtime secrets, account settings, customer data, database migrations, dependencies or hosting resources are changed.

## Verified external state

The GitHub `Platform maintenance` workflow was disabled through the authenticated GitHub API, which returned `disabled_manually`. No running maintenance workflow required cancellation. Keep it disabled; this release does not re-enable it.

ChatGPT's Scheduled page was inspected while signed in. It showed no active section and four tasks under Paused: `Sincronizza costanti budget`, `Reelassati weekly operations review`, `Hermes Onboarding Guide` and `Estendi previsioni mensili`. They were already paused and were preserved. `Finish Facebook and TikTok` was listed under Completed. Screenshot evidence is retained locally in `verification-assets/schedules-paused-2026-10-21.png`.

The earlier, separately authorized deployment completed before the hold instruction reached it: Sites version 113, source `94eb1e77a17e6eef4fda939c8c29ef0eab5f5a30`, deployment `appgdep_6ad89b6b6c1c8191b5bd565ead1eba5e`, terminal status `succeeded`, environment revision 16. Its chat reported stopped and was independently observed idle. That release contains the prior editor/schema/diagnostics work, not this permanent shutdown.

## Validation and publication boundary

87 focused tests passed across actual Worker routes, authenticated maintenance, scheduled bookkeeping, the retired Vercel function and existing functional regressions. The new checks configure an otherwise usable provider key and an old scheduler token, and assert zero provider/network requests. The previous positive expectation for automatic cron research is replaced by the shutdown contract. A separate 43-test run passed the locale loader/catalog comparison, the background shutdown cases and Vercel support tests. Active types, the strict 28-language localization audit and the client/Worker build also passed during preparation; the final commit is validated again by its GitHub quality workflow.

The official website continues to deploy through GitHub/Vercel. Sites remains a separate backend release. A GitHub push alone does not publish the Worker. The current chat's native Sites, Vercel and Supabase inspection calls returned unavailable; do not interpret those failures as proof that no remote schedules exist. The permanent backend shutdown must be verified on a newly deployed Sites version, and the retired frontend endpoint must be checked after its GitHub deployment.

No live provider call, AI research, analysis, speech or generation is part of this verification. Successful publication and offline tests do not prove that auto-edit succeeds against the live provider; the historical HTTP 400's exact cause remains unconfirmed.
