import test from "node:test";
import assert from "node:assert/strict";
import {
  parseFusionSetting,
  resolvedFusionTools,
  fields,
} from "./fusion-setting.mjs";
import { fusionParameterEvaluator } from "./fusion-curves.mjs";
import { compileFusionFrameProgram } from "./fusion-frame-program.mjs";

test("instances inherit controls and animation links while explicit empty inputs restore defaults", () => {
  const root = parseFusionSetting(
    '{Tools={Base=Transform{Inputs={Size=Input{Value=2},Angle=Input{Value=45},Center=Input{Value={.7,.3}}}}, Child=Transform{SourceOp="Base",Inputs={Angle=Input{},Size=Input{Value=3}}},Leaf=Transform{SourceOp="Child",Inputs={}}}}'
  );
  const evaluate = fusionParameterEvaluator(root, { frames: 31 });
  assert.equal(evaluate.input("Leaf", "Size", 0, 1), 3);
  assert.equal(evaluate.input("Leaf", "Angle", 0, 0), 0);
  assert.equal(fields(evaluate.input("Leaf", "Center", 0))[1], 0.7);
  assert.equal(
    fields(fields(resolvedFusionTools(root).get("Base")).Inputs).Size.entries
      .Value,
    2
  );
});
test("cycles and mismatched instance classes fail before rendering", () => {
  for (const source of [
    '{Tools={A=Transform{SourceOp="B"},B=Transform{SourceOp="A"}}}',
    '{Tools={A=Transform{SourceOp="B"},B=Merge{}}}',
  ])
    assert.throws(() =>
      resolvedFusionTools(parseFusionSetting(source)).get("A")
    );
});
const graph = controls =>
  parseFusionSetting(
    `{Tools={Group=GroupOperator{Inputs={A=InstanceInput{SourceOp="Base",Source="Input"},B=InstanceInput{SourceOp="Copy",Source="Input"}},Outputs={O=InstanceOutput{SourceOp="Mix",Source="Output"}},Tools={Base=Transform{Inputs={${controls}}},Copy=Transform{SourceOp="Base",Inputs={Input=Input{}}},Mix=Dissolve{Inputs={Background=Input{SourceOp="Base",Source="Output"},Foreground=Input{SourceOp="Copy",Source="Output"},Mix=Input{Value=.5}}}}}}}`
  );
test("independent axes ignore dormant Aspect and both instance inputs retain their pin identities", () => {
  const p = compileFusionFrameProgram(
    graph(
      "UseSizeAndAspect=Input{Value=0},Aspect=Input{Value=0},XSize=Input{Value=2},YSize=Input{Value=.5}"
    ),
    { frames: 3, fps: 30 }
  );
  assert.deepEqual(
    p.nodes.slice(0, 2).map(n => n.input),
    ["input-0", "input-1"]
  );
  for (const n of p.nodes.slice(0, 2)) {
    assert.equal(n.samples[0].scaleX, 2);
    assert.equal(n.samples[0].scaleY, 0.5);
  }
});
test("aspect expands one axis and authored flips preserve their sign", () => {
  for (const [aspect, sx, sy] of [
    [2, -4, 2],
    [0.5, -2, 4],
  ]) {
    const p = compileFusionFrameProgram(
      graph(
        `Size=Input{Value=2},Aspect=Input{Value=${aspect}},FlipHoriz=Input{Value=1}`
      ),
      { frames: 3, fps: 30 }
    );
    assert.equal(p.nodes[0].samples[0].scaleX, sx);
    assert.equal(p.nodes[0].samples[0].scaleY, sy);
  }
});
