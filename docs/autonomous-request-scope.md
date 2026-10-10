# Autonomous request ownership and cancellation

The autonomous editor captures its owner email, selected brand, and project before its first asynchronous step. It captures one authenticated request scope and uses that scope for footage analysis, temporary speech uploads, transcription, edit planning, supporting image/video generation, and video result polling. Each transport checks the current authenticated owner and selected brand immediately before sending, after a token refresh, and after reading the response.

The component checks that its original workspace/project still exists before each new step and inside workspace mutations. Changing owner, brand, or project, unmounting, or pressing Stop aborts its request signal. A canceled or stale operation cannot schedule a subsequent generation or apply its output to another workspace. The final timeline mutation also retains its existing clip/transcript concurrency check and Undo revisions.

Cancellation cannot undo work that the server/provider already accepted or reverse its charge. The stop message states this explicitly; if the final timeline save already started, it asks the user to review the project and use Undo if needed. Completed provider assets remain available from the original account's Library.

Verified locally with mocked provider transport only: delayed authentication returning a different account blocks planning, image generation, video generation, transcription, and polling before fetch; brand switches and canceled signals block the same methods; cancellation while planning returns prevents the following supporting generation; a 401 token refresh into another account cannot retry the planning request. Destination checks cover owner, brand, project selection, deletion, and cancellation. No production provider requests, credit debits, or purchases were performed for these checks.

Validation: `vitest run src/lib/autonomous-run.test.ts src/lib/platform-api.test.ts` — 35 tests passed. App TypeScript and targeted ESLint also passed.
