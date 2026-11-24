// Recover effect-compositing opacity from the source RIFX. The upstream AEP
// importer keeps Fill's own opacity but drops the separate effect blend.
export function sourceFillPulses(bytes) {
  const pulses = new Map();
  const groups = new Set([
    "Egg!",
    "Fold",
    "Item",
    "Sfdr",
    "Layr",
    "tdgp",
    "sspc",
    "tdbs",
    "list",
  ]);
  function chunks(start, end) {
    const nodes = [];
    for (let at = start; at < end;) {
      if (at + 8 > end) throw Error("Truncated Adobe chunk header");
      const tag = bytes.toString("latin1", at, at + 4);
      const size = bytes.readUInt32BE(at + 4);
      const from = at + 8,
        to = from + size;
      if (to > end) throw Error("Truncated Adobe chunk payload");
      const list = tag === "RIFX" || tag === "LIST";
      const type = list ? bytes.toString("latin1", from, from + 4) : tag;
      nodes.push({
        tag: type,
        data: bytes.subarray(from, to),
        children: list && groups.has(type) ? chunks(from + 4, to) : [],
      });
      at = to + (size % 2);
    }
    return nodes;
  }
  function visit(nodes, layer, effect) {
    for (const [i, chunk] of nodes.entries()) {
      const child = tag => chunk.children.find(n => n.tag === tag);
      const marker =
        chunk.tag === "tdmn" && chunk.data.toString("latin1").split("\0")[0];
      if (marker === "ADBE Effect Mask Opacity") {
        if (!layer || effect !== "Fill" || pulses.has(layer))
          throw Error("Unsupported Adobe compositing opacity binding");
        const properties = nodes[i + 1]?.children ?? [];
        const data = properties.find(n => n.tag === "tdb4")?.data;
        const list = properties.find(n => n.tag === "list")?.children;
        const header = list?.find(n => n.tag === "lhd3")?.data;
        const values = list?.find(n => n.tag === "ldat")?.data;
        if (
          !data ||
          data.length < 16 ||
          !header ||
          !values ||
          header.readUInt32BE(8) !== 3 ||
          header.readUInt32BE(16) !== 48 ||
          values.length !== 144
        )
          throw Error("Unsupported Adobe effect-opacity keys");
        const scale = data.readUInt32BE(12);
        const times = [0, 48, 96].map((offset, index) => {
          if (
            !scale ||
            values.readUInt16BE(offset + 4) !== 0x0101 ||
            values.readDoubleBE(offset + 8) !== [0, 100, 0][index]
          )
            throw Error("Unsupported Adobe effect-opacity interpolation");
          return values.readInt32BE(offset) / scale;
        });
        if (!(times[0] < times[1] && times[1] < times[2]))
          throw Error("Invalid Adobe effect-opacity clock");
        pulses.set(layer, times);
      }
      if (!chunk.children.length) continue;
      const name =
        chunk.tag === "Layr" ? child("Utf8")?.data.toString("utf8") : layer;
      const type =
        chunk.tag === "sspc"
          ? child("fnam")?.data.subarray(8).toString("utf8")
          : effect;
      visit(chunk.children, name, type);
    }
  }
  if (
    bytes.toString("latin1", 0, 4) !== "RIFX" ||
    bytes.toString("latin1", 8, 12) !== "Egg!"
  )
    throw Error("Unsupported Adobe project container");
  const end = 8 + bytes.readUInt32BE(4);
  if (end > bytes.length) throw Error("Truncated Adobe project");
  visit(chunks(12, end));
  return pulses;
}

export function restorePhoneFills(main, bytes) {
  if (!main.name.startsWith("[Interface][Notifications][Phone]")) return [];
  const pulses = sourceFillPulses(bytes),
    repairs = [];
  for (const [name, keys] of pulses) {
    const layers = main.kind.layers.filter(l => l.name === name);
    if (
      layers.length !== 1 ||
      layers[0].start_time !== 0 ||
      layers[0].stretch !== 100
    )
      throw Error("Unsupported phone alert layer clock");
    const layer = layers[0];
    const fills = layer.props.children
      .find(g => g.match === "effects")
      ?.children.filter(g => g.match === "ec.generate.fill");
    if (fills?.length !== 2 || fills[1].name !== "Fill Push")
      throw Error("Unsupported phone fill stack");
    const colors = fills.map(g => {
      const get = id => g.children.find(p => p.match === id);
      if (
        get("invert").value.v ||
        get("allMasks").value.v ||
        get("fillMask").value.v ||
        get("opacity").value.v !== 100 ||
        get("opacity").keys?.length ||
        get("opacity").expr?.enabled
      )
        throw Error("Unsupported phone fill blending");
      const color = get("color");
      if (
        !color.expr?.enabled ||
        !/^thisComp\.layer\("Control Layer"\)\.effect\("Colors"\)\(\d+\)$/.test(
          color.expr.text.trim()
        )
      )
        throw Error("Unsupported phone color expression");
      return color;
    });
    const [start, peak, end] = keys;
    const weight = `linear(time,${start},${peak},0,1)-linear(time,${peak},${end},0,1)`;
    colors[1].expr.text = `linear(${weight},0,1,${colors[0].expr.text.trim()},${colors[1].expr.text.trim()})`;
    repairs.push({
      kind: "source-fill-compositing-opacity",
      layer: layer.id,
      keys,
    });
  }
  const box = main.kind.layers.find(layer => layer.name === "Box");
  for (const layer of main.kind.layers) {
    const press =
      pulses.has(layer.name) &&
      ["Box Button", "Button Push"].includes(layer.name);
    const matte = layer.props.children
      .find(g => g.match === "effects")
      ?.children.find(g => g.name === "Set Matte");
    if (!press && !(matte && layer.name.startsWith("Line"))) continue;
    if (!box || layer.track_matte) throw Error("Ambiguous phone-panel matte");
    if (matte) {
      const params = Object.fromEntries(
        matte.children.map(p => [p.match, p.value.v])
      );
      if (
        params.takeMatteFromLayer !== box.id ||
        params.takeMatteFrom !== 3 ||
        params.invertMatte ||
        !params.compositeMatteWithOriginal
      )
        throw Error("Unsupported phone-panel matte");
      matte.enabled = false;
    }
    // Use the rendered panel alpha at the cut. Stretching the line's tiny
    // raster to a mask texture leaves hairlines extending beyond the panel.
    layer.track_matte = { kind: "Alpha", layer: box.id };
    repairs.push({
      kind: "phone-panel-alpha",
      layer: layer.id,
      source: box.id,
    });
    if (!press) continue;
    let merges = 0;
    function disableOperandPaint(group) {
      if (group.match === "fill") group.enabled = false;
      else group.children?.forEach(disableOperandPaint);
    }
    function visit(group) {
      const merge = group.children?.find(p => p.match === "merge");
      if (merge) {
        if (merge.children.find(p => p.match === "mode")?.value.v !== 2)
          throw Error("Unsupported phone button path operation");
        // The press paints the result of the subtraction. Painting the
        // nested operand rectangles too floods the neighboring action rows.
        for (const operand of group.children.slice(
          0,
          group.children.indexOf(merge)
        )) {
          if (operand.match !== "group")
            throw Error("Unsupported phone button operand");
          disableOperandPaint(operand);
        }
        merges++;
      }
      group.children?.forEach(visit);
    }
    visit(layer.props);
    if (merges !== 1) throw Error("Missing phone button subtraction");
    repairs.push({ kind: "phone-button-subtract-paint", layer: layer.id });
  }
  return repairs;
}
