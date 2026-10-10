# Local footage search

The editor's **Find in this project** control has two modes: **Exact words** and **Meaning · English**. Both search only text already present in the open project: attributable transcript words, recorded source observations and clip names. They never examine unreviewed pictures or start paid source analysis. A result identifies its evidence kind and seeks to that exact clip and project interval. Clip-name matches describe labels, rather than observed visual content.

Meaning search runs the real quantized English MiniLM embedding model in a disposable browser worker. The first search loads about 46 MB of same-origin model/runtime resources. It sends no source media, excerpts or vectors to a provider and uses no AI credits. The model's cosine similarity measures related text, rather than verified visual observations or calibrated confidence. This model can miss descriptions or return an imperfect semantic match; users can inspect each source moment or switch to exact words.

## Attribution and timing

Transcript evidence must retain an explicit `sourceClipId` matching a ready picture/audio asset on this project. A cue without measured words must lie completely inside its retained source interval. Measured words are restricted to the retained interval, divided at pauses and capped before embedding. Persisted scene observations must identify the exact asset, be newer than that asset and have finite increasing source timestamps. Scene intervals are intersected with each retained source occurrence, then mapped through its source in-point, timeline start and playback speed. Repeated footage produces separate timeline results from one shared text embedding. Deleted, unready or ambiguous sources cannot contribute evidence.

Meaning search embeds at most 256 distinct excerpts of at most 512 characters, in batches of eight. Embeddings have 384 dimensions. It returns up to 50 mapped results with cosine similarity at least 0.28. The UI states when distinct excerpts were omitted. Exact-word search can examine additional bounded evidence.

Query, evidence, owner, brand or project changes terminate the old worker and reject its pending work. Results carry the full scope/evidence/query identity and are hidden synchronously if it changes. Nothing is persisted across accounts. Search does not alter clips, transcript, credits or source reviews.

## Runtime and verification

The model is pinned to revision `751bff37182d3f1213fa05d7196b954e230abad9`, with the 22,972,370-byte ONNX file's SHA-256 recorded in its vendored provenance. Transformers 3.8.1 and its pinned ONNX browser runtime use one WASM thread with local files only and remote model loading disabled. The preparation script copies the self-contained `transformers.min.js` browser module, the JSEP factory and one JSEP WASM binary. Generated runtime metadata records sizes and SHA-256 hashes. Dynamic same-origin loading keeps duplicate unused WASM files out of Vite workers.

On 9 October 2026, isolated Chromium 153 executed the actual bundled search worker against the shipped model and runtime. “Somebody enjoys a warm beverage” ranked coffee evidence at 0.6863, ahead of unrelated dog evidence at 0.1339 and laptop evidence at 0.2219. A pet/fetch query ranked dog evidence first at 0.4028. Cancelling an in-flight search rejected it with `AbortError`; a new worker and reordered corpus ranked computer evidence first at 0.7967. The worker rejected 257-excerpt and 513-character inputs. Every request was a same-origin GET; no external requests or provider calls occurred. This is local model verification, separate from authenticated production-account QA.

The exact measured similarities, model/runtime hashes, cancellation results and requested resources are preserved in `docs/qa/semantic-search-2026-10-09.json`.

Nineteen focused tests verify literal search, exact owner/source timing, repeated/retimed footage, invalid and stale evidence, retained word intervals, excerpt/result bounds, result validation, cancellation, stale-message rejection and worker failure. The real CPU model test additionally verifies the ONNX hash, three 384-dimensional embeddings and related-text ranking without literal overlap.
