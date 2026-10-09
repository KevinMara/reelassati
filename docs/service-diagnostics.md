# Owner service checks

Settings → Capabilities exposes a manual **Check connections** action to the configured studio operator only. `POST /api/operations/services` requires the authenticated email to match `COMPLIANCE_OPERATOR_OWNER_EMAIL`; missing owner configuration and other users receive 403, anonymous callers receive 401, and owner GET requests receive 405. Responses use `Cache-Control: no-store`.

The server calls only OpenRouter's read-only `GET https://openrouter.ai/api/v1/key`, with a ten-second timeout, redirects disabled, and a maximum response size of 16 KiB. It returns a fixed status and explanation. It does not return provider key labels, IDs, usage, limits, error messages, or credentials. OpenRouter's documented `data.limit_remaining` is either a finite number or null; a nonpositive number means the configured key allowance is exhausted. A successful key check does not establish account funding, model availability, or a successful generation.

Official endpoint documentation: https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key

Sound effects receive a configuration check only: `ELEVENLABS_API_KEY` must be nonempty after trimming, `ELEVENLABS_COMMERCIAL_ENABLED` must equal `true`, and `ELEVENLABS_SFX_USD_PER_SECOND` must represent the actual finite positive account cost per generated second. No ElevenLabs request is made. Present settings do not establish account eligibility or successful generation.

The connection check creates no media, writes no generation or credit ledger records, and does not spend REELassati credits. Separate real edit or generation QA is required to verify provider output.
