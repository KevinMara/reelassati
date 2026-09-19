# Editor assets — 15 September 2026

## Actual bundled catalog

Added 33 newly downloaded CC0 files to public/shared-assets/audio: 27 SFX and six music tracks, 20,225,546 bytes excluding manifest and source records. The active src/lib/editor-audio-catalog.ts export now lists these files instead of the earlier 19 Kenney/Joth entries. Original older binary URLs remain available for existing projects.

- Organic swishes, metal pings/clinks/thuds, material impacts, an air-whoosh loop and the complete original Wilhelm scream recording session (USC / Craig Smith, CC0).
- Cinematic percussion, lofi piano/hip-hop, minimal bass, jazz/funk and dark ambient music.
- Every file has creator, exact source, original name, license URL, source/bundled hashes, processing description and waveform data.
- Full FFmpeg decode completed for every file. Source/encoded duration difference under 0.12 seconds; sources at least 44.1 kHz; actual output peaks at or below -2.0 dBFS. No human listening or virality claim.

The UI integration is owned by the generation/library changes: audition, save a real owner asset to Library, then drag onto the timeline. The catalog grants no user extra credits and starts no paid generation.

## Supplied Drive folder

Google Drive plugin freshly verified https://drive.google.com/drive/folders/1CwDRkh-DBCXropAJVqBd_rsfapjDdj4T as “Futuristic SFXs”: 42 files, 40 WAV and two MP4; no license document is present. This matches the previously downloaded 117,061,210-byte source collection and existing durable archive REELassati-Drive-sounds.zip.

Two filenames identify Bluezone BC0296; two identify InMotionAudio CaveDesign. Other entries include unlicensed generic and Apple/Siri-labelled sounds. The Bluezone license at https://www.bluezone-corporation.com/faq explicitly requires integrating sounds into original works and forbids distributing source samples separately or making them extractable. A public Drive sharing setting is access permission; it does not replace the sound owner's copyright license. These files were not put into the public shared-assets catalog. This preserves the user's requirement that shared catalog content be legally redistributable.

The earlier completed download is documented in the prior source audit. This release did not complete a fresh transfer of the supplied collection and does not claim to have added it to the shared catalog.

## Additional assets considered

- Gregor Quendel Free Cinematic Sound Effects: https://opengameart.org/content/free-cinematic-sound-effects . Professional sound-design collection, CC-BY-4.0. Not bundled in this release because complete output attribution preservation is not implemented. This is a viable addition once generated/exported projects carry the required credits.
- Poly Haven: https://polyhaven.com/license . Its asset license is CC0 and explicitly permits redistribution inside commercial products. A raw GLB download is not a functioning editor effect: no GLTF import/render path currently exists. The spatial editor work implements supported preview/export geometry instead of claiming unrenderable models are usable.
- FreePD at https://freepd.com is closed; no download was falsely claimed.
- Sonniss and Bluezone sample libraries are not appropriate for an extractable customer-facing catalog under their current published terms.
