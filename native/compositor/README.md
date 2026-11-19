# Native graphic compositor

The browser executes reviewed, packaged graphs in an owned Web Worker. User
projects store a catalog ID and bounded text/color/number controls, never uploaded
expressions or arbitrary graph JSON. Source imports that report lost effects,
missing fonts or footage do not enter the catalog. Expression failures abort a
frame; the renderer does not silently publish static fallback values.

EffectCraft is pinned at `665bfac0b33904b1dcda6de889f43f43a94ad3f8`.
Its MIT license and bundled font notices are in
`public/vendor/native-graphics/licenses`. The wrapper source is here; Cargo.lock
pins its dependencies. wasm-bindgen is pinned to 0.2.129.

To rebuild, clone that exact commit into `native/.cache/effectcraft`, install the
`wasm32-unknown-unknown` Rust target, run `cargo build --manifest-path
native/compositor/Cargo.toml --target wasm32-unknown-unknown --release --locked`,
then run wasm-bindgen with `--target web` on the resulting WASM. Pass its output
directory to `node scripts/package-native-compositor.mjs`. No OS font installation,
Adobe application, model API, or external rendering service is involved.

`scripts/build-native-graphics.mjs` consumes the locally extracted purchased
corpus and a Node wasm-bindgen binding. It checks source hashes, import losses,
six animation phases, live editable controls and exact saved/reloaded pixels.
`scripts/lib/native-adobe-adapter.mjs` records narrow compatibility repairs rather
than silently replacing effects. Full source fidelity is not established merely
by these checks; production admission also requires preview/export verification.

`node scripts/verify-native-runtime.mjs` checks the source/runtime build relationship
and every shipped graph/font digest. Rebuild after wrapper changes.
