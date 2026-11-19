/** Explicit compatibility repairs for inspected source graphs. This does not
 * suppress importer or expression failures. Every rewrite records its reason;
 * expressions that do not match the verified source forms remain untouched. */
export function adaptAdobeProject(input) {
  const project = structuredClone(input),
    repairs = [];
  const comps = Object.values(project.items ?? {}).filter(
    x => x.kind?.type === "Comp"
  );
  const allocate = () => {
    if (!Number.isSafeInteger(project.next_id) || project.next_id < 1)
      throw Error("Invalid project identity counter");
    return project.next_id++;
  };
  const findUnique = (items, name) => {
    const found = items.filter(x => x.name === name);
    return found.length === 1 ? found[0] : undefined;
  };
  for (const comp of comps)
    for (const layer of comp.kind.layers) {
      const visit = (group, parents = []) => {
        for (const property of group.children ?? []) {
          if (property.node === "Group") {
            visit(property, [...parents, group]);
            continue;
          }
          if (!property.expr?.enabled) continue;
          const expression = property.expr.text;
          const ownPosition =
            /^\s*x\s*=\s*text\.animator\("([^"\n]+)"\)\.property\.position\[0\];\s*y\s*=\s*(-?)thisComp\.height\s*([+-])\s*10;\s*\[x,\s*y\];?\s*$/.exec(
              expression
            );
          const animator = parents.at(-1);
          if (
            ownPosition &&
            group.match === "properties" &&
            animator?.match === "animator" &&
            animator.name === ownPosition[1] &&
            property.match === "position" &&
            property.value?.t === "Vec3"
          ) {
            if ((ownPosition[2] === "-" ? "-" : "+") !== ownPosition[3])
              continue;
            property.expr.text = `[value[0], ${ownPosition[2]}thisComp.height ${ownPosition[3]} 10]`;
            repairs.push({
              kind: "self-position-accessor",
              comp: comp.id,
              layer: layer.id,
              property: property.uid,
              original: expression,
              replacement: property.expr.text,
              reason:
                "The source reads this same animator position. Use its keyframed value directly, preserving the authored X and composition-relative Y.",
            });
            continue;
          }
          const missingOffset =
            /^\s*s1\s*=\s*transform\.scale\[0\]\s*\+\s*comp\("([^"\n]+)"\)\.layer\("CONTROLLER"\)\.effect\("(Scale X (?:SRV )?Box 02)"\)\(1\)\s*\/\s*10;\s*s2\s*=\s*transform\.scale\[1\];\s*\[s1,\s*s2\]\s*;?\s*$/.exec(
              expression
            );
          if (
            !missingOffset ||
            property.match !== "scale" ||
            property.value?.t !== "Vec3"
          )
            continue;
          const target = findUnique(comps, missingOffset[1]);
          const controller =
            target && findUnique(target.kind.layers, "CONTROLLER");
          const effects = controller?.props.children.find(
            x => x.match === "effects"
          );
          if (
            !effects ||
            effects.children.some(x => x.name === missingOffset[2])
          )
            continue;
          // This authored expression is an additive adjustment. Its missing
          // unexposed control has a neutral offset of zero; do not guess a scale.
          const template = effects.children.find(
            x =>
              x.match === "ec.control.slider" &&
              x.children?.length === 1 &&
              x.children[0].value?.t === "Scalar"
          );
          if (!template) continue;
          const control = structuredClone(template);
          control.uid = allocate();
          control.name = missingOffset[2];
          control.children[0].uid = allocate();
          control.children[0].value = { t: "Scalar", v: 0 };
          delete control.children[0].keys;
          delete control.children[0].expr;
          effects.children.push(control);
          repairs.push({
            kind: "missing-additive-control",
            comp: target.id,
            layer: controller.id,
            property: control.children[0].uid,
            name: control.name,
            initialValue: 0,
            reason:
              "The purchased graph refers to an absent additive scale control. Restore a neutral, editable offset; do not suppress expression errors.",
          });
        }
      };
      visit(layer.props);
    }
  return { project, repairs };
}

/** The capsule label may differ in spelling from its actual source composition. */
export function adobeMainComposition(project, definition) {
  const comps = Object.values(project.items ?? {}).filter(
    x => x.kind?.type === "Comp"
  );
  const sourceNames = [
    ...new Set(
      Object.values(definition.sourceInfoLocalized ?? {})
        .map(x => x.name)
        .filter(Boolean)
    ),
  ];
  for (const name of [...sourceNames, definition.capsuleName]) {
    const found = comps.filter(x => x.name === name);
    if (found.length === 1) return found[0];
    if (found.length > 1) throw Error("Main composition name is ambiguous");
  }
  throw Error("Main composition is missing");
}
