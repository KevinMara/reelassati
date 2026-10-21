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
