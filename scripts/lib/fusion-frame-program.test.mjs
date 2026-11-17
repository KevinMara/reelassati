import test from "node:test";
import assert from "node:assert/strict";
import { parseFusionSetting } from "./fusion-setting.mjs";
import { compileFusionFrameProgram } from "./fusion-frame-program.mjs";

const source = (
  node = 'D=Dissolve{Inputs={Mix=Input{Value=.25}},Transitions={[0]="DFTDissolve"}}'
) => `{Tools={G=GroupOperator{
  Inputs=ordered(){First=InstanceInput{SourceOp="D",Source="Foreground"},Second=InstanceInput{SourceOp="D",Source="Background"}},
  Outputs={Main=InstanceOutput{SourceOp="D",Source="Output"}},Tools={${node}}
}}}`;
test("keeps authored input pin order rather than assuming background is first", () => {
  const program = compileFusionFrameProgram(parseFusionSetting(source()), {
    frames: 2,
    fps: 30,
  });
  assert.deepEqual(program.nodes, [
    {
      id: "node-0",
      kind: "mix",
      a: "input-1",
      b: "input-0",
      samples: [{ mix: 0.25 }, { mix: 0.25 }],
    },
  ]);
  assert.equal(program.admission, "requires-renderer-and-native-parity");
});
test("does not silently flatten unsupported native effects or controls", () => {
  for (const node of [
    "D=Merge{}",
    'D=Dissolve{Inputs={Mix=Input{Value=.5},EffectMask=Input{SourceOp="Mask",Source="Output"}}}',
    'D=Dissolve{Transitions={[0]="VendorPlugin"}}',
  ])
    assert.throws(() =>
      compileFusionFrameProgram(parseFusionSetting(source(node)), { frames: 2 })
    );
});
test("rejects image cycles, ambiguous source pins and invalid clocks", () => {
  const root = parseFusionSetting(source());
  for (const frames of [1, Infinity, 18001, 1.5])
    assert.throws(() => compileFusionFrameProgram(root, { frames }));
  const duplicate = source().replace(
    'Source="Background"',
    'Source="Foreground"'
  );
  assert.throws(
    () => compileFusionFrameProgram(parseFusionSetting(duplicate)),
    /Duplicate/
  );
});
