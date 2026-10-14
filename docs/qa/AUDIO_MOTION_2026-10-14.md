# Audio and browser motion verification — 14 October 2026

## Scope

Continue the latest accepted OpenRouter voice/SFX and native browser motion-kit
work. The source baseline is `e2ca9becdb2badc7349a98006787769b58e894a8`.
This change repairs client speech request identity and verification portability.
It does not introduce another model, change prices or require an Adobe worker.

## Live evidence

- Signed-in production custom SFX generation completed through the existing
  OpenRouter route. A five-second camera-click/whoosh test became a saved MP3,
  survived reopening the project and appeared in Library. The browser reported
  duration 5.0 seconds and media readiness 4. The displayed balance changed from
  832 to 825: seven credits, rather than the quoted 150-credit maximum hold.
- A native Brand reveal kit inserted two grouped editable layers in an isolated
  QA project. A four-second 720 × 1280, 30 fps MP4 completed in the actual browser
  exporter. Its result explicitly confirmed download-only delivery with no
  Library copy. It used no additional AI credits.
- The first standalone voice request returned `Failed to fetch`; the subsequent
  billing screen still showed 832 credits and no successful voice usage. That
  observation does not establish where the request failed or prove voice quality.
- After deploying the recovery fix, a new multilingual Sarah request succeeded
  and was saved to Library. The downloaded MP3 is 8.08 seconds, 44.1 kHz mono;
  full decoding passed with zero clipped samples (peak −1.15 dBFS).
- After the saved-duration fix, transcription activated and recognized the
  Italian and English speech. The brand was rendered as “Rilassati,” rather
  than its styled spelling. This is not a perfect-recognition or listening
  benchmark. Final balance: 821 credits, with verified ledger entries of seven
  for SFX, two for voice and two for transcription.
- Native browser media downloads succeeded after the initial media-download
  automation timed out. The SFX MP3 fully decodes to exactly five seconds,
  44.1 kHz stereo with zero clipped samples. The motion-kit MP4 fully decodes
  to four seconds of H.264/AAC at 720 × 1280 and 30 fps; its held frame visibly
  contains the requested wordmark and tagline. No independent listening
  audition is claimed.

## Speech recovery change

The standalone voice page now sends an immutable request ID and retains it,
including the reviewed tariff, after an interrupted response. A same-input
retry can recover the server's existing response instead of purchasing another
take. Inputs are pinned before asynchronous work; a synchronous guard prevents
overlapping submissions. The API checks the original owner/brand before sending
and after reading the response, and an unmounted page cannot save a late result.
Explicit validation or changed-quote rejections allow a corrected new request.
The editor's voice-generation queue also sends its existing generation record ID.

The live transcription follow-up exposed missing duration metadata on generated
speech assets. Their existing player now measures loaded audio metadata before
enabling the quote. Selecting a different saved asset clears the previous
measurement and remounts the player, preventing a stale duration quote.

Recovery identity is held by the mounted voice page; this is not a claim of
cross-navigation or cross-device recovery. Server idempotency and asset storage
continue to use their existing durable implementation.

## Verification

- Targeted client transport, paid voice/SFX Worker/SQLite, and sound-library
  checks: 44 tests pass, including lost-response replay and owner/brand changes.
- The earlier functional/path and compositor checks pass after replacing URL
  pathnames with Windows-safe file paths and setting an explicit output frame
  rate for the native/WASM logo fixture.
- The earlier broad run passed 839 tests but encountered timing failures and a
  worker-start timeout during a long host stall. All four affected or omitted
  suites passed separately: 31 tests. Do not report that interrupted run as an
  uninterrupted green full-suite run.
- The subsequent final run passed **850 tests across all 109 files**, using one
  threaded worker and 30-second default test/hook budgets. Duration: 185.57s.
- Application, active Node and Sites Worker TypeScript checks pass. Whole-repo
  lint passed before the speech patch; the changed files passed lint afterward.
- The final client/Worker production build passes. Existing large-chunk and
  mixed static/dynamic-import warnings remain.
- Both Vercel main and recovery reported successful production deployment for
  `8c627c9a9d53ee1416b1408289fce20592cd1957`; the live custom-domain voice and
  saved-audio transcription flows passed after that release. Sites publishing
  tools were unavailable to this chat; the separate Sites-hosted frontend
  mirror was not republished. Its existing backend was not changed.
- Sound-library probing has a 30-second budget because it launches native
  ffprobe repeatedly; it still verifies every file digest and declared duration.

## Change-review disposition

Affected controls: `SEC-001`, `PRV-001`, `EVD-001`; invariants
`INV-COMP-002` and `INV-COMP-003`. Authentication authority, consent, marking,
provenance, provider/model routing, billing tariffs and public-launch evidence
statuses are preserved. No schema, hosted secret, policy-version, publication,
entry-animation, navigation or account-permission changes are required.
Engineering review is limited to these client/request and test changes; no
independent legal approval or compliance certification is implied.

The $0.003 modeled delivery budget, 150% audio inference allowance, voice offer
expiry and existing subscription/top-up margin assumptions are unchanged.
100,000-user capacity and subjective audio quality remain unverified. Native
Adobe project execution remains outside the accepted browser-template path.
