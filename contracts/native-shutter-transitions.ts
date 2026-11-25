import graphs from "./native-fusion-shutter.json";

const details: Record<keyof typeof graphs, [string, string]> = {
  "bottom-left-whip": [
    "Diagonal whip down-left",
    "The camera pans down-left across a tiled dissolve. The picture travels up-right with directional blur.",
  ],
  "bottom-right-whip": [
    "Diagonal whip down-right",
    "The camera pans down-right across a tiled dissolve. The picture travels up-left with directional blur.",
  ],
  "top-left-whip": [
    "Diagonal whip up-left",
    "The camera pans up-left. Both shots travel down-right through the blurred cut.",
  ],
  "top-right-whip": [
    "Diagonal whip up-right",
    "The camera pans up-right. Both shots travel down-left through the blurred cut.",
  ],
  "whip-down": [
    "Downward whip",
    "The picture sweeps downward as the shots dissolve with vertical motion blur.",
  ],
  "whip-up": [
    "Upward whip",
    "The picture sweeps upward as the shots dissolve with vertical motion blur.",
  ],
  "whip-left": [
    "Whip pan left",
    "The picture sweeps to the right through a horizontally blurred cut.",
  ],
  "whip-right": [
    "Whip pan right",
    "The picture sweeps to the left through a horizontally blurred cut.",
  ],
  "drag-from-bottom-left": [
    "Bottom-left corner exchange",
    "The incoming picture grows from its bottom-left corner over the receding, tiled outgoing picture.",
  ],
  "drag-from-bottom-right": [
    "Bottom-right corner exchange",
    "The incoming picture expands from its bottom-right corner as the outgoing picture retreats into repeating tiles around the opposite corner.",
  ],
  "drag-from-top-left": [
    "Top-left corner exchange",
    "The incoming picture grows from its top-left corner over the receding, tiled outgoing picture.",
  ],
  "drag-from-top-right": [
    "Top-right corner exchange",
    "The incoming picture grows from its top-right corner as the outgoing picture shrinks away.",
  ],
  "grid-whip": [
    "Sweeping grid dissolve",
    "Both pictures pull back into repeated tiles and drift across the dissolve before returning to full frame.",
  ],
  "spin-dissolve": [
    "Full-turn dissolve",
    "Both shots turn through a complete rotation. The dissolve and motion blur peak near the upside-down midpoint.",
  ],
};

export type NativeShutterId = keyof typeof graphs;
export const shutterIds = Object.keys(graphs) as NativeShutterId[];
export const shutterDefinitions = Object.fromEntries(
  shutterIds.map(id => {
    const [name, motion] = details[id];
    const inputOrder =
      id === "drag-from-bottom-left" || id === "drag-from-bottom-right" || id === "drag-from-top-left"
        ? (["incoming", "outgoing"] as const)
        : (["outgoing", "incoming"] as const);
    return [
      id,
      {
        name,
        inputOrder,
        intentionalEmptyMidpoint: false,
        description:
          motion +
          " Use when the cut follows this movement or the brief requests it. Protect readable text and avoid blurring a visual reveal.",
      },
    ];
  })
) as Record<
  NativeShutterId,
  {
    name: string;
    inputOrder:
      readonly ["incoming", "outgoing"] | readonly ["outgoing", "incoming"];
    description: string;
    intentionalEmptyMidpoint: false;
  }
>;
