import signatures from "./native-adobe-control-groups.json" with { type: "json" };

/** Essential Graphics publishes instance defaults independently of the AEP's
 * saved property values. Resolve controls by their enclosing published group.
 * A name like "Position" alone identifies several different properties. */
export function applyNotificationDefaults(main, definition) {
  if (!main.name.startsWith("[Interface][Notifications]")) return [];
  const controls = new Map(definition.clientControls.map(c => [c.id, c]));
  const name = c => c.uiName.strDB.find(s => s.localeString === "en_US")?.str;
  const parents = new Map();
  for (const c of controls.values())
    if (c.type === 10) for (const id of c.value) parents.set(id, name(c));
  const target = main.kind.layers.find(l => l.name === "Control Layer");
  const effects = target?.props.children.find(
    g => g.match === "effects"
  )?.children;
  if (!effects) throw Error("Missing published notification controls");
  const repairs = [];
  for (const c of controls.values()) {
    if (c.type === 6 || c.type === 10) continue;
    const groupName = parents.get(c.id) ?? "Global";
    const group = effects.find(
      g => g.name === groupName || g.name === groupName + " Control"
    );
    const p = group?.children.find(v => v.name === name(c));
    if (!p || p.keys?.length || p.expr?.enabled)
      throw Error(
        "Unresolved published control: " + groupName + " / " + name(c)
      );
    const type = { 1: "Bool", 2: "Scalar", 4: "Color", 5: "Vec2", 13: "Enum" }[
      c.type
    ];
    if (p.value.t !== type)
      throw Error("Unexpected published control type: " + name(c));
    const v =
      c.type === 5
        ? [c.value.x, c.value.y]
        : c.type === 13
          ? c.value - 1
          : c.value;
    if (JSON.stringify(p.value.v) === JSON.stringify(v)) continue;
    repairs.push({
      kind: "published-control-default",
      group: group.name,
      property: p.uid,
      previous: p.value.v,
      published: v,
    });
    p.value.v = v;
  }
  return repairs;
}

/** These inspected pseudo effects contain expression controls, not a pixel
 * operation. Keep their exact groups and values in the graph. A generic unknown
 * effect, missing parameter, altered schema or any other importer loss fails.
 * Admission still requires exercising source expressions and edited pixels. */
export function controlOnlyAdobeReport(report, fontAliases = {}) {
  return (
    !!report &&
    report.missingFonts.every(name => Object.hasOwn(fontAliases, name)) &&
    !report.missingFootage?.length &&
    report.losses.every(
      loss =>
        loss.category === "markers" ||
        (loss.category === "effects" &&
          loss.unlisted === 0 &&
          loss.details.every(detail => {
            const id =
              /\((Pseudo\/[^)]+)\), kept without rendering(?:, and [1-9]\d* more like it)?$/.exec(
                detail
              )?.[1];
            return id && Object.hasOwn(signatures, id);
          }))
    )
  );
}

export function verifyAdobeControlGroups(project) {
  const evidence = [];
  for (const comp of Object.values(project.items).filter(
    c => c.kind.type === "Comp"
  ))
    for (const layer of comp.kind.layers) {
      const visit = group => {
        if (group.kind?.effect?.startsWith("Pseudo/")) {
          const id = group.kind.effect,
            expected = signatures[id];
          const actual = group.children?.map(p => [p.name, p.value?.t]);
          if (
            !expected ||
            JSON.stringify(actual) !== JSON.stringify(expected) ||
            group.children.some(
              p => p.node !== "Prop" || p.keys?.length || p.expr?.enabled
            )
          )
            throw Error("Unverified expression-control group: " + id);
          evidence.push({
            comp: comp.id,
            layer: layer.id,
            group: group.uid,
            effect: id,
            parameters: actual,
          });
        }
        for (const child of group.children ?? [])
          if (child.node === "Group") visit(child);
      };
      visit(layer.props);
    }
  return evidence;
}

/** A second diagnostic rendering pass replaces only known source fallbacks
 * with rethrows. This catches expression-host failures even where the original
 * template's author catches exceptions and returns a static value. */
export function adobeStrictExpressionProbe(project) {
  const diagnostic = structuredClone(project),
    changed = [];
  for (const comp of Object.values(diagnostic.items).filter(
    c => c.kind.type === "Comp"
  ))
    for (const layer of comp.kind.layers) {
      const visit = group => {
        for (const p of group.children ?? []) {
          if (p.node === "Group") {
            visit(p);
            continue;
          }
          if (!p.expr?.enabled || !p.expr.text.includes("catch")) continue;
          const original = p.expr.text;
          p.expr.text = original.replace(
            /catch\s*\(\s*([\w$]+)\s*\)\s*\{\s*(?:value\s*=\s*)?value\s*;?\s*\}/g,
            (_, name) => `catch (${name}) { throw ${name}; }`
          );
          if (p.expr.text !== original)
            changed.push({ comp: comp.id, layer: layer.id, property: p.uid });
        }
      };
      visit(layer.props);
    }
  return { project: diagnostic, changed };
}
