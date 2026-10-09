/** A deliberately bounded, self-contained static glTF 2.0 import boundary. */
export const GLB_LIMITS = {
  bytes: 25 * 1024 * 1024,
  jsonBytes: 1024 * 1024,
  triangles: 250_000,
  nodes: 1024,
  accessors: 4096,
  scalarValues: 4_000_000,
  images: 32,
  imageEdge: 4096,
  imagePixels: 32 * 1024 * 1024,
} as const;

type RecordValue = Record<string, unknown>;
export interface ValidatedGlb {
  buffer: ArrayBuffer;
  triangles: number;
  images: number;
  meshes: number;
}

function fail(message: string): never {
  throw new Error(`Cannot import this GLB: ${message}`);
}
function record(value: unknown, label: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${label} must be an object.`);
  return value as RecordValue;
}
function list(value: unknown, label: string, limit: number): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > limit)
    fail(`${label} exceeds the supported limit.`);
  return value;
}
function integer(value: unknown, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum)
    fail(`${label} must be a bounded integer.`);
  return value as number;
}
function index(value: unknown, values: unknown[], label: string): number {
  const n = integer(value, label);
  if (n >= values.length) fail(`${label} points outside the file.`);
  return n;
}
function finiteVector(value: unknown, length: number, label: string): void {
  if (value === undefined) return;
  if (
    !Array.isArray(value) || value.length !== length ||
    value.some(n => typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 1e9)
  ) fail(`${label} must contain finite, bounded values.`);
}

function imageDimensions(bytes: Uint8Array, mime: string): [number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === "image/png") {
    if (bytes.length < 33 || view.getUint32(0) !== 0x89504e47 ||
      view.getUint32(4) !== 0x0d0a1a0a || view.getUint32(8) !== 13 ||
      view.getUint32(12) !== 0x49484452)
      fail("an embedded PNG has an invalid header.");
    return [view.getUint32(16), view.getUint32(20)];
  }
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
    fail("an embedded JPEG has an invalid header.");
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 0xff) fail("an embedded JPEG has invalid segments.");
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;
    const size = view.getUint16(offset);
    if (size < 2 || offset + size > bytes.length) fail("a JPEG segment is truncated.");
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (size < 8) fail("a JPEG frame is truncated.");
      return [view.getUint16(offset + 5), view.getUint16(offset + 3)];
    }
    offset += size;
  }
  return fail("the JPEG encoding is unsupported or missing dimensions.");
}

/** Validate before GLTFLoader gets any opportunity to allocate or fetch assets. */
export function validateStaticGlb(input: ArrayBuffer): ValidatedGlb {
  if (input.byteLength < 28 || input.byteLength > GLB_LIMITS.bytes)
    fail("use a binary .glb file no larger than 25 MB.");
  const buffer = input.slice(0);
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== buffer.byteLength)
    fail("the binary glTF 2.0 header or declared length is invalid.");
  let offset = 12;
  let json: RecordValue | undefined;
  let bin: Uint8Array | undefined;
  while (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength) fail("a chunk header is truncated.");
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    offset += 8;
    if (length % 4 || offset + length > buffer.byteLength) fail("a chunk length is invalid.");
    if (type === 0x4e4f534a && !json && !bin) {
      if (length > GLB_LIMITS.jsonBytes) fail("model metadata exceeds 1 MB.");
      try {
        json = record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(
          new Uint8Array(buffer, offset, length)
        )), "Metadata");
      } catch (error) {
        fail(error instanceof Error && error.message.startsWith("Cannot import")
          ? error.message.replace("Cannot import this GLB: ", "")
          : "model metadata is not valid UTF-8 JSON.");
      }
    } else if (type === 0x004e4942 && json && !bin) {
      bin = new Uint8Array(buffer, offset, length);
    } else fail("only one JSON chunk and one embedded binary chunk are supported.");
    offset += length;
  }
  if (!json || !bin) fail("both metadata and embedded geometry are required.");
  const document = json;
  const binary = bin;
  const asset = record(document.asset, "Asset");
  if (asset.version !== "2.0" || (asset.minVersion && asset.minVersion !== "2.0"))
    fail("only glTF 2.0 is supported.");
  // No arbitrary URLs, extension decoders, or deeply nested metadata enter the loader.
  let metadataItems = 0;
  function walk(value: unknown, depth: number): void {
    if (++metadataItems > 50_000 || depth > 64) fail("metadata is too complex.");
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(item => walk(item, depth + 1)); return; }
    for (const [key, entry] of Object.entries(value)) {
      if (key === "uri") fail("external and data URLs are unsupported; embed every asset in the GLB.");
      if (key === "extensions") {
        const extensions = record(entry, "Extensions");
        if (Object.keys(extensions).some(name => name !== "KHR_materials_unlit"))
          fail("this file uses an unsupported extension. Export an uncompressed standard GLB.");
      }
      walk(entry, depth + 1);
    }
  }
  walk(document, 0);
  for (const field of ["extensionsUsed", "extensionsRequired"])
    if (list(document[field], field, 16).some(name => name !== "KHR_materials_unlit"))
      fail("compressed or extended models are unsupported. Export a standard GLB.");
  if (list(document.animations, "Animations", 256).length || list(document.skins, "Skins", 256).length)
    fail("animated and skinned models are unsupported. Export a static pose first.");
  const buffers = list(document.buffers, "Buffers", 1);
  if (buffers.length !== 1) fail("exactly one embedded buffer is required.");
  const declaredBytes = integer(record(buffers[0], "Buffer").byteLength, "Buffer length", 1);
  if (declaredBytes > binary.byteLength || binary.byteLength - declaredBytes > 3)
    fail("embedded buffer length does not match the binary chunk.");
  const views = list(document.bufferViews, "Buffer views", 4096).map((entry, i) => {
    const item = record(entry, `Buffer view ${i}`);
    if (item.buffer !== 0) fail("a buffer view references an absent buffer.");
    const start = integer(item.byteOffset ?? 0, "Buffer view offset");
    const length = integer(item.byteLength, "Buffer view length", 1);
    if (start + length > declaredBytes) fail("a buffer view exceeds the embedded buffer.");
    const stride = item.byteStride === undefined ? undefined : integer(item.byteStride, "Byte stride", 4);
    if (stride !== undefined && (stride > 252 || stride % 4)) fail("byte stride is invalid.");
    return { start, length, stride };
  });
  const dimensions: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const componentBytes: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  let scalarValues = 0;
  const accessors = list(document.accessors, "Accessors", GLB_LIMITS.accessors).map((entry, i) => {
    const item = record(entry, `Accessor ${i}`);
    if (item.sparse !== undefined) fail("sparse accessors are unsupported; export dense geometry.");
    const source = views[index(item.bufferView, views, "Accessor buffer view")];
    const components = typeof item.type === "string" ? dimensions[item.type] : undefined;
    const componentType = integer(item.componentType, "Accessor component type");
    const width = componentBytes[componentType];
    if (!components || !width) fail("an accessor format is unsupported.");
    const count = integer(item.count, "Accessor count", 1);
    scalarValues += count * components;
    if (scalarValues > GLB_LIMITS.scalarValues) fail("accessor data exceeds the supported geometry budget.");
    const start = integer(item.byteOffset ?? 0, "Accessor offset");
    const stride = source.stride ?? components * width;
    if (stride < components * width || start % width || (source.start + start) % width ||
      start + (count - 1) * stride + components * width > source.length)
      fail("an accessor is misaligned or exceeds its buffer view.");
    if (item.normalized !== undefined && typeof item.normalized !== "boolean") fail("accessor normalization is invalid.");
    if (item.normalized && (componentType === 5125 || componentType === 5126)) fail("this accessor cannot be normalized.");
    const data = new DataView(binary.buffer, binary.byteOffset + source.start + start,
      (count - 1) * stride + components * width);
    const read = (n: number, component = 0): number => {
      const at = n * stride + component * width;
      if (componentType === 5126) return data.getFloat32(at, true);
      if (componentType === 5125) return data.getUint32(at, true);
      if (componentType === 5123) return data.getUint16(at, true);
      if (componentType === 5122) return data.getInt16(at, true);
      if (componentType === 5121) return data.getUint8(at);
      return data.getInt8(at);
    };
    if (componentType === 5126)
      for (let n = 0; n < count; n++) for (let c = 0; c < components; c++)
        if (!Number.isFinite(read(n, c)) || Math.abs(read(n, c)) > 1e9)
          fail("geometry contains non-finite or extreme coordinates.");
    finiteVector(item.min, components, "Accessor minimum");
    finiteVector(item.max, components, "Accessor maximum");
    return { count, components, componentType, normalized: item.normalized === true, read };
  });
  const images = list(document.images, "Images", GLB_LIMITS.images);
  let imagePixels = 0;
  images.forEach(entry => {
    const item = record(entry, "Image");
    if (item.mimeType !== "image/png" && item.mimeType !== "image/jpeg")
      fail("only embedded PNG and JPEG textures are supported.");
    const source = views[index(item.bufferView, views, "Image buffer view")];
    if (source.stride !== undefined) fail("an image buffer view cannot be interleaved.");
    const [width, height] = imageDimensions(binary.subarray(source.start, source.start + source.length), item.mimeType);
    imagePixels += width * height;
    if (!width || !height || width > GLB_LIMITS.imageEdge || height > GLB_LIMITS.imageEdge || imagePixels > GLB_LIMITS.imagePixels)
      fail("textures exceed the 4096-pixel edge or total decoded image budget.");
  });
  const samplers = list(document.samplers, "Samplers", 64);
  samplers.forEach(entry => {
    const item = record(entry, "Sampler");
    for (const field of ["wrapS", "wrapT"])
      if (item[field] !== undefined && ![33071, 33648, 10497].includes(item[field] as number)) fail("texture wrapping is invalid.");
    if (item.magFilter !== undefined && ![9728, 9729].includes(item.magFilter as number)) fail("texture filtering is invalid.");
    if (item.minFilter !== undefined && ![9728, 9729, 9984, 9985, 9986, 9987].includes(item.minFilter as number)) fail("texture filtering is invalid.");
  });
  const textures = list(document.textures, "Textures", 64);
  textures.forEach(entry => {
    const item = record(entry, "Texture");
    index(item.source, images, "Texture image");
    if (item.sampler !== undefined) index(item.sampler, samplers, "Texture sampler");
  });
  const materials = list(document.materials, "Materials", 128);
  materials.forEach(entry => {
    const item = record(entry, "Material");
    if (item.alphaMode !== undefined && !["OPAQUE", "MASK", "BLEND"].includes(item.alphaMode as string)) fail("material alpha mode is invalid.");
    const pbr = item.pbrMetallicRoughness === undefined ? {} : record(item.pbrMetallicRoughness, "PBR material");
    finiteVector(pbr.baseColorFactor, 4, "Material base color");
    finiteVector(item.emissiveFactor, 3, "Material emission");
    for (const [object, fields] of [[pbr, ["baseColorTexture", "metallicRoughnessTexture"]], [item, ["normalTexture", "occlusionTexture", "emissiveTexture"]]] as const)
      for (const field of fields) if (object[field] !== undefined) {
        const texture = record(object[field], "Material texture");
        index(texture.index, textures, "Material texture index");
        if (texture.texCoord !== undefined && ![0, 1].includes(texture.texCoord as number)) fail("only texture UV sets 0 and 1 are supported.");
      }
    for (const [object, field] of [[pbr, "metallicFactor"], [pbr, "roughnessFactor"], [item, "alphaCutoff"]] as const)
      if (object[field] !== undefined && (typeof object[field] !== "number" || !Number.isFinite(object[field]) || object[field] < 0 || object[field] > 1))
        fail("material values must be between zero and one.");
  });
  const meshes = list(document.meshes, "Meshes", 256);
  let primitiveCount = 0;
  const meshPrimitiveCounts: number[] = [];
  const meshTriangles = meshes.map(entry => {
    const item = record(entry, "Mesh");
    if (item.weights !== undefined) fail("morph targets are unsupported; export a static pose first.");
    const primitives = list(item.primitives, "Mesh primitives", 256);
    if (!primitives.length) fail("a mesh has no geometry.");
    primitiveCount += primitives.length;
    if (primitiveCount > 4096) fail("the model contains too many mesh primitives.");
    meshPrimitiveCounts.push(primitives.length);
    let triangles = 0;
    primitives.forEach(entry => {
      const primitive = record(entry, "Primitive");
      if (primitive.mode !== undefined && primitive.mode !== 4) fail("only triangle meshes are supported.");
      if (primitive.targets !== undefined) fail("morph targets are unsupported; export a static pose first.");
      const attributes = record(primitive.attributes, "Mesh attributes");
      const position = accessors[index(attributes.POSITION, accessors, "Position accessor")];
      if (position.components !== 3 || position.componentType !== 5126 || position.normalized)
        fail("mesh positions must be float VEC3 coordinates.");
      for (const [name, accessorIndex] of Object.entries(attributes)) {
        if (!/^(POSITION|NORMAL|TANGENT|TEXCOORD_[01]|COLOR_0)$/.test(name))
          fail("skinning and unsupported vertex attributes must be baked into a static model.");
        const accessor = accessors[index(accessorIndex, accessors, "Vertex accessor")];
        if (accessor.count !== position.count) fail("vertex attribute counts do not match.");
        const expected = name === "TANGENT" ? 4 : name.startsWith("TEXCOORD") ? 2 : 3;
        if (accessor.components !== expected && !(name === "COLOR_0" && accessor.components === 4)) fail("a vertex attribute has an invalid shape.");
        if (["POSITION", "NORMAL", "TANGENT"].includes(name) && accessor.componentType !== 5126) fail("positions, normals and tangents must use floats.");
      }
      let vertices = position.count;
      if (primitive.indices !== undefined) {
        const indices = accessors[index(primitive.indices, accessors, "Index accessor")];
        if (indices.components !== 1 || ![5121, 5123, 5125].includes(indices.componentType) || indices.normalized)
          fail("triangle indices must be unsigned scalar values.");
        vertices = indices.count;
        for (let n = 0; n < vertices; n++) if (indices.read(n) >= position.count)
          fail("a triangle index points outside its vertex array.");
      }
      if (vertices % 3) fail("triangle vertex counts must be divisible by three.");
      triangles += vertices / 3;
      if (primitive.material !== undefined) index(primitive.material, materials, "Primitive material");
    });
    return triangles;
  });
  const nodes = list(document.nodes, "Nodes", GLB_LIMITS.nodes);
  const parent = new Set<number>();
  let triangles = 0;
  let renderedPrimitives = 0;
  const children = nodes.map(entry => {
    const node = record(entry, "Node");
    if (node.skin !== undefined || node.weights !== undefined) fail("animated and skinned models must be baked first.");
    if (node.matrix !== undefined && ["translation", "rotation", "scale"].some(key => node[key] !== undefined)) fail("a node cannot mix matrix and TRS transforms.");
    finiteVector(node.matrix, 16, "Node matrix");
    finiteVector(node.translation, 3, "Node translation");
    finiteVector(node.rotation, 4, "Node rotation");
    finiteVector(node.scale, 3, "Node scale");
    if (node.mesh !== undefined) {
      const meshIndex = index(node.mesh, meshes, "Node mesh");
      triangles += meshTriangles[meshIndex];
      renderedPrimitives += meshPrimitiveCounts[meshIndex];
    }
    return list(node.children, "Node children", GLB_LIMITS.nodes).map(child => {
      const n = index(child, nodes, "Child node");
      if (parent.has(n)) fail("nodes cannot have multiple parents or duplicate child references.");
      parent.add(n);
      return n;
    });
  });
  if (!triangles || triangles > GLB_LIMITS.triangles) fail("use a model containing at most 250,000 rendered triangles.");
  if (renderedPrimitives > 4096) fail("the model contains too many rendered mesh instances.");
  const active = new Set<number>(), visited = new Set<number>();
  function visit(n: number, depth: number): void {
    if (active.has(n) || depth > 64) fail("the node graph is cyclic or deeper than 64 levels.");
    if (visited.has(n)) return;
    active.add(n);
    children[n].forEach(child => visit(child, depth + 1));
    active.delete(n); visited.add(n);
  }
  nodes.forEach((_, n) => visit(n, 0));
  const scenes = list(document.scenes, "Scenes", 32);
  if (!scenes.length) fail("the model must contain a scene.");
  scenes.forEach(entry => {
    const roots = list(record(entry, "Scene").nodes, "Scene roots", GLB_LIMITS.nodes);
    const seen = new Set<number>();
    roots.forEach(root => {
      const n = index(root, nodes, "Scene root");
      if (seen.has(n) || parent.has(n)) fail("scene roots must be unique top-level nodes.");
      seen.add(n);
    });
  });
  const defaultScene = record(scenes[index(document.scene ?? 0, scenes, "Default scene")], "Default scene");
  let visibleMesh = false;
  function checkVisible(n: number): void {
    if (record(nodes[n], "Node").mesh !== undefined) visibleMesh = true;
    children[n].forEach(checkVisible);
  }
  list(defaultScene.nodes, "Default scene roots", GLB_LIMITS.nodes).forEach(n => checkVisible(n as number));
  if (!visibleMesh) fail("the default scene contains no triangle meshes.");
  return { buffer, triangles, images: images.length, meshes: meshes.length };
}
