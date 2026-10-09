import {
  ACESFilmicToneMapping, Box3, Color, DirectionalLight, Group,
  HemisphereLight, LoadingManager, Material, Mesh, PerspectiveCamera,
  Scene, SRGBColorSpace, Texture, Vector3, WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { validateStaticGlb } from "./glb-validation";

export interface GlbPose {
  yaw: number;
  pitch: number;
  roll: number;
  zoom: number;
  exposure: number;
  tint: string;
}
export const DEFAULT_GLB_POSE: GlbPose = {
  yaw: 0, pitch: 0, roll: 0, zoom: 1, exposure: 1, tint: "#ffffff",
};
export const GLB_POSE_SIZE = 1024;
export interface GlbPoseRenderer {
  render(pose: GlbPose): void;
  png(): Promise<Blob>;
  dispose(): void;
  triangles: number;
  images: number;
}
const clamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

export function normalizeGlbPose(pose: GlbPose): GlbPose {
  return {
    yaw: clamp(pose.yaw, -180, 180, 0),
    pitch: clamp(pose.pitch, -180, 180, 0),
    roll: clamp(pose.roll, -180, 180, 0),
    zoom: clamp(pose.zoom, 0.5, 2, 1),
    exposure: clamp(pose.exposure, 0.25, 2, 1),
    tint: /^#[0-9a-f]{6}$/i.test(pose.tint) ? pose.tint : "#ffffff",
  };
}

/** Real meshes, standard glTF materials and embedded textures, baked to a PNG. */
export async function createGlbPoseRenderer(
  source: ArrayBuffer,
  canvas: HTMLCanvasElement,
): Promise<GlbPoseRenderer> {
  const validated = validateStaticGlb(source);
  const manager = new LoadingManager();
  manager.setURLModifier(url => {
    // GLTFLoader creates object URLs for validated embedded images only.
    if (!url.startsWith(`blob:${window.location.origin}/`))
      throw new Error("External GLB resources are unsupported. Embed textures in the binary file.");
    return url;
  });
  const loader = new GLTFLoader(manager);
  const gltf = await loader.parseAsync(validated.buffer, "");
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const meshes = new Set<Mesh>();
  const colors: { material: Material & { color: Color }; original: Color }[] = [];
  for (const importedScene of gltf.scenes) importedScene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    meshes.add(object);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (materials.has(material)) continue;
      materials.add(material);
      if ("color" in material && material.color instanceof Color)
        colors.push({ material: material as Material & { color: Color }, original: material.color.clone() });
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    }
  });
  let renderer: WebGLRenderer | undefined;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const mesh of meshes) mesh.geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) {
      const image = texture.source.data as { close?: () => void } | undefined;
      image?.close?.();
      texture.dispose();
    }
    renderer?.dispose();
    // The composer reuses one canvas/context when a different model is loaded.
    // Explicitly losing that context would break the next upload on this canvas.
  };
  try {
    gltf.scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(gltf.scene, true);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const radius = size.length() / 2;
    if (!Number.isFinite(radius) || radius < 1e-9 || radius > 1e12 ||
      ![center.x, center.y, center.z].every(Number.isFinite))
      throw new Error("This model has empty or unsupported spatial bounds.");
    const translated = new Group();
    translated.add(gltf.scene);
    translated.position.copy(center).multiplyScalar(-1);
    const model = new Group();
    model.add(translated);
    model.scale.setScalar(1 / radius);
    const scene = new Scene();
    scene.add(model);
    scene.add(new HemisphereLight(0xffffff, 0x566070, 1.6));
    const key = new DirectionalLight(0xffffff, 3.5);
    key.position.set(3, 4, 5);
    scene.add(key);
    const fill = new DirectionalLight(0xffffff, 1);
    fill.position.set(-3, 1, -2);
    scene.add(fill);
    const camera = new PerspectiveCamera(35, 1, 0.01, 100);
    const distance = 1.12 / Math.sin(35 * Math.PI / 360);
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(GLB_POSE_SIZE, GLB_POSE_SIZE, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    const render = (requested: GlbPose) => {
      if (disposed || !renderer) throw new Error("The GLB preview has been closed.");
      const pose = normalizeGlbPose(requested);
      model.rotation.set(pose.pitch * Math.PI / 180, pose.yaw * Math.PI / 180,
        pose.roll * Math.PI / 180, "YXZ");
      const tint = new Color(pose.tint);
      for (const { material, original } of colors) material.color.copy(original).multiply(tint);
      renderer.toneMappingExposure = pose.exposure;
      camera.position.set(0, 0, distance / pose.zoom);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    render(DEFAULT_GLB_POSE);
    return {
      render,
      triangles: validated.triangles,
      images: validated.images,
      dispose,
      png: () => new Promise((resolve, reject) => {
        if (disposed) { reject(new Error("The GLB preview has been closed.")); return; }
        canvas.toBlob(blob => blob?.size ? resolve(blob) : reject(new Error("Could not encode the GLB pose.")), "image/png");
      }),
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
