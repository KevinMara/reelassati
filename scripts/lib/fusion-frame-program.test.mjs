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
test("evaluates the authored spline on each side of the exposure", () => {
  const root = parseFusionSetting(source(
    'D=Dissolve{},T=Transform{Inputs={Input=Input{SourceOp="D",Source="Output"},Angle=Input{SourceOp="A",Source="Value"},MotionBlur=Input{Value=1},Quality=Input{Value=2},ShutterAngle=Input{Value=180}}},A=BezierSpline{KeyFrames={[0]={0},[2]={40,Flags={Linear=true}}}}'
  ).replace('Main=InstanceOutput{SourceOp="D"', 'Main=InstanceOutput{SourceOp="T"'));
  const p = compileFusionFrameProgram(root,{frames:3,fps:30});
  const sample = p.nodes.at(-1).samples[1];
  assert.equal(sample.angle,20);
  assert.deepEqual(sample.shutter.map(p=>p.angle),[15,17.5,20,22.5,25]);
});
test("does not silently flatten unsupported native effects or controls", () => {
  for (const node of [
    'D=Merge{Inputs={Operator=Input{Value=FuID{"In"}}}}',
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

test("merge sizing transforms only its foreground before alpha compositing", () => {
  const program = compileFusionFrameProgram(
    parseFusionSetting(
      source(
        "D=Merge{Inputs={Center=Input{Value={.75,.3}},Size=Input{Value=.5},Angle=Input{Value=90},FlipHoriz=Input{Value=1},Blend=Input{Value=.8}}}"
      )
    ),
    { frames: 2 }
  );
  assert.deepEqual(program.nodes, [
    {
      id: "node-0",
      kind: "transform",
      input: "input-0",
      samples: Array.from({ length: 2 }, () => ({
        center: [0.75, 0.3],
        pivot: [0.5, 0.5],
        scaleX: -0.5,
        scaleY: 0.5,
        angle: 90,
        edges: 0,
        motionBlur: 0,
        quality: 2,
        shutterAngle: 180,
      })),
    },
    {
      id: "node-1",
      kind: "over",
      a: "input-1",
      b: "node-0",
      samples: [{ mix: 0.8 }, { mix: 0.8 }],
    },
  ]);
  assert.equal(program.output, "node-1");
});

test("merge sizing does not hide unsupported modes, masks or negative sizes", () => {
  for (const extra of [
    'Operator=Input{Value=FuID{"In"}}',
    'EffectMask=Input{SourceOp="Mask",Source="Output"}',
    "Size=Input{Value=-1}",
    "FlipHoriz=Input{Value=.5}",
  ])
    assert.throws(() =>
      compileFusionFrameProgram(
        parseFusionSetting(
          source(`D=Merge{Inputs={Center=Input{Value={.5,.5}},${extra}}}`)
        ),
        { frames: 2 }
      )
    );
});
