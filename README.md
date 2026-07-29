# REELassati

REELassati is an editing-first workspace for professional short-form content.
It keeps manual timeline control and AI assistance in the same reviewable
project: upload footage, edit clips, inspect proposed changes, manage captions
and versions, direct generated shots, and prepare publication without hiding
the decisions from the creator.

## Product surfaces

- **Studio** — persistent projects, private uploads, four-track timeline,
  clip controls, transcript editing, reviewable AI edit plans, revisions, and
  structural preflight.
- **Prompt Director** — model-aware Kling v3 Standard prompts, duration and
  contradiction checks, async job polling, and generated-asset capture.
- **Script, Analyze, Voice, Interview** — Kimi-based creation and planning,
  OpenRouter video understanding, Whisper transcription, and MiniMax speech.
- **Library and Brand DNA** — durable media, scripts, motion/caption defaults,
  audience, and voice.
- **Publishing** — Zernio profile/account connection, scheduling, and
  provider-confirmed submissions, durable delivery intents, and lifecycle
  reconciliation back into the workspace.

The interface deliberately avoids fabricated analytics, follower counts,
testimonials, and “AI completed” states. When a provider is not configured, the
product reports the exact missing capability.

## Runtime architecture

- React 19, TypeScript, Vite, Tailwind, and Framer Motion.
- A Cloudflare-compatible Sites Worker in `sites/server.ts`.
- D1 for owner-scoped workspace documents, asset metadata, jobs, and publishing
  profiles. Workspace writes use compare-and-swap revisions so one browser
  cannot silently overwrite another.
- R2 for uploaded and generated media.
- The authenticated workspace owner is resolved server-side from
  `oai-authenticated-user-email`; browser-provided user IDs are never trusted.
- Provider keys remain server-only hosted variables.
- Video jobs are registered before provider submission, resume by stable
  request ID, and finalize into deterministic R2 keys under a D1 lease.
- Publishing uses a durable outbox plus Zernio's request identifier, preserves
  ambiguous submissions instead of retrying blindly, and refreshes scheduled,
  published, partial, and failed provider states.

The original Node/PostgreSQL API is retained as historical source while the
Sites deployment uses the Worker-native API. New product work should target
`sites/server.ts`, `contracts/workspace.ts`, and `src/lib/platform-api.ts`.

## Hosted variables

Required for AI creation:

```text
OPENROUTER_API_KEY
```

Required for social publishing:

```text
ZERNIO_API_KEY
```

Recommended webhook verification hardening:

```text
OPENROUTER_WEBHOOK_SECRET
```

Configure the same value in the OpenRouter workspace webhook settings. Video
callbacks are also bound to an installation-specific capability token; polling
remains the recovery path if a callback is delayed.

Optional model overrides:

```text
OPENROUTER_TEXT_MODEL
OPENROUTER_ANALYSIS_MODEL
OPENROUTER_STT_MODEL
OPENROUTER_TTS_MODEL
OPENROUTER_TTS_VOICE
OPENROUTER_VIDEO_MODEL
```

Never commit credentials. Keys found in old conversations should be rotated
before use.

## Persistence and recovery

- Workspace saves are owner-scoped, revisioned, and capped at 2 MB.
- The client queues saves, blocks mutation until the initial server load
  succeeds, and exposes retry, reload, and JSON backup controls after a
  conflict or connectivity failure.
- Uploads are owner-scoped, reject active markup, and are capped at 64 MB.
- AI analysis and transcription accept media up to 24 MB to stay inside edge
  runtime memory limits.
- Asset downloads use private cache headers, byte ranges, `nosniff`, and a
  sandbox content policy.

## Local development

```bash
pnpm install
pnpm dev
```

Quality gates:

```bash
pnpm check
pnpm lint
pnpm test
pnpm build
```

Generate the Sites/D1 migration after changing `db/sites-schema.ts`:

```bash
pnpm db:sites:generate
```

Generated migrations live in `drizzle/` and are packaged into
`dist/.openai/drizzle`.

## Rendering boundary

The hosted Studio produces a versioned edit brief and project timeline. It does
not pretend an edge Worker can perform a full FFmpeg render. Production MP4
composition should be connected to an isolated render worker or container that
accepts the validated project schema, reports progress, and stores the result in
R2.
