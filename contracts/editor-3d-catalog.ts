export interface Editor3dModel {
  id: string;
  name: string;
  path: string;
  preview: string;
  source: string;
  license: "CC0-1.0";
  creator: string;
  bytes: number;
  sha256: string;
}

/** Original, unmodified core-glTF models. Loaded only after a user selects one. */
export const editor3dModels: readonly Editor3dModel[] = [
  {
    id: "khronos-avocado",
    name: "Avocado",
    path: "/shared-assets/models/khronos/Avocado.glb",
    preview: "/shared-assets/models/khronos/Avocado.jpg",
    source:
      "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/8f492390ddc7a2ae221a1369ef560589cf8c70fb/Models/Avocado",
    license: "CC0-1.0",
    creator: "Microsoft",
    bytes: 8_110_040,
    sha256: "ccc9c3ce56423720b09399c2351537207cd5a65f859f9e6e2f30922762f3abd4",
  },
  {
    id: "khronos-water-bottle",
    name: "Water bottle",
    path: "/shared-assets/models/khronos/WaterBottle.glb",
    preview: "/shared-assets/models/khronos/WaterBottle.jpg",
    source:
      "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/8f492390ddc7a2ae221a1369ef560589cf8c70fb/Models/WaterBottle",
    license: "CC0-1.0",
    creator: "Microsoft",
    bytes: 8_966_700,
    sha256: "b337e526fd6a162013c2984aeec163f5fbb4f717252724dfc3f3458bd51df94b",
  },
];
