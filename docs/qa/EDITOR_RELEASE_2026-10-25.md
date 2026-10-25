# Editor release verification — 25 October 2026

This records the current working tree on `codex/complete-platform-goals`, based on commit `79e39e7`. The release is still uncommitted and unpublished. Check results below belong to the stated source snapshots; they do not establish that the final commit or production deployment has passed. Work is bounded to the active foreground request under [the manual-only policy](MANUAL_ONLY_2026-10-21.md).

## Implemented source

- **Editing models:** the auto-edit API accepts exactly `moonshotai/kimi-k3` and `moonshotai/kimi-k3.1-pro`. Editing bypasses subscription experiments and legacy text-model defaults. Maximum effort sends actual `reasoning.effort: high`; balanced sends `low`. K3 requests select the Moonshot provider with required parameters and no provider fallback. The edit-plan reservation remains five application credits. Optional stock refinement can produce a second provider invocation inside that reservation; five credits is not a claim of one provider call or zero upstream cost.
- **Licensed stock:** explicit stock opt-in permits at most two visual searches, six candidate items and one same-model foreground refinement. Commons supplies images/video; Openverse supplies audio in the stock browser. Import accepts an opaque provider ID, resolves current license and metadata again, then checks exact public CDN paths, MIME, bounded responses and every redirect. It rejects restricted/inconsistent licenses and missing required creators. Downloaded files go to the existing R2 binding. Full source/license/creator/attribution metadata is stored atomically with the asset in `asset_stock_metadata`, restored on reload and protected by owner/brand scope. Failed metadata insertion rolls back the asset and removes its uploaded object. Export credit text deduplicates used media.
- **Free audio:** the active catalog contains **40 items: 35 effects and five music tracks**, including eight original CC0 uiSFX Zen MP3s. The historical Cinematic Percussion file remains bundled but is not an active catalog entry. Catalog audio uses existing assets rather than generated sound. `sound` operations are accepted in local-only plans. Ranged `sound` and `broll` operations must fit fully inside the selected interval, preserving their source clock.
- **Local speech:** a pinned timestamp-capable Whisper base ONNX model runs in a caller-owned browser worker, with no paid fallback. Source-language detection uses one bounded local language-token pass when a language is not specified. Ten-minute source/runtime limits, Stop and page-close cancellation terminate owned inference. Measured short word intervals are preserved. Ambiguous adjacent tokens remain one timed group rather than receiving fabricated internal boundaries. The server rejects malformed, incomplete, unordered or out-of-source timing before signing it, and records provenance explicitly as client-reported local execution.
- **Reusable 3D:** Microsoft Avocado and Water Bottle GLBs are bundled from a pinned official Khronos revision, with CC0 notices, original previews and SHA-256 checks. The existing composer loads them only after selection, previews actual geometry/textures, and saves a posed transparent PNG through the Library workflow. The eight picker/error labels have all 28 interface locales. Sources and hashes are in [the model notices](../../public/shared-assets/models/khronos/SOURCES.md).
- **Fonts:** the existing bundled DejaVu Sans caption font, license and matching layout metrics remain the supported preview/export path. This release does not claim a new font-provider integration or an expanded font picker.
- **Editor integration:** the dirty tree also contains the revised project/media organization, style controls, resizable workspace, timeline sections, stock browser and chat targets. Recent fixes keep popovers mounted during input and replace a prior selected-clip chat target with the exact attached timeline range. A transparent-PNG upload fix removes the mistaken use of the upload API's fourth argument as an arbitrary render-project identifier.

## Verification evidence

