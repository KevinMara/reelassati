import test from "node:test";
import assert from "node:assert/strict";
import {
  controlOnlyAdobeReport,
  verifyAdobeControlGroups,
  adobeStrictExpressionProbe,
  applyNotificationDefaults,
} from "./native-adobe-controls.mjs";

test("published positions target their own control group and preserve expression-driven properties", () => {
  const control = (id, name, type, value) => ({
    id,
    type,
    value,
    uiName: { strDB: [{ localeString: "en_US", str: name }] },
  });
  const prop = uid => ({
    uid,
    name: "Position",
    value: { t: "Vec2", v: [518, 522] },
  });
  const a = prop(3),
    b = prop(4);
  const main = {
    name: "[Interface][Notifications][Phone] - 01",
    kind: {
      layers: [
        {
          name: "Control Layer",
          props: {
            children: [
              {
                match: "effects",
                children: [
                  { name: "Text A Control", children: [a] },
                  { name: "Text B Control", children: [b] },
                ],
              },
            ],
          },
        },
      ],
    },
  };
  const definition = {
    clientControls: [
      control("g", "Text B", 10, ["p"]),
      control("p", "Position", 5, { x: 0, y: 0 }),
    ],
  };
  assert.equal(applyNotificationDefaults(main, definition).length, 1);
  assert.deepEqual(a.value.v, [518, 522]);
  assert.deepEqual(b.value.v, [0, 0]);
  assert.deepEqual(applyNotificationDefaults(main, definition), []);
  b.expr = { enabled: true };
  assert.throws(
    () => applyNotificationDefaults(main, definition),
    /Unresolved/
  );
});

const report = detail => ({
  missingFonts: [],
  missingFootage: [],
  losses: [{ category: "effects", unlisted: 0, details: [detail] }],
});
const data = () => ({
  items: {
    1: {
      id: 1,
      kind: {
        type: "Comp",
        layers: [
          {
            id: 2,
            props: {
              children: [
                {
                  node: "Group",
                  uid: 3,
                  kind: { effect: "Pseudo/MDS Elastic Controller" },
                  children: ["Amplitude", "Frequency", "Decay"].map(
                    (name, i) => ({
                      node: "Prop",
                      uid: 4 + i,
                      name,
                      value: { t: "Scalar", v: 20 },
                    })
                  ),
                },
              ],
            },
          },
        ],
      },
    },
  },
});
test("recognizes inspected expression controls, never generic unsupported pixel effects", () => {
  assert.equal(
    controlOnlyAdobeReport(
      report(
        "Title: 'Text' has the effect 'Elastic Controller' (Pseudo/MDS Elastic Controller), kept without rendering"
      )
    ),
    true
  );
  for (const detail of [
    "Title (ADBE Arithmetic), kept without rendering",
    "Title (Pseudo/Unknown), kept without rendering",
    "Title (Pseudo/MDS Elastic Controller): parameter not kept",
  ])
    assert.equal(controlOnlyAdobeReport(report(detail)), false);
  const missing = report(
    "Title (Pseudo/MDS Elastic Controller), kept without rendering"
  );
  missing.missingFonts.push("Missing");
  assert.equal(controlOnlyAdobeReport(missing), false);
});
test("requires the complete inspected group, including types and animation state", () => {
  assert.equal(verifyAdobeControlGroups(data()).length, 1);
  for (const mutate of [
    p => p.children.pop(),
    p => (p.children[0].value.t = "Color"),
    p => (p.children[0].keys = [{}]),
    p => (p.kind.effect = "Pseudo/Unknown"),
  ]) {
    const d = data();
    mutate(d.items[1].kind.layers[0].props.children[0]);
    assert.throws(() => verifyAdobeControlGroups(d));
  }
});
test("strict diagnostic makes authored static fallbacks observable without changing shipped graph", () => {
  const d = data(),
    p = d.items[1].kind.layers[0].props.children[0].children[0];
  p.expr = {
    enabled: true,
    text: "try { effect('Elastic Controller')(1) } catch (e$$4) { value = value; }",
  };
  const probe = adobeStrictExpressionProbe(d);
  assert.equal(probe.changed.length, 1);
  assert.match(
    probe.project.items[1].kind.layers[0].props.children[0].children[0].expr
      .text,
    /throw e\$\$4/
  );
  assert.doesNotMatch(p.expr.text, /throw/);
});
