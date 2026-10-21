# Video analyzer — selected Kimi K3 route

Kevin reported the analyzer's generic failure for `Leo Arden_3s4.mp4` and reaffirmed that the intended analysis model is Kimi K3. The deployed source defaulted explicitly to Gemini 2.5 Flash in three places: video analysis, image-referenced editor chat and its existing shape-repair request. These routes bypassed the default text route and the isolated Kimi Code experiment.

OpenRouter's read-only upstream log showed a fresh Gemini HTTP 400 on 21 October at approximately 13:32 UTC / 15:32 Europe/Rome, one attempt, 3.4 seconds, generation ID `gen-1792589534-owYBdIRU04k1dUotI8Lu`. The UI did not expose the detailed provider error body. This establishes the model-selection mismatch; it does not establish which request field Gemini rejected. The approved five-minute read-only diagnostic delegation was not sent after Kevin's model correction made the selected route the primary repair. No other chat was started for that unused exception.

## Change

The three visual-review paths share the selected default `moonshotai/kimi-k3` through the existing OpenRouter service. An explicit `OPENROUTER_ANALYSIS_MODEL` remains the server-side deployment setting; the environment example and provider register now name K3. There is no automatic alternate-model fallback. The owner-only direct Kimi Code text experiment remains isolated. Its `k3-256k` model is not used for video: Kimi documents native video for `k3`, while `k3-256k` supports images only.

The model receives the same owned, full-duration native video content, requested language, strict response schema and measured output-token bound. Existing server checks still require complete source coverage, all four evidenced channels, story roles and valid reviewable edits before settling a reservation. Rejections, incomplete reports and invalid plans release the reservation without an automatic second provider request. Credit pricing and manual-only operation remain unchanged. Automatic research and scheduled generation recovery stay disabled.

The analyzer now retains its `PlatformApiError` rather than discarding the structured status/reference. The alert displays HTTP status and the safe support reference. Selecting a different source clears a stale failure. It does not display raw provider bodies or credentials.

## Evidence and verification boundary

On 21 October, the free OpenRouter model catalog advertised `moonshotai/kimi-k3` with text/image/video input and structured outputs. Its endpoint catalog includes providers supporting `response_format`, `structured_outputs` and the existing request's output-token limits. These are capability records, not a successful paid response.

- Kimi model capabilities: <https://www.kimi.com/code/docs/en/kimi-code/models.html>
- Kimi native video example: <https://www.kimi.com/code/docs/en/third-party-tools/hermes.html>
- OpenRouter model catalog: <https://openrouter.ai/api/v1/models>
- OpenRouter K3 endpoints: <https://openrouter.ai/api/v1/models/moonshotai/kimi-k3/endpoints>

Worker integration tests inspect the actual outgoing K3 model/native video/strict-schema request, one provider request, actual D1 invocation provenance and credit settlement. Rejection tests verify one request, safe diagnostics and full credit release. Tests use simulated providers and no live inference. A source push publishes the GitHub/Vercel frontend; this Worker requires its own Sites deployment. Live analyzer success remains unverified until the selected route is deployed and a separately authorized visible analysis completes.

Local verification passed 98 tests across the Worker editor/analyzer integration, server, analysis schema, API client and manual-only background suites. TypeScript, changed-source ESLint, the strict 28-language localization audit and the production client/server build passed.

## Foreground lifecycle and authorized credit release

Sites version 115 deployed the K3 routing source `fe39f9345f4865e21fe447e9dfb292f1ac236f89`. Kevin authorized one visible paid test. It reached K3 through Decart once, recorded USD 0.0341649 upstream usage and ended without a delivered report. A subsequent bounded, read-only diagnostic turn found one matching analyzer Worker event with outcome `canceled`, 65,052 ms wall time and 253 ms CPU time. The retained log does not establish who canceled it or why. The invocation remained `in_progress`; its ten-credit ledger entry remained `reserved`.

Kevin then explicitly requested a fix and release of those exact ten credits, retaining K3, manual-only operation and no further paid tests. The repair:

- Uses a versioned foreground NDJSON response with an immediate pending frame, ten-second connection keepalive and a five-minute deadline. Only one terminal, validated JSON report or safe error is delivered. Partial reports and reasoning are never displayed or retained.
- Streams K3 through the existing OpenRouter connection, pinned to the documented cancellation-capable `fireworks` endpoint with provider fallback disabled. K3's catalog lists default reasoning effort `max` and supports `low`; the request now selects `low` within the existing total output-token bound so reasoning leaves room for the structured report. This is source configuration, not an account/model-setting change.
- Propagates abort signals to the provider reader/fetch. Cancel, page exit and transport failure send at most one authenticated, owner/brand-scoped cancellation request, which cannot initiate inference. A zero-value canceled entry prevents a late reservation. The active foreground response also checks its hold while sending keepalive frames and aborts if cancellation released it. Runtime tests showed that disconnect alone can end execution before cleanup; the explicit cancellation and overdue-hold reconciliation cover that boundary.
- Rejects old clients before charging. Request IDs plus a server-generated attempt claim prevent concurrent identical submits from sharing a charge while buying multiple provider calls. Another owner/brand cannot cancel the original hold.
- Restores only the explicitly authorized incident's ten original top-up credits when its exact ledger, operation, asset, timestamps, invocation, source hash, K3 model, owner and pending state all agree. It records the release reason and canceled Worker reference and marks the interrupted invocation failed in one D1 transaction. Repeated/concurrent reads cannot refund twice; settled or nonmatching records stay untouched.
- Reconciles only tagged, expired foreground analyzer holds on an authenticated billing-summary read, after a thirty-second cleanup grace period. This performs database bookkeeping only. It does not schedule, poll or resume model work outside an active request. No research, workflow, paused task, environment setting, resource, schema migration or dependency is re-enabled or changed.

Deterministic verification covers slow responses beyond the observed cancellation, fragmented Unicode/SSE, reasoning-only/truncated/error/length responses, client cancellation, actual SQL release/rollback, owner/brand isolation, early cancellation and duplicate submissions. The native Workers test uses an ephemeral local HTTP provider and proves its connection closes on cancellation with one synthetic request. It adds no external provider usage. No further paid test is authorized or performed; live paid report delivery remains an explicit verification limit.

Primary contracts checked on 21 October: [OpenRouter streaming/cancellation](https://openrouter.ai/docs/api_reference/streaming), [reasoning and output-token budgets](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens), [K3 model catalog](https://openrouter.ai/api/v1/models), [K3 endpoint catalog](https://openrouter.ai/api/v1/models/moonshotai/kimi-k3/endpoints), and [D1 transactional batches](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).
