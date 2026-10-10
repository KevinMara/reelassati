# Local still-image tools

The editor's Image tools include **Person cutout** and **Relative depth**. Choose a ready Library image, run the preview, adjust the result and save a separate PNG to the Library. Saving preserves the source image and records `parentAssetId` on the output. The output keeps the upload service's authoritative identity and provenance; the source's signed evidence is not copied onto new bytes. Add the derived PNG to the timeline through the normal Library workflow.

Person cutout runs the pinned Apache-2.0 MediaPipe selfie-segmentation ONNX model. Threshold and edge softness change the PNG's alpha while preserving its RGB and original transparency. It is still-image person segmentation. Hair, fine edges and difficult backgrounds may need different controls. Full-video matting and rotoscoping are unsupported.

Relative depth runs the pinned Apache-2.0 Depth Anything V2 Small quantized ONNX model. It writes a grayscale PNG, with an invert control. Values represent relative image depth; they are not measured distances, a reconstructed scene or tracked 3D geometry.

Both tools accept PNG, JPEG and still WebP up to 20 MiB, 4,000,000 pixels and 4096 pixels per side. Byte counts and bounded container headers are checked before decoding, and decoded dimensions are checked again. Relative depth additionally accepts aspect ratios between 1:2 and 2:1, including 9:16 and 16:9. Animated WebP is rejected.

The browser worker loads the prepared, same-origin Transformers 3.8.1 runtime with the WASM execution provider and one thread. Remote model fallback and browser/FS model caches are disabled. Pinned model length and SHA-256 checks precede inference. The depth model is shipped as two files below the static host's per-file limit and reassembled only for its exact same-origin path. No inference provider request or provider credit charge is involved.

The workflow captures the expected account, brand, project and source before long operations. Source/project/account/brand changes and unmount cancel the operation; download, save and multipart upload requests retain the original owner scope. A stale result cannot be saved into a newly selected account or brand.

## Verification

The recorded isolated Chromium 153 test used the actual worker, committed model bytes and prepared WASM runtime on NASA's official Neil Armstrong portrait, resized to 402 × 512. The source page is <https://www.nasa.gov/image-article/official-portrait-of-neil-armstrong/>; NASA credits the photograph to NASA. No production authentication or customer assets were used.

Measured results are preserved in `docs/qa/still-image-wasm.json`:

| Check | Measured result |
| --- | --- |
| Person foreground / background alpha | 255 / 0 |
| Threshold change from 0.5 / softness 0.15 to 0.85 / softness 0.05 | 11,596 changed alpha pixels |
| Cutout RGB | Unchanged |
| Person worker time | 837 ms |
| Depth output range | 0–255 |
| Repeated depth inference | Zero changed pixels |
| Flipped-source difference, direct / spatially mirrored comparison | 50.65 / 6.07 mean absolute difference |
| Depth face / background sample mean | 108.76 / 19.24 |
| Depth worker time | 4.63 seconds; repeated / flipped runs 4.69 / 4.89 seconds |
| External requests / browser errors | 0 / 0 |

The flip comparison tests dependence on image content: the map follows the flipped portrait rather than behaving as a fixed image-space gradient. It does not establish metric accuracy or universal performance. These timings describe this isolated test machine.

Nineteen focused unit tests cover predecode format/dimension limits, animated WebP rejection, depth aspect limits, committed model and shard digests, tamper/truncation rejection, narrow same-origin cache behavior, transparency and pixel preservation, and source/project lineage and staleness. The separate transport tests cover pinned upload scope across account and brand changes.