| Scope | Result and boundary |
| --- | --- |
| Full deterministic suite | **1,193 tests across 135 files passed**, before the latest popup, PNG-upload and language-detection additions. A final frozen-tree run is still required. |
| Backend/stock/model/local transcript | **53 tests across four files passed**: `sites/server.integrity.test.ts`, `sites/stock-media.test.ts`, `contracts/edit-model.test.ts`, `contracts/local-transcript.test.ts`. Covers rollback, durable attribution, forged client metadata, brand isolation, real short timing, rejected malformed timing, source-clock containment and the exact Pro/high/no-fallback request. |
| Local speech | **42 focused tests passed**, with strict production speech type checks. Actual browser execution returned 13 Italian segments with measured word groups and zero app credits. Recognition errors remain possible and require manual review. |
| Bundled 3D | **28 tests across three files passed**: catalog binaries/hashes/licenses, production GLB validation and composer rendering/disabled controls. Composer checks passed again after static translated labels were added. |
| Types, lint and builds | Frozen release source passed full app/Node/Worker type checks, full ESLint and complete client/server production build. Build finished at approximately 17:32 UTC. |
| Localization | Final strict audit passed: **3,450 static keys**, zero missing/raw audited copy across all 28 locales; static and lazy-loaded catalogs checked, including all nine color labels. |

The tests use deterministic fixtures/mocks where appropriate. They establish neither production provider availability nor the editorial quality of a live K3/Pro response. This review performed no paid provider calls, publication, schedule changes or deployments.

## Browser evidence and remaining checks

The coordinating foreground browser review confirmed an exact **2.5–5.2 second** chat range replacing the previous clip target, stable popup mounting/focus, and a URL popover retaining its focused input. Avocado loaded real WebGL geometry (**682 triangles, three embedded textures**), and transparent-PNG upload reached **“Posa salvata”** after the upload fix.

Both model poses subsequently saved successfully and appeared as PNG images in the Library after a fresh workspace reload. Water Bottle rendered 4,510 triangles and four embedded textures. Track volume saved at 99%; Undo restored 100%. Color presets updated the live preview filter, saved and reverted through Undo. Keyboard panel resizing, media collapse and fullscreen preview passed. Actual Italian local transcription completed with 13 timed caption segments and zero app credits. A simultaneous second editing tab correctly produced a workspace conflict instead of overwriting newer assets; the refreshed single-session save passed.

Still pending at this report snapshot: transparent PNG placement and actual video export; responsive mobile viewport verification (the browser override did not change the observed 1,500-pixel viewport); final production console/network checks; and production client/Worker smoke checks. These are explicit verification gaps, not inferred failures. The subagent's separate CUA surface was unavailable, so no independent visual pass is claimed.

## Existing CI and publication path

`.github/workflows/quality.yml` runs on pull requests, pushes to `main`, and explicit manual dispatch. **Pushing the feature branch alone does not trigger it unless a PR exists.** It uses pinned actions, read-only repository permission, no persisted Git credentials, Node 24, pnpm 10, locked dependencies and FFmpeg/DejaVu packages. It does not call model providers or deploy the application.

The exact local/CI verification commands are:

```sh
pnpm install --frozen-lockfile
pnpm run check
pnpm run check:localization
pnpm run lint
pnpm run build
pnpm exec vitest run --pool=threads --maxWorkers=1 --testTimeout=30000 --hookTimeout=30000
```

After the source is frozen, reviewed and committed, the existing branch can be pushed with `git push -u origin codex/complete-platform-goals`. Open/update its PR and check the quality run for that exact commit. On a host with authenticated GitHub CLI, the relevant commands are:

```sh
gh pr view codex/complete-platform-goals --repo KevinMara/reelassati --json number,url,headRefOid,statusCheckRollup
gh run list --repo KevinMara/reelassati --workflow quality.yml --branch codex/complete-platform-goals --limit 5
gh workflow run quality.yml --repo KevinMara/reelassati --ref codex/complete-platform-goals
```

The last command is an optional deterministic CI dispatch when no matching run exists; it is not a model job. The local host currently has no `gh` executable, so these were not executed here. The existing GitHub connector/browser is an alternative. No branch protection, CI status or live integration setting was changed or assumed verified by this review.

A fallback Node helper is prepared locally at `verification-assets/editor-release-github-2026-10-25.mjs` (ignored by `.git/info/exclude`). It reads the existing GCM credential into process memory, sends it only to the fixed GitHub API origin, suppresses credential-bearing diagnostics, rejects redirects, and neither writes nor prints the token. It accepts only this repository, branch and reviewed quality-workflow blob. Syntax checking and **11 mocked regression tests passed**, including wrong-SHA rejection, no duplicate dispatch, PR reuse, credential-error suppression and response bounds. Preparation did not retrieve a credential or execute a remote mutation.

