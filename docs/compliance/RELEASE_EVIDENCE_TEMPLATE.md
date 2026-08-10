# AI compliance release evidence record

Use one copy of this file for every deployment that changes an AI route,
generated output, provenance/export path, publication flow, legal disclosure,
operator fact, hosted compliance setting, or mapped control. Store completed
records under `docs/compliance/releases/` or in the approved evidence system.

This is an accountability record, not a certificate or legal opinion. A source
control is not “verified” merely because its checkbox is completed.

## 1. Release identity

- Evidence record ID:
- Product release / Sites version:
- Deployment ID and audience (`owner-only`, `restricted`, or `public`):
- Source commit SHA:
- Compliance policy version:
- Deployment time (UTC):
- Release owner:
- Engineering reviewer:
- Compliance/legal reviewer, if applicable:

## 2. Exact change scope

- User-facing change:
- AI/model/provider routes changed:
- Output types or export paths changed:
- Publication/disclosure paths changed:
- Persistence, provenance, detector, or signing changes:
- Hosted-variable names changed (never record secret values):
- Explicitly protected features confirmed unchanged:
  - Studio entry animation timing and theme variants;
  - Studio navigation order and grouping;
  - one drag/drop surface for every file input;
  - owner-only Kimi test isolation;
  - non-Kimi OpenRouter routes;
  - contextual, compact legal UX.

## 3. Applicable role and release facts

- Confirmed legal operator and legal form:
- Public operator contact:
- First EU placement / put-into-service date:
- Current release status:
- Intended use confirmed creative/marketing only:
- Provider/deployer/GPAI-role assessment changed? Why:
- High-risk or prohibited-practice classification reassessed:

## 4. Runtime route snapshot

For every model-backed capability, record the provider, route, model identifier
or alias, observed version limits, purpose, input/output modality, fallback,
test/official status, and observation time. Copy the sanitized deployed route
register; do not infer it from documentation defaults.

| Capability       | Provider / route | Model | Fallback | Test or official | Observed at | Evidence status |
| ---------------- | ---------------- | ----- | -------- | ---------------- | ----------- | --------------- |
| Default text     |                  |       |          |                  |             |                 |
| Video analysis   |                  |       |          |                  |             |                 |
| Transcription    |                  |       |          |                  |             |                 |
| Speech           |                  |       |          |                  |             |                 |
| Video generation |                  |       |          |                  |             |                 |
| Publishing       |                  |       |          |                  |             |                 |

## 5. Required verification evidence

- TypeScript result:
- Lint result:
- Unit/integration test count and result:
- Production build result:
- Migration-forward test result:
- Exact text generate → save → reload → export/copy → detect result:
- Exact MP3 generate → store → download → detect result:
- Exact MP4 generate → store → download → detect result:
- Altered/tampered/copied-token/cross-owner negatives:
- Signing-key rotation regression:
- Mark/storage failure leaves no releasable asset:
- Publication review/disclosure/idempotency tests:
- Kimi/OpenRouter route-isolation tests:
- Entry animation/navigation/drop-zone regressions:
- Rendered EN/IT desktop/mobile review:
- Accessibility review relevant to changed disclosure:
- Independent marking/detection evidence reference:
- Provider evidence packet reference:
- Incident/monitoring exercise reference:
- Other-law review reference:

## 6. Control disposition

List every affected stable ID from `CONTROL_MATRIX.md` and
`ARCHITECTURE_INVARIANTS.md`. `pending` or `gap` remains a blocker when the
matrix says it is a release gate.

| Control / invariant | Status | Evidence | Reviewer | Open action / owner / date |
| ------------------- | ------ | -------- | -------- | -------------------------- |
|                     |        |          |          |                            |

## 7. Open limitations and decision

- Unresolved legal/operator facts:
- Unverified provider or lifecycle evidence:
- Known false-positive/false-negative or transform limitations:
- Monitoring or incident-response gaps:
- Non-AI-law gaps:
- Allowed audience for this release:
- Public publishing enabled? If yes, exact evidence authorizing it:
- Release decision (`blocked`, `owner-only`, `restricted`, `public`):
- Decision rationale:

## 8. Post-deployment verification

- Authoritative deployment status and URL:
- Deployed environment revision:
- First-paint/entry animation verified:
- Sanitized runtime route register verified:
- Public publishing gate verified fail-closed or open with evidence:
- Provenance detector positive/negative smoke test:
- Worker error/log review (sanitized):
- Rollback target:
- Follow-up owner and due date:

## Sign-off

By signing, reviewers confirm only that the recorded checks and evidence were
examined for this scoped release. They do not claim EU certification, universal
interoperability, full legal compliance, or zero legal risk.

- Release owner / date:
- Engineering reviewer / date:
- Compliance/legal reviewer / date:
