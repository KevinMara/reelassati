import test from "node:test";
import assert from "node:assert/strict";
import { parseFusionSetting, fields, fusionTools } from "./fusion-setting.mjs";
import { compileFusionFrameProgram } from "./fusion-frame-program.mjs";
import {
  fusionParameterEvaluator,
  evaluateFusionSpline,
} from "./fusion-curves.mjs";

test("parses ordered groups, plug-in IDs, numeric keys and inert expression text", () => {
  const root = parseFusionSetting(
    `{Tools=ordered(){Group=GroupOperator{Tools={T=ofx.com.vendor.Transform{Inputs={Size=Input{Expression="os.execute('never run')"}}}}}, Curve=LUTBezier{KeyColorSplines={[0]={[0]={0},[1]={1}}}}}}`
  );
  const nodes = fusionTools(root);
  assert.equal(nodes.get("T").tag, "ofx.com.vendor.Transform");
  assert.equal(
    fields(fields(fields(nodes.get("T")).Inputs).Size).Expression,
    "os.execute('never run')"
  );
  assert.equal(
    fields(fields(fields(nodes.get("Curve")).KeyColorSplines)["0"])["1"]
      .entries["1"],
    1
  );
});
test("rejects executable syntax, duplicate data and structural attacks", () => {
  for (const source of [
    "os.execute('test')",
    "{}; os.execute('test')",
    "{x=loadstring('test')()}",
    "{x=1,x=2}",
    "{x=1e999}",
    "{".repeat(150),
  ])
    assert.throws(() => parseFusionSetting(source));
  const data = fields(parseFusionSetting('{["__proto__"]={polluted=true}}'));
  assert.equal(Object.getPrototypeOf(data), null);
  assert.equal({}.polluted, undefined);
});
test("Bezier interpolation solves the authored time handles", () => {
  const knots = [
    { at: 0, value: 0, right: [0.1, 0.8] },
    { at: 1, value: 1, left: [0.2, 0.9] },
  ];
  // At parameter 0.5: X=.2375, Y=.7625. Treating X as t is incorrect.
  assert.ok(Math.abs(evaluateFusionSpline(knots, 0.2375) - 0.7625) < 1e-12);
  assert.equal(evaluateFusionSpline(knots, -3), 0);
  assert.equal(evaluateFusionSpline(knots, 5), 1);
});
const curveRoot = () =>
  parseFusionSetting(`{
  Tools = {
    T = Transform { Inputs = { XSize = Input { SourceOp="C", Source="Value" } } },
    C = LUTLookup { Inputs = {
      Curve=Input{Value=FuID{"Easing"}}, EaseIn=Input{Value=FuID{"Quad"}},
      EaseOut=Input{Value=FuID{"Quad"}}, Mirror=Input{Value=1},
      Scale=Input{Value=2}, Offset=Input{Value=1},
      TimeScale=Input{Value=1.493}, TimeOffset=Input{Value=.088}
    } }
  }
}`);
test("matches native stretch timing before and after the mirrored midpoint", () => {
  const f = fusionParameterEvaluator(curveRoot(), { frames: 180 });
  // Independent samples captured from the unchanged graph in Resolve 20.0.1.
  for (const [frame, expected] of [
    [0, 1],
    [20, 1.01926283272],
    [54, 2.47167014053],
    [90, 2.7958196759],
    [120, 1.2994748348],
    [137, 1],
    [179, 1],
  ])
    assert.ok(
      Math.abs(f.input("T", "XSize", frame) - expected) < 1e-6,
      `frame ${frame}`
    );
});
test("matches native asymmetric exponential easing including endpoint behavior", () => {
  const root = parseFusionSetting(
    '{Tools={C=LUTLookup{Inputs={Curve=Input{Value=FuID{"Easing"}},EaseIn=Input{Value=FuID{"Expo"}},EaseOut=Input{Value=FuID{"Expo"}},Scale=Input{Value=360}}}}}'
  );
  const f = fusionParameterEvaluator(root, { frames: 180 });
  for (const [frame, expected] of [
    [0, -0.00421875],
    [20, 0.647304273445],
    [76, 63.0910188114],
    [90, 186.843841213],
    [120, 343.20342625],
    [179, 360],
  ])
    assert.ok(
      Math.abs(f.output("C", "Value", frame) - expected) < 0.0001,
      `frame ${frame}`
    );
});
test("refuses expressions and cyclic modifier inputs", () => {
  const f = fusionParameterEvaluator(
    parseFusionSetting(
      '{Tools={T=Transform{Inputs={XSize=Input{Expression="time"}}}}}'
    ),
    { frames: 180 }
  );
  assert.throws(
    () => f.input("T", "XSize", 0),
    /expression requires compilation/
  );
  const cyclic = fusionParameterEvaluator(
    parseFusionSetting(
      '{Tools={A=LUTLookup{Inputs={TimeScale=Input{SourceOp="A",Source="Value"}}}}}'
    ),
    { frames: 180 }
  );
  assert.throws(() => cyclic.output("A", "Value", 0), /Cyclic/);
});

test("inverts the normalized curve before applying scale and offset", () => {
  const f = fusionParameterEvaluator(
    parseFusionSetting(`{Tools={C=LUTLookup{Inputs={
    Curve=Input{Value=FuID{"Easing"}},Invert=Input{Value=1},
    Scale=Input{Value=2},Offset=Input{Value=3}
  }}}}`),
    { frames: 11 }
  );
  assert.equal(f.output("C", "Value", 0), 5);
  assert.equal(f.output("C", "Value", 5), 4);
  assert.equal(f.output("C", "Value", 10), 3);
});

test("compiles normal over without turning masks or other modes into dissolves", () => {
  const source = extra => `{Tools={G=GroupOperator{
    Inputs=ordered(){A=InstanceInput{SourceOp="M",Source="Background"},B=InstanceInput{SourceOp="M",Source="Foreground"}},
    Outputs={Out=InstanceOutput{SourceOp="M",Source="Output"}},
    Tools={M=Merge{Inputs={PerformDepthMerge=Input{Value=0},Blend=Input{Value=.25}${extra}}}}
  }}}`;
  const p = compileFusionFrameProgram(parseFusionSetting(source("")), {
    frames: 2,
  });
  assert.equal(p.nodes[0].kind, "over");
  assert.deepEqual(p.nodes[0].samples, [{ mix: 0.25 }, { mix: 0.25 }]);
  for (const input of [
    ',Operator=Input{Value=FuID{"In"}}',
    ",Gain=Input{Value=.5}",
    ',EffectMask=Input{SourceOp="Mask",Source="Mask"}',
  ])
    assert.throws(() =>
      compileFusionFrameProgram(parseFusionSetting(source(input)), {
        frames: 2,
      })
    );
});