```powershell
$releaseSha = (git rev-parse HEAD).Trim()
node verification-assets/editor-release-github-2026-10-25.mjs status --sha $releaseSha
node verification-assets/editor-release-github-2026-10-25.mjs dispatch --sha $releaseSha
# Execute only the reviewed dispatch if no exact-SHA run already exists:
node verification-assets/editor-release-github-2026-10-25.mjs dispatch --sha $releaseSha --execute
# Run status manually when needed; the helper never polls or retries:
node verification-assets/editor-release-github-2026-10-25.mjs status --sha $releaseSha
# Optional: create or reuse a draft PR, after reviewing its local Markdown body:
node verification-assets/editor-release-github-2026-10-25.mjs pr --sha $releaseSha --title "Complete editor workflow and free media resources" --body-file verification-assets/editor-release-pr-body-2026-10-25.md
node verification-assets/editor-release-github-2026-10-25.mjs pr --sha $releaseSha --title "Complete editor workflow and free media resources" --body-file verification-assets/editor-release-pr-body-2026-10-25.md --execute
```

Dispatch/PR commands require clean committed source and the exact pushed branch SHA. Without `--execute` they only preview their request after read-only checks. Existing runs/PRs are reused; token-free mutation receipts prevent duplicate submissions after uncertain outcomes. A dispatch response is checked against its actual run SHA because GitHub accepts a branch reference, which can move. Status exits 0 only for a successful latest exact-SHA quality run, 2 when not yet successful, and 1 on errors. After any created PR, attach the returned PR URL to the active Codex task. The native GitHub commit-run tool currently filters to PR events and has no dispatch counterpart; the helper covers manual runs using the [workflow REST API](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event) and [exact-SHA run filtering](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow).

The established release path merges the verified PR to `main` for the existing GitHub/Vercel integration. `vercel.json` runs `npm run build:client`, publishes `dist/client`, and has **no crons**. Check Vercel success and the served client for the same SHA independently of GitHub quality. The workflow does not itself gate or perform Vercel deployment.

The API is a **separate Sites Worker release**. `src/lib/runtime.ts` defaults official-client API traffic to `https://reelassati.kevinbiz.chatgpt.site`. `.openai/hosting.json` identifies the existing Sites project `appgprj_6a5bd4f335cc81918891aeec6f2155da` with `DB` and `BUCKET`. Publish the same source through that existing Sites connection and verify its terminal deployment status/bindings before testing the new endpoints. There is no repository `deploy` script or local `.vercel/project.json`; do not invent a CLI deployment path or substitute a client build for Worker publication. The maintenance workflow is not a deployment mechanism and must remain disabled as recorded in the manual-only policy.

Historical ignored release helpers published a reviewed commit by ordinary `git push origin <full-SHA>:refs/heads/main`, which preserves the exact commit and triggers the existing integration. This is a possible final release step only after the same backend source is deployed, exact-SHA CI passes, and the current main branch can fast-forward to that commit under repository rules. Verify with `git fetch origin main` and `git merge-base --is-ancestor origin/main <full-SHA>` first; a nonzero result or protected-branch rejection is a blocker, never a reason to force-push. A PR merge can produce a different commit SHA; recheck the resulting source and deployment identity in that case. The new helper deliberately has no push/merge/deploy mode. Earlier Vercel evidence came from GitHub commit statuses; no current Vercel CLI credential or project link was established.

## Planned production comparison

Once both deployments are verified, run the explicitly requested **two foreground edit-and-render comparisons**, using the same approved source, brief, transcript/analysis evidence, style, resource options and generation budget in separate project copies: one exact K3 run and one exact K3.1 Pro run, both at maximum/high effort. Reuse valid preparation evidence; do not silently add paid generation or repeat analysis.

