import { describe, expect, it } from "vitest";
import { GLB_LIMITS, validateStaticGlb } from "./glb-validation";
import { DEFAULT_GLB_POSE, normalizeGlbPose } from "./glb-renderer";

function fixture(change?: (document: ReturnType<typeof documentFixture>, binary: Uint8Array) => void): ArrayBuffer {
  const document = documentFixture();
  const binary = new Uint8Array(44);
  new Float32Array(binary.buffer, 0, 9).set([-1, -1, 0, 1, -1, 0, 0, 1, 0]);
  new Uint16Array(binary.buffer, 36, 3).set([0, 1, 2]);
  change?.(document, binary);
  const encoded = new TextEncoder().encode(JSON.stringify(document));
  const jsonBytes = Math.ceil(encoded.length / 4) * 4;
  const result = new ArrayBuffer(28 + jsonBytes + binary.length);
  const view = new DataView(result);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, result.byteLength, true);
  view.setUint32(12, jsonBytes, true); view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(result, 20, jsonBytes).fill(32);
  new Uint8Array(result, 20, encoded.length).set(encoded);
  view.setUint32(20 + jsonBytes, binary.length, true); view.setUint32(24 + jsonBytes, 0x004e4942, true);
  new Uint8Array(result, 28 + jsonBytes).set(binary);
  return result;
}
function documentFixture() {
  return {
    asset: { version: "2.0" }, scene: 0,
    buffers: [{ byteLength: 42 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 6 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" }, { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    nodes: [{ mesh: 0 }] as Record<string, unknown>[], scenes: [{ nodes: [0] }],
  } as Record<string, unknown> & {
    buffers: Record<string, unknown>[]; bufferViews: Record<string, unknown>[];
    accessors: Record<string, unknown>[]; meshes: { primitives: Record<string, unknown>[] }[];
    nodes: Record<string, unknown>[]; scenes: { nodes: number[] }[];
  };
}

describe("bounded static GLB validation", () => {
  it("accepts real indexed embedded geometry and copies the input", () => {
    const original = fixture();
    const result = validateStaticGlb(original);
    expect(result).toMatchObject({ triangles: 1, meshes: 1, images: 0 });
    expect(result.buffer).not.toBe(original);
    new Uint8Array(original).fill(0);
    expect(new DataView(result.buffer).getUint32(0, true)).toBe(0x46546c67);
  });
  it.each([0, 27, GLB_LIMITS.bytes + 1])("rejects invalid source size %i", size => {
    expect(() => validateStaticGlb(new ArrayBuffer(size))).toThrow(/25 MB/);
  });
  it.each([0, 4, 8, 12])("rejects a corrupt binary boundary at %i", offset => {
    const source = fixture(); new DataView(source).setUint32(offset, 123, true);
    expect(() => validateStaticGlb(source)).toThrow(/header|length/);
  });
  it("rejects remote, data and blob URIs before a loader can fetch them", () => {
    for (const uri of ["https://example.com/model.bin", "data:image/png;base64,AA==", "blob:https://example.com/secret"])
      expect(() => validateStaticGlb(fixture(doc => { doc.buffers[0].uri = uri; }))).toThrow(/URLs/);
  });
  it("rejects unsupported compressed extensions in either declaration or nested data", () => {
    expect(() => validateStaticGlb(fixture(doc => { doc.extensionsUsed = ["KHR_draco_mesh_compression"]; }))).toThrow(/compressed/);
    expect(() => validateStaticGlb(fixture(doc => { doc.meshes[0].primitives[0].extensions = { EXT_meshopt_compression: {} }; }))).toThrow(/extension/);
  });
  it("allows the supported unlit material extension", () => {
    expect(validateStaticGlb(fixture(doc => {
      doc.extensionsUsed = ["KHR_materials_unlit"];
      doc.materials = [{ extensions: { KHR_materials_unlit: {} }, pbrMetallicRoughness: { baseColorFactor: [1, 0.2, 0.1, 1] } }];
      doc.meshes[0].primitives[0].material = 0;
    })).triangles).toBe(1);
  });
  it("does not silently flatten animations, skinning or morph targets", () => {
    expect(() => validateStaticGlb(fixture(doc => { doc.animations = [{}]; }))).toThrow(/static pose/);
    expect(() => validateStaticGlb(fixture(doc => { doc.skins = [{}]; }))).toThrow(/static pose/);
    expect(() => validateStaticGlb(fixture(doc => { doc.meshes[0].primitives[0].targets = []; }))).toThrow(/morph/);
  });
  it("bounds accessor references, strides, counts and sparse allocations", () => {
    const changes = [
      (doc: ReturnType<typeof documentFixture>) => { doc.accessors[0].bufferView = 99; },
      (doc: ReturnType<typeof documentFixture>) => { doc.bufferViews[0].byteStride = 256; },
      (doc: ReturnType<typeof documentFixture>) => { doc.accessors[0].count = 1e12; },
      (doc: ReturnType<typeof documentFixture>) => { doc.accessors[0].sparse = { count: 1e12 }; },
      (doc: ReturnType<typeof documentFixture>) => { doc.accessors[0].byteOffset = 4; },
    ];
    for (const change of changes) expect(() => validateStaticGlb(fixture(change))).toThrow(/accessor|stride|Accessor/i);
  });
  it("rejects out of range actual binary index values and nonfinite coordinates", () => {
    expect(() => validateStaticGlb(fixture((_, bytes) => new Uint16Array(bytes.buffer, 36, 3)[2] = 99))).toThrow(/triangle index/);
    expect(() => validateStaticGlb(fixture((_, bytes) => new Float32Array(bytes.buffer)[1] = NaN))).toThrow(/non-finite/);
  });
  it("rejects mismatched attributes and nontriangle primitive modes", () => {
    expect(() => validateStaticGlb(fixture(doc => { doc.accessors[1].count = 2; doc.meshes[0].primitives[0].attributes = { POSITION: 0, NORMAL: 1 }; }))).toThrow(/counts/);
    expect(() => validateStaticGlb(fixture(doc => { doc.meshes[0].primitives[0].mode = 1; }))).toThrow(/triangle meshes/);
  });
  it("rejects cyclic, shared and out of range graph links", () => {
    expect(() => validateStaticGlb(fixture(doc => { doc.nodes[0].children = [0]; }))).toThrow(/cyclic/);
    expect(() => validateStaticGlb(fixture(doc => { doc.nodes.push({ children: [0] }, { children: [0] }); }))).toThrow(/multiple parents/);
    expect(() => validateStaticGlb(fixture(doc => { doc.nodes[0].children = [99]; }))).toThrow(/outside/);
  });
  it("rejects graph recursion and invalid default scenes", () => {
    expect(() => validateStaticGlb(fixture(doc => {
      doc.nodes = Array.from({ length: 66 }, (_, n) => n === 65 ? { mesh: 0 } : { children: [n + 1] });
    }))).toThrow(/64 levels/);
    expect(() => validateStaticGlb(fixture(doc => { doc.scene = 99; }))).toThrow(/Default scene/);
    expect(() => validateStaticGlb(fixture(doc => { doc.scenes[0].nodes = []; }))).toThrow(/no triangle meshes/);
  });
  it("does not let repeated mesh nodes bypass the rendered triangle budget", () => {
    expect(() => validateStaticGlb(fixture(doc => {
      doc.meshes[0].primitives = Array.from({ length: 256 }, () => ({ attributes: { POSITION: 0 }, indices: 1 }));
      doc.nodes = Array.from({ length: 1024 }, () => ({ mesh: 0 }));
      doc.scenes[0].nodes = doc.nodes.map((_, i) => i);
    }))).toThrow(/250,000/);
  });
  it("rejects unsupported image encodings and malformed embedded image headers", () => {
    expect(() => validateStaticGlb(fixture(doc => { doc.images = [{ bufferView: 0, mimeType: "image/svg+xml" }]; }))).toThrow(/PNG and JPEG/);
    expect(() => validateStaticGlb(fixture(doc => { doc.images = [{ bufferView: 0, mimeType: "image/png" }]; }))).toThrow(/PNG/);
  });
  it("validates material and image index references before parsing", () => {
    expect(() => validateStaticGlb(fixture(doc => { doc.textures = [{ source: 99 }]; }))).toThrow(/Texture image/);
    expect(() => validateStaticGlb(fixture(doc => { doc.materials = [{ pbrMetallicRoughness: { baseColorTexture: { index: 99 } } }]; }))).toThrow(/texture index/);
    expect(() => validateStaticGlb(fixture(doc => { doc.meshes[0].primitives[0].material = 99; }))).toThrow(/Primitive material/);
  });
});

describe("GLB pose controls", () => {
  it("retains valid controls without mutating the caller", () => {
    const pose = { yaw: 85, pitch: -30, roll: 10, zoom: 1.5, exposure: 1.1, tint: "#cc5533" };
    expect(normalizeGlbPose(pose)).toEqual(pose);
  });
  it("clamps camera/exposure controls and rejects nonfinite or invalid colors", () => {
    expect(normalizeGlbPose({ yaw: 999, pitch: -999, roll: NaN, zoom: Infinity, exposure: -1, tint: "url(https://example.com)" }))
      .toEqual({ ...DEFAULT_GLB_POSE, yaw: 180, pitch: -180, exposure: 0.25 });
  });
});
