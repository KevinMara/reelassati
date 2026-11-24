import data from "./native-matte-data.json";

type Matte = {
  sourceName: string;
  sourceSha256: string;
  width: number;
  height: number;
  frames: number;
  rows: number;
  columns: number;
  inverted: boolean;
  mirrorCanvas?: number[];
  sheets: string[];
};
export type NativeMatteId = keyof typeof data;
export const nativeMattes: Readonly<Record<NativeMatteId, Matte>> = data;
export function isNativeMatteId(id: unknown): id is NativeMatteId {
  return typeof id === "string" && Object.hasOwn(nativeMattes, id);
}

const brushDesigns: Readonly<Record<string, readonly [string, string]>> = {
  "BRUSH 01 L In": [
    "Paint sweep from left",
    "A rough paint edge crosses from left to right, revealing most of the next shot early.",
  ],
  "BRUSH 02 R In": [
    "Mirrored paint sweep",
    "An inverted brush reveals the second shot in broad irregular strokes. The paint mirrors at its edges.",
  ],
  "BRUSH 11": [
    "Scattered ink reveal",
    "Irregular paint openings appear across the frame, merge, and clear the remaining patches.",
  ],
  "BRUSH 17": [
    "Broken paint strokes",
    "Broad separate strokes enter from multiple edges and leave a thin, irregular band before the last reveal.",
  ],
  "BRUSH B": [
    "Quick paint fill",
    "Several broad brush patches already show the next picture at the start and rapidly merge into a complete fill.",
  ],
  "BRUSH D": [
    "Open-center paint wash",
    "A wide irregular opening through the upper middle quickly spreads to the sides and bottom.",
  ],
  "BRUSH E": [
    "Paint around the edges",
    "A painted border grows inward from several sides and leaves a narrowing island of the first picture in the middle.",
  ],
  "BRUSH F": [
    "Diagonal paint wash",
    "A wide brush sweeps diagonally from the upper left, then quickly clears the rest of the frame.",
  ],
  "BRUSH G": [
    "Crossing paint strokes",
    "Two broad strokes expose the upper-left and right areas before the last strips clear at the bottom.",
  ],
  "BRUSH H": [
    "Expanding ink opening",
    "A small irregular opening in the middle expands outward and leaves a brief isolated patch of the first shot.",
  ],
  "BRUSH I": [
    "Ink tail reveal",
    "The authored source opens mostly on the next shot. A brief residual patch disappears at the bottom; the entry is abrupt.",
  ],
  "BRUSH J": [
    "Descending brush edge",
    "A rough horizontal paint edge descends in uneven passes from the top to the bottom.",
  ],
};
export function matteDefinition(id: NativeMatteId) {
  const source = nativeMattes[id];
  const [name, motion] = brushDesigns[source.sourceName];
  return {
    name,
    inputOrder: source.inverted
      ? (["incoming", "outgoing"] as const)
      : (["outgoing", "incoming"] as const),
    intentionalEmptyMidpoint: false,
    description:
      motion +
      " Use for a requested handmade reveal. Keep small type outside the moving edge.",
  };
}