Record source/project IDs, exact client/Worker release identifiers, actual provider/model/effort, invocation IDs, reservation/debit/release outcomes, latency, selected operations and final exported files. Stock refinement may make two provider calls per edit; record actual calls rather than describing this as exactly two inferences. Two successful plan reservations total ten application credits; any separately authorized preparation/generation expense must be recorded separately.

Watch both actual exports for complete words, captions, readable graphics, stock relevance/credits, original-source continuity, sound levels and a justified ending. Compare observed results without declaring a model winner beforehand. Stop after the two completed comparisons or an actionable failure; no unattended retries, provider substitutions or continuation is part of this plan.

## Execution review after publication

The initial release and its sound-source safety repair reached both public hosts at commit `7c672761c7307ff0518e7fd14a0cc54130275098`, with successful exact-commit CI. Sites version 125 preserved the existing project, environment revision 16, `DB` and `BUCKET`. Both successful comparison plans used this same published client and planner, immutable asset `12e6898c-8034-4c7b-a374-370ae04f6d07`, blank brief, no template/reference, maximum/high effort, zero allowed generated images and one allowed generated video within 200 optional credits. Neither plan requested paid supporting media.

| Invocation | App credits | Actual provider charge | Result |
| --- | ---: | ---: | --- |
| K3 first attempt | 5 | $0.083124 | Plan returned; preflight rejected a sound longer than its source. No timeline mutation or generated media. |
| K3 completed plan | 5 | $0.086418 | Three tier overlays, a contextual note, quiet music/cues, grade and one 0.6-second gap cut. |
| K3.1 Pro completed plan | 5 | $0.077370 | Two overlays and one quiet outro cue; preserved source timing. |

OpenRouter recorded Moonshot AI with canonical models `moonshotai/kimi-k3-20260715` and `moonshotai/kimi-k3.1-pro-20261023`. The charges above are separate provider accounting, not a dollar conversion or additional debit of the displayed app credits. Failed-attempt expense is retained separately; no refund or credit grant was made.

The actual first K3 MP4 exposed two independent timing defects. Sound inserted after a ripple cut retained the old ending, adding 0.599292 seconds without picture. Separately, this source contains video through 28.233333 seconds but audio/container through 28.350708 seconds. Its last decoded frame starts at 28.2 seconds. The first export consequently measured 0.7 seconds of black at the end. The saved K3 edit was repaired through ordinary manual controls, without a new paid plan: split/re-align the music around the existing cut and set the timeline end to 27.6 seconds (source 28.2). Its new 720×1280, 30 fps H.264/AAC MP4 is exactly 27.6 seconds and has no detected black run of at least 50 ms. Pro receives the same source endpoint correction at 28.2 seconds. Final files, hashes, provider receipts and comparison observations are recorded with the foreground verification artifacts, rather than inferred from the planning response.

The subsequent implementation repair stages new sound on the original clock before structural cuts, so the existing ripple logic preserves surviving samples, source offsets and fades. A final audit rejects loss of every effective picture when new music would otherwise conceal it; replacement visuals and existing audio-only projects remain supported. **142 related tests passed**, with scoped lint and independent Astra review.

Rendering now probes fresh stream metadata and decoded terminal frames. Only a verified audio/video tail mismatch of at most 250 ms permits a last-frame hold inside the declared clip, followed by exact-duration trimming before fades and animation. It never extends the clip, project or inter-clip gaps; the overlay EOF policy remains pass-through. **11 new probe/native/WASM tests and four existing render-plan tests passed**, including non-aligned slow-speed trims, complete terminal audio, fades and gaps. Full application/Node/Worker type checking passed after the final source changes.

Actual frame review also found weak contrast in K3's overlays, including nearly invisible text on the white end card. The planner chose `kind=text`, whose background is transparent even when a background field or statistic composition is supplied. This is an editorial/model limitation in the comparison, not proven preview/export divergence. The shared planner guidance now explicitly distinguishes transparent text from filled callouts and requires readable foreground and secondary copy against the observed footage. This guidance change follows both comparison plans; their design choices were not manually improved to manufacture a winner. Audio levels and source continuity were measured, but no claim of listening or clinical verification is made.
