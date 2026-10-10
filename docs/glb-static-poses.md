# Static GLB poses

In the editor, open Graphics → 3D pose, choose a self-contained binary glTF 2.0 `.glb`, then adjust Turn, Tilt, Roll, Zoom, Exposure and Material tint. **Save pose to Library** uploads a transparent 1024 × 1024 PNG. Drag that image from Library onto a visual timeline track; normal timeline opacity, transforms and compositing then apply to the baked image. Reimport the original GLB to compose a different 3D pose.

The renderer uses real three.js meshes, a perspective camera, standard glTF materials, embedded textures and local WebGL. Model bytes remain in the browser during posing; saving uploads only the PNG through the authenticated asset boundary. The upload scope is captured before PNG encoding, and a closed composer cannot start its pending upload.

Supported files have at most 25 MiB of encoded data, 1 MiB of metadata, 250,000 rendered triangles, 1,024 nodes, 4,096 accessors, four million scalar values and 4,096 rendered mesh primitives. Embedded PNG/JPEG textures have at most a 4,096-pixel edge and 32 million total decoded pixels. Actual accessor byte ranges and index values, finite coordinates, material references and the node graph are checked before the loader runs. Linked resources, data URLs, sparse accessors, unsupported extensions/compression, skins, morph targets and animations are rejected with an explanation. `KHR_materials_unlit` is supported.

This feature saves a static image. It does not export animated GLB scenes, track a camera or object in footage, reconstruct a scene, or provide a 3D timeline. Transparent PNGs use the existing picture export path.

## Verification

The recorded isolated fixture run used Chromium 153 with SwiftShader, genuine GLB geometry/materials and an embedded PNG texture. Each pose control changed rendered PNG hashes; resetting the pose produced an identical hash. The textured pose had transparent corners and more than 100,000 opaque pixels in each of its blue and yellow texture regions. No external requests or page errors occurred.

The same generated PNG was composited over an RGB (80, 120, 160) background using the application's `buildRenderPlan`, both native FFmpeg and the shipped browser FFmpeg WASM core. Four one-second H.264/AAC exports (opacity 1 and 0.5 in each engine) fully decoded at 720 × 720, 30 fps. Transparent corners retained the background within two RGB levels. Sampled material colors matched between engines within two levels; half-opacity colors were within four levels of the expected blend, allowing for YUV conversion and lossy compression.

Actual composer interactions confirmed `prepare → encode → save:image/png`; completing deferred PNG encoding after unmount invoked no upload. The focused validator/composer suite passed 26 tests and targeted ESLint passed. These checks used local fixtures and no authenticated production account; live owner uploads remain a separate check.

See [the recorded hashes, filter arguments, decoded metadata and pixel samples](qa/glb-static-pose-2026-10-10.json).
