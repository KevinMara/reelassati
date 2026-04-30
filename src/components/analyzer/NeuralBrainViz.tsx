import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Stylized 3D cortical-surface visualization.
 * Not anatomically accurate — uses a deformed sphere approximating a brain
 * with vertex colors driven by mock region "activations" that pulse over time.
 *
 * Designed to look science-y, not clinical. Performance-friendly:
 * single mesh, ~6000 vertices, vertex colors updated each frame.
 */

// 15 mock "functional regions" with seed positions + activation curves
const REGIONS = [
  { name: "V1 visual", pos: [0, -0.2, -1] as const },
  { name: "MT motion", pos: [0.7, -0.1, -0.8] as const },
  { name: "FFA face", pos: [0.6, -0.3, 0.2] as const },
  { name: "STS social", pos: [0.85, 0.0, 0.0] as const },
  { name: "VWFA text", pos: [-0.6, -0.3, 0.3] as const },
  { name: "A1 audio", pos: [0.9, 0.1, 0.3] as const },
  { name: "Broca lang", pos: [-0.7, 0.2, 0.4] as const },
  { name: "Wernicke", pos: [-0.85, 0.0, 0.0] as const },
  { name: "vmPFC value", pos: [0.0, 0.5, 0.85] as const },
  { name: "NAcc reward", pos: [0.0, 0.0, 0.3] as const },
  { name: "Amygdala", pos: [0.3, -0.4, 0.0] as const },
  { name: "ACC conflict", pos: [0.0, 0.4, 0.4] as const },
  { name: "dlPFC ctrl", pos: [-0.5, 0.6, 0.5] as const },
  { name: "TPJ ToM", pos: [0.85, 0.3, -0.2] as const },
  { name: "PCC self", pos: [0.0, 0.2, -0.7] as const },
];

function BrainMesh({ time, intensities }: { time: number; intensities: number[] }) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Build a deformed sphere geometry once
  const { geometry, basePositions } = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 64, 48);
    // Deform to look brain-like (asymmetric, with a slight central sulcus)
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      // gyri/sulci wrinkle pattern
      const wrinkle =
        Math.sin(v.x * 8 + v.y * 5) * 0.04 +
        Math.sin(v.y * 9 - v.z * 6) * 0.03 +
        Math.sin(v.z * 7 + v.x * 4) * 0.025;
      // Slight elongation back-front
      const stretch = 1 + Math.abs(v.z) * 0.05;
      // Central longitudinal fissure (gap at x=0 on top)
      const fissure = v.y > 0.4 ? -Math.exp(-Math.abs(v.x) * 12) * 0.05 : 0;
      v.multiplyScalar(1 + wrinkle + fissure).multiplyScalar(stretch);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    // Init color attribute
    const colors = new Float32Array(pos.count * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const base = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      base[i * 3] = pos.getX(i);
      base[i * 3 + 1] = pos.getY(i);
      base[i * 3 + 2] = pos.getZ(i);
    }
    return { geometry: geo, basePositions: base };
  }, []);

  // Update vertex colors each frame from region intensities
  useFrame(() => {
    const colorAttr = geometry.attributes.color as THREE.BufferAttribute;
    const posAttr = geometry.attributes.position as THREE.BufferAttribute;

    // Cool base (cream/grey)
    const baseR = 0.78, baseG = 0.74, baseB = 0.70;
    // Hot (amethyst → magenta)
    const hotR = 0.55, hotG = 0.30, hotB = 0.85;

    for (let i = 0; i < posAttr.count; i++) {
      const x = basePositions[i * 3];
      const y = basePositions[i * 3 + 1];
      const z = basePositions[i * 3 + 2];

      let heat = 0;
      for (let r = 0; r < REGIONS.length; r++) {
        const [rx, ry, rz] = REGIONS[r].pos;
        const d2 = (x - rx) ** 2 + (y - ry) ** 2 + (z - rz) ** 2;
        const falloff = Math.exp(-d2 * 8);
        heat += falloff * intensities[r];
      }
      heat = Math.min(1, heat);

      colorAttr.setXYZ(
        i,
        baseR + (hotR - baseR) * heat,
        baseG + (hotG - baseG) * heat,
        baseB + (hotB - baseB) * heat,
      );
    }
    colorAttr.needsUpdate = true;

    // Gentle continuous rotation
    if (meshRef.current) {
      meshRef.current.rotation.y = time * 0.15;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        roughness={0.55}
        metalness={0.05}
        flatShading={false}
      />
    </mesh>
  );
}

function Scene({ intensities }: { intensities: number[] }) {
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
  });
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 4, 5]} intensity={0.7} />
      <directionalLight position={[-3, -2, -2]} intensity={0.25} color="#9b87f5" />
      <BrainMesh time={t.current} intensities={intensities} />
    </>
  );
}

export function NeuralBrainViz({
  intensities,
  className,
  size = 320,
}: {
  intensities: number[]; // length 15, 0..1 each
  className?: string;
  size?: number;
}) {
  // Pad/clip to 15
  const safe = useMemo(() => {
    const arr = [...intensities];
    while (arr.length < REGIONS.length) arr.push(0);
    return arr.slice(0, REGIONS.length);
  }, [intensities]);

  return (
    <div className={className} style={{ width: size, height: size }}>
      <Canvas camera={{ position: [0, 0, 3], fov: 35 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <Scene intensities={safe} />
          <OrbitControls enablePan={false} enableZoom={false} autoRotate={false} />
        </Suspense>
      </Canvas>
    </div>
  );
}

export const BRAIN_REGIONS = REGIONS;
