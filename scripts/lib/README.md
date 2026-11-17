# Native template conversion

`compile-fusion-setting.mjs` reads saved Fusion data without executing Lua,
expressions, plug-ins, or embedded commands. It preserves the authored input pin
order and compiles supported modifier curves plus Transform/Dissolve image graphs
into an offline frame program. Unknown controls, ambiguous pins and cycles fail
explicitly instead of being silently replaced with a generic effect.

Run:

```text
node scripts/compile-fusion-setting.mjs original.setting new-program.json 180 30
node --test scripts/lib/fusion-setting.test.mjs scripts/lib/fusion-frame-program.test.mjs
```

The compiler never overwrites its source or an existing output. Programs record
the source SHA-256, timeline clock and an explicit admission state. They are
conversion artifacts, **not effects available in the editor**. Browser/export
graph execution and native frame parity are required before catalog admission.

Current scope: safe parser, Bézier time inversion, native mirrored curve clock,
Linear/Quad/Cubic/Quart/Quint/Sine/Expo/Circ easing, Vector parameters, ordered
Transform/Dissolve graphs. Expression compilation, other image operations,
custom plug-ins, edge-mode rendering, motion-blur rendering and title font/layout
parity remain separate work. The compiler retains edge and blur settings; it does
not claim to implement their renderer.

Native comparisons belong in the private verification artifacts. Tests include
independent numeric samples from unchanged Resolve graphs, including the mirrored
tail and asymmetric exponential curve. Passing those tests proves those curve
samples, not full visual equivalence or support for every purchased editor format.
