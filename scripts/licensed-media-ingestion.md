# Licensed media ingestion

`licensed-media-index.py` is a local, deterministic preparation tool. It does
not call models, download assets, upload objects, change catalogs in the product,
or run after the current command ends. An inventory is not a playable catalog.

## Commands

```powershell
python -X utf8 scripts/licensed-media-index.py scan 'C:\media\pack.zip' --index 'C:\media\private\pack.json' --supplier 'Private supplier name' --rights-basis 'Recorded user authorization for platform usage'
python -X utf8 scripts/licensed-media-index.py probe 'C:\media\pack.zip' --index 'C:\media\private\pack.json' --entry 'Pack/SFX/Brush.wav'
python -X utf8 scripts/licensed-media-index.py stage 'C:\media\pack.zip' --index 'C:\media\private\pack.json' --entry 'Pack/SFX/Brush.wav' --output 'C:\media\staged\pack' --label 'Soft brush'
python -X utf8 scripts/licensed-media-index.py validate 'C:\media\staged\pack'
python -X utf8 -m unittest discover -s scripts/tests -p test_licensed_media_index.py -v
```

- `scan` reads the ZIP directory and hashes the archive. It inventories every
  non-metadata member, including unsupported editor templates; it extracts none.
- `probe` requires explicit member paths. One temporary file exists at a time.
  It verifies the archive digest, ZIP CRC, size and content digest, measures real
  streams with ffprobe, and decodes complete selected media with FFmpeg. A CUBE
  file is checked for its declared grid, exact sample count and finite domains.
- `stage` requires prior validation and a neutral public label. It stages one
  member using its content hash as the filename. Windows-invalid source names
  never become filesystem names. Repeated identical objects are reused.
- `validate` checks actual staged files against their declared hashes, sizes,
  formats, identities and allowed public fields. `local-staged` explicitly does
  not mean uploaded, publicly available, or integrated into the editor.
- The private index retains supplier, rights basis, archive digest, exact member
  names, content digests and technical findings. Keep it outside `public/`,
  frontend source imports, deployment bundles and public API responses.
- The public staging manifest contains neutral labels, opaque IDs, local object
  paths and measured technical fields. It omits supplier and original paths.
- Defaults limit a selected temporary member to 256 MiB and a probe/decode
  process to 60 seconds. These are per-command safety bounds and can be raised
  deliberately with `--max-entry-bytes` / `--timeout` for known large inputs.

## Current architecture and integration points

The checked source configuration in `.openai/hosting.json` binds Sites to D1
`DB` and R2 `BUCKET`. `sites/server.ts` already handles object streams, range
delivery and multipart uploads. `vercel.json` builds the Vite frontend into
`dist/client`; only the support API is configured there. This is a source
configuration finding, not a claim that remote account resources were checked.

Use the existing Sites object-storage boundary for a large shared library:

1. Import verified original objects once under a content-addressed shared
   prefix. Store private provenance separately from public search metadata.
   Keep originals immutable; derived previews retain a source-digest relation.
2. Store paginated catalog records in D1: logical asset/group ID, variant ID,
   media role, neutral label/tags, measured duration/dimensions/codec, object
   digest/key, preview key, and actual availability. Count logical designs and
   resolution/aspect variants separately. Avoid shipping a huge JSON/TypeScript
   array or every original file in the Vercel build.
3. Deliver measured, smaller previews/posters and authenticated or explicitly
   authorized original-byte routes with byte-range support. Resolve only known
   catalog IDs; never let a model supply an arbitrary URL or storage key.
4. Initially, copying only the selected object into a user's existing asset
   workflow preserves current ownership, save and export behavior. For stronger
   deduplication, add a separate shared-catalog reference model. The current
   `assets.r2_key` uniqueness constraint prevents inserting the same shared
   object key for many different user assets without a schema/route change.
5. Query relevant catalog candidates for Reel by kind, duration, aspect and
   verified tags; send a bounded result page, not the full library. Both manual
   selection and Reel must resolve the same catalog ID and placement rules.
6. Mark delivery available only after checking object bytes/metadata at the
   destination, then verify selection, preview, save/reload and real export.
   An uploaded manifest alone does not establish availability.

## Format boundaries

| Format | Existing path | Required integration |
| --- | --- | --- |
| WAV/MP3 and other decoded audio | `EditorSoundLibrary`, `editor-catalog-audio`, timeline audio mixer | Extend the hardcoded CC0-only catalog contract with a distinct platform-licensed record; preserve private rights provenance and real durations. Never label purchased material CC0. |
| MP4/MOV/WebM or image overlays | Timeline media clips and shared preview/export blend controls | Select a real file/variant and explicit compositing treatment. Alpha, black-background screen overlays and true adjacent-shot transitions are different assets. |
| CUBE LUT | No CUBE file-loading/runtime path found; current looks use independent color controls | Implement an actual LUT representation and matching preview/export application. Verify the bundled export engine's filter support. Native slider approximations are not the purchased LUT. |
| AEP/MOGRT/DRFX/FCP templates | No native-template interpreter found | Keep inventoried as unsupported until converted by a compatible editor into verified media or faithfully implemented supported editable primitives. Do not count a template filename as a usable animation. |

`StockMedia` currently models Commons/Openverse URLs and their provider-specific
allowlists. A purchased shared library needs its own trusted ID/delivery
contract rather than pretending to be one of those external providers.

## Verified local sample, 11 November 2026

The locally inspected Paint Swipes ZIP is 134,437,223 bytes. Its directory has
80 MP4 members (16 names across five variants) and six WAV members, plus two
excluded macOS metadata files. Those are directory counts; only the explicitly
selected samples are marked decoded in the private index.

One Wall video from each variant and every WAV were decoded successfully:

| Archive variant | Measured size |
| --- | --- |
| hd | 1920 x 1080 |
| 4k | 3840 x 2160 |
| square | 1080 x 1080 |
| vertical | 1080 x 1350 (4:5) |
| story | 1080 x 1920 (9:16) |

The sampled videos are H.264 `yuv420p`, 30000/1001 fps, 0.367033 seconds, with
no alpha or audio stream. Inspected Wall frames show colored paint on opaque
black. Screen blending can make this an overlay; it does not by itself define
an adjacent-shot transition. Do not generalize this sample's duration to other
designs without probing them.

The six WAVs are stereo 48 kHz, 16-bit PCM. Paint Burst, Marker Stroke, Textured
Paint Swipe and Wet Splash are 0.4865 seconds; Bold Brush and Swift Stroke are
0.8065 seconds. The included help PDF contains an installation-help link, not a
per-asset compositing specification.

## Shared storage implementation

The subsequent integration uses `contracts/shared-media-catalog.ts` and
`sites/shared-media-catalog.ts`. Owner-only `/api/catalog/admin/*` routes register
public metadata in D1, stream/hash each selected object into R2, and publish a
record only when all declared objects match their SHA-256 and length. Interrupted
imports resume from explicit user action. An open owner Studio Status panel has a
folder chooser and Start/resume/Stop controls; it invokes no model and creates no
background queue. Metadata is immutable for a content ID.

`/api/catalog/search` returns paginated logical designs and their resolution
variants. `/api/catalog/media/:id/:role` serves ready objects with byte ranges.
Both manual selection and Reel resolve known catalog IDs. Automatic editing gets
the same available candidates and preserves measured duration and compositing.
The selected file is copied into the existing owned-asset storage path; its
catalog identity and alpha/compositing metadata are saved atomically in D1 with
the asset, independently of a later client workspace save.

`prepare-shared-catalog.py` takes an explicit private recipe mapping archive
folders to reviewed neutral groups and compositing modes. It fully decodes each
selected source, validates every LUT sample, stages measured originals or web
derivatives, and retains source hashes/transformation evidence privately. It is
resumable through per-batch manifests. Run only one FFmpeg preparation command at
a time on this laptop. Native editor templates and tutorial/demo media remain in
the private archive indexes until a compatible implementation exists.

LUT delivery removes comments/TITLE only, preserving every numeric sample and
domain. The public runtime accepts actual 3D grids of size 2–64. ProRes alpha
conversion uses separate alpha and color planes and lossless VP9; the runtime
must explicitly select the libvpx-vp9 decoder for those catalog WebM files.
Native/WASM/browser parity is checked separately; a container's alpha tag alone
does not prove transparency survives export.

```powershell
python -X utf8 scripts/prepare-shared-catalog.py C:\media\private\recipe.json --output C:\media\batch --private-report C:\media\private\provenance.json
node scripts/validate-shared-catalog.mjs C:\media\batch
python -X utf8 scripts/merge-shared-catalog.py C:\media\already-imported C:\media\new-batch --output C:\media\complete-catalog
node scripts/validate-shared-catalog.mjs C:\media\complete-catalog
```

The merger verifies all source bytes and uses hard links on the same volume,
with no additional media copy. Pass already imported batches first so duplicate
source files retain their immutable public metadata. Private source aliases and
unsupported entries remain in private reports. The runtime validator checks the
actual public contract and every staged file; local validation is never labeled
as cloud publication. The final delivery still requires the owner import and
live preview, selection, save/reload and export checks.

The first completed broad batches contain 2,059 distinct sanitized LUT tables
from all 2,278 source CUBE members, and 144 media records (21 sounds and 123 PNG
frames/masks) representing 87 designs. Source counts and distinct usable content
counts deliberately differ. Full video, social-size, alpha and sound batches
are recorded separately while preparation proceeds; do not treat their mutable
checkpoint manifests as a completed library.
