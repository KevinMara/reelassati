/** Editor shortcuts are physical key chords, so Option-produced characters do
 * not change a command and shifted punctuation cannot hide a conflict. */
export const EDITOR_KEYBOARD_ACTIONS = [
  { id: "play", label: "Play / pause", group: "Playback", repeat: false },
  {
    id: "frameBackward",
    label: "Previous frame",
    group: "Playback",
    repeat: true,
  },
  { id: "frameForward", label: "Next frame", group: "Playback", repeat: true },
  {
    id: "secondBackward",
    label: "Back one second",
    group: "Playback",
    repeat: true,
  },
  {
    id: "secondForward",
    label: "Forward one second",
    group: "Playback",
    repeat: true,
  },
  {
    id: "seekBackward",
    label: "Seek backward one second",
    group: "Playback",
    repeat: true,
  },
  {
    id: "seekForward",
    label: "Seek forward one second",
    group: "Playback",
    repeat: true,
  },
  { id: "start", label: "Beginning of edit", group: "Playback", repeat: false },
  { id: "end", label: "End of edit", group: "Playback", repeat: false },
  { id: "split", label: "Split at playhead", group: "Clips", repeat: false },
  {
    id: "trimStart",
    label: "Trim start to playhead",
    group: "Clips",
    repeat: false,
  },
  {
    id: "trimEnd",
    label: "Trim end to playhead",
    group: "Clips",
    repeat: false,
  },
  { id: "delete", label: "Delete selection", group: "Clips", repeat: false },
  {
    id: "rippleDelete",
    label: "Ripple delete across all tracks",
    group: "Clips",
    repeat: false,
  },
  {
    id: "nudgeLeft",
    label: "Nudge selection left one frame",
    group: "Clips",
    repeat: true,
  },
  {
    id: "nudgeRight",
    label: "Nudge selection right one frame",
    group: "Clips",
    repeat: true,
  },
  {
    id: "nudgeSecondLeft",
    label: "Nudge selection left one second",
    group: "Clips",
    repeat: true,
  },
  {
    id: "nudgeSecondRight",
    label: "Nudge selection right one second",
    group: "Clips",
    repeat: true,
  },
  { id: "copy", label: "Copy selection", group: "Clips", repeat: false },
  { id: "cut", label: "Cut selection", group: "Clips", repeat: false },
  { id: "paste", label: "Paste at playhead", group: "Clips", repeat: false },
  {
    id: "duplicate",
    label: "Duplicate selection",
    group: "Clips",
    repeat: false,
  },
  {
    id: "detachAudio",
    label: "Detach video audio",
    group: "Clips",
    repeat: false,
  },
  { id: "mute", label: "Mute / unmute", group: "Clips", repeat: false },
  { id: "lock", label: "Lock / unlock", group: "Clips", repeat: false },
  { id: "group", label: "Group selection", group: "Clips", repeat: false },
  { id: "ungroup", label: "Ungroup selection", group: "Clips", repeat: false },
  { id: "link", label: "Link selected clips", group: "Clips", repeat: false },
  {
    id: "unlink",
    label: "Unlink selected clips",
    group: "Clips",
    repeat: false,
  },
  { id: "deselect", label: "Deselect", group: "Clips", repeat: false },
  { id: "selectAll", label: "Select all clips", group: "Clips", repeat: false },
  { id: "undo", label: "Undo", group: "Workspace", repeat: false },
  { id: "redo", label: "Redo", group: "Workspace", repeat: false },
  {
    id: "snapping",
    label: "Toggle snapping",
    group: "Workspace",
    repeat: false,
  },
  { id: "zoomIn", label: "Zoom timeline in", group: "Workspace", repeat: true },
  {
    id: "zoomOut",
    label: "Zoom timeline out",
    group: "Workspace",
    repeat: true,
  },
  { id: "zoomFit", label: "Fit timeline", group: "Workspace", repeat: false },
  { id: "library", label: "Open Library", group: "Workspace", repeat: false },
  { id: "inspector", label: "Open Adjust", group: "Workspace", repeat: false },
  {
    id: "shortcuts",
    label: "Keyboard shortcuts",
    group: "Workspace",
    repeat: false,
  },
] as const;

export type EditorActionId = (typeof EDITOR_KEYBOARD_ACTIONS)[number]["id"];
export type EditorKeybindings = Record<EditorActionId, string[]>;
export const EDITOR_KEYBINDINGS_STORAGE_KEY =
  "reelassati.editor.keybindings.v1";

export const DEFAULT_EDITOR_KEYBINDINGS: EditorKeybindings = {
  undo: ["Mod+Z"],
  redo: ["Mod+Shift+Z", "Ctrl+Y"],
  selectAll: ["Mod+A"],
  copy: ["Mod+C"],
  cut: ["Mod+X"],
  paste: ["Mod+V"],
  duplicate: ["Mod+D"],
  delete: ["Delete", "Backspace"],
  rippleDelete: ["Shift+Delete", "Shift+Backspace"],
  nudgeLeft: ["Alt+ArrowLeft"],
  nudgeRight: ["Alt+ArrowRight"],
  nudgeSecondLeft: ["Alt+Shift+ArrowLeft"],
  nudgeSecondRight: ["Alt+Shift+ArrowRight"],
  split: ["S"],
  detachAudio: ["Shift+D"],
  lock: ["Shift+L"],
  mute: ["M"],
  trimStart: ["Q"],
  trimEnd: ["W"],
  snapping: ["N"],
  start: ["Home"],
  end: ["End"],
  seekBackward: ["J"],
  seekForward: ["L"],
  play: ["Space", "K"],
  frameBackward: ["ArrowLeft"],
  frameForward: ["ArrowRight"],
  secondBackward: ["Shift+ArrowLeft"],
  secondForward: ["Shift+ArrowRight"],
  zoomIn: ["=", "Shift+=", "NumpadAdd"],
  zoomOut: ["-", "NumpadSubtract"],
  zoomFit: ["0"],
  deselect: ["Escape"],
  library: ["Shift+B"],
  inspector: ["Shift+I"],
  shortcuts: ["Mod+/"],
  group: ["Mod+G"],
  ungroup: ["Mod+Shift+G"],
  link: ["Alt+Shift+G"],
  unlink: ["Alt+Shift+U"],
};

export function createDefaultEditorKeybindings(): EditorKeybindings {
  return Object.fromEntries(
    EDITOR_KEYBOARD_ACTIONS.map(({ id }) => [
      id,
      [...DEFAULT_EDITOR_KEYBINDINGS[id]],
    ])
  ) as EditorKeybindings;
}

type Modifier = "Mod" | "Ctrl" | "Meta" | "Alt" | "Shift";
type Chord = { modifiers: Set<Modifier>; key: string };
const modifierNames: Record<string, Modifier> = {
  mod: "Mod",
  cmdorctrl: "Mod",
  ctrl: "Ctrl",
  control: "Ctrl",
  meta: "Meta",
  cmd: "Meta",
  command: "Meta",
  "⌘": "Meta",
  alt: "Alt",
  option: "Alt",
  shift: "Shift",
};
const shiftedSymbols: Record<string, string> = {
  "+": "=",
  "?": "/",
  _: "-",
  ":": ";",
  '"': "'",
  "<": ",",
  ">": ".",
  "~": "`",
  "|": "\\",
  "{": "[",
  "}": "]",
  "!": "1",
  "@": "2",
  "#": "3",
  $: "4",
  "%": "5",
  "^": "6",
  "&": "7",
  "*": "8",
  "(": "9",
  ")": "0",
};
const specialKeys: Record<string, string> = {
  space: "Space",
  spacebar: "Space",
  esc: "Escape",
  escape: "Escape",
  del: "Delete",
  delete: "Delete",
  backspace: "Backspace",
  enter: "Enter",
  return: "Enter",
  tab: "Tab",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
  arrowleft: "ArrowLeft",
  left: "ArrowLeft",
  "←": "ArrowLeft",
  arrowright: "ArrowRight",
  right: "ArrowRight",
  "→": "ArrowRight",
  arrowup: "ArrowUp",
  up: "ArrowUp",
  "↑": "ArrowUp",
  arrowdown: "ArrowDown",
  down: "ArrowDown",
  "↓": "ArrowDown",
  equal: "=",
  equals: "=",
  minus: "-",
  slash: "/",
  backslash: "\\",
  semicolon: ";",
  quote: "'",
  backquote: "`",
  comma: ",",
  period: ".",
  bracketleft: "[",
  bracketright: "]",
  plus: "+",
  numpadadd: "NumpadAdd",
  numpadsubtract: "NumpadSubtract",
};

function ownLookup<T>(values: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(values, key) ? values[key] : undefined;
}

function parseChord(value: string): Chord | null {
  if (value.length > 80) return null;
  // The plus sign is itself a key: Mod++ and Mod + + are accepted.
  const compact =
    value.trim() === "" && value.length ? "Space" : value.replace(/\s+/g, "");
  const parts = compact.replace(/\+$/, "Plus").split("+");
  if (!parts.length || parts.some(part => !part)) return null;
  const keyName = parts.pop()!;
  const modifiers = new Set<Modifier>();
  for (const name of parts) {
    const modifier = ownLookup(modifierNames, name.toLowerCase());
    if (!modifier || modifiers.has(modifier)) return null;
    modifiers.add(modifier);
  }
  if (modifiers.has("Mod") && (modifiers.has("Ctrl") || modifiers.has("Meta")))
    return null;
  if (modifiers.has("Ctrl") && modifiers.has("Meta")) return null;
  let key = ownLookup(specialKeys, keyName.toLowerCase()) ?? keyName;
  if (/^Key[A-Z]$/i.test(key)) key = key.slice(3);
  if (/^Digit[0-9]$/i.test(key)) key = key.slice(5);
  if (/^[a-z]$/i.test(key)) key = key.toUpperCase();
  else if (/^F(?:[1-9]|1[0-2])$/i.test(key)) key = key.toUpperCase();
  else if (
    !(
      key.length === 1 && /^[0-9=\-/\\;'`,.[\]+?_:"<>~|{}!@#$%^&*()]$/.test(key)
    ) &&
    !Object.values(specialKeys).includes(key)
  )
    return null;
  const shifted = ownLookup(shiftedSymbols, key);
  if (shifted) {
    key = shifted;
    modifiers.add("Shift");
  }
  return { modifiers, key };
}

function serializeChord(chord: Chord): string {
  return [
    ...["Mod", "Ctrl", "Meta", "Alt", "Shift"].filter(m =>
      chord.modifiers.has(m as Modifier)
    ),
    chord.key,
  ].join("+");
}

export function normalizeEditorChord(value: string): string | null {
  const chord = parseChord(value);
  return chord ? serializeChord(chord) : null;
}

function reservedReason({ modifiers, key }: Chord): string | null {
  const command =
    modifiers.has("Mod") || modifiers.has("Ctrl") || modifiers.has("Meta");
  if (
    (command &&
      ["W", "T", "N", "R", "Q", "L"].includes(key) &&
      !modifiers.has("Alt")) ||
    key === "Tab" ||
    (key === "Enter" && !modifiers.size) ||
    ["F1", "F5", "F11", "F12"].includes(key) ||
    (key === "F4" && modifiers.has("Alt")) ||
    (key === "Delete" && modifiers.has("Alt") && command) ||
    (key === "Escape" &&
      modifiers.has("Alt") &&
      (modifiers.has("Meta") || modifiers.has("Mod"))) ||
    (key === "Space" && (modifiers.has("Meta") || modifiers.has("Mod")))
  )
    return "This shortcut is reserved for the browser, system, or keyboard navigation.";
  if (
    key.length === 1 &&
    modifiers.has("Alt") &&
    (modifiers.has("Ctrl") || modifiers.has("Mod"))
  )
    return "Ctrl/Mod + Alt character chords are reserved for typing with AltGr.";
  return null;
}

/** Mod occupies Ctrl on Windows/Linux and Meta on macOS. Check both possible
 * physical chords, even when configuring shortcuts on the other platform. */
function physicalChords(chord: Chord): string[] {
  return (chord.modifiers.has("Mod") ? ["Ctrl", "Meta"] : [null]).map(
    replacement => {
      const modifiers = new Set(chord.modifiers);
      modifiers.delete("Mod");
      if (replacement) modifiers.add(replacement as Modifier);
      return serializeChord({ key: chord.key, modifiers });
    }
  );
}

export type EditorKeybindingError = {
  action?: EditorActionId;
  message: string;
};
export type EditorKeybindingValidation = {
  valid: boolean;
  bindings?: EditorKeybindings;
  errors: EditorKeybindingError[];
};

export function validateEditorKeybindings(
  value: unknown
): EditorKeybindingValidation {
  const errors: EditorKeybindingError[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value))
    return {
      valid: false,
      errors: [{ message: "Shortcut settings must be an action map." }],
    };
  const raw = value as Record<string, unknown>;
  const bindings = {} as EditorKeybindings;
  const occupied = new Map<string, { action: EditorActionId; chord: string }>();
  const knownIds = new Set<string>(
    EDITOR_KEYBOARD_ACTIONS.map(action => action.id)
  );
  if (Object.keys(raw).some(id => !knownIds.has(id)))
    errors.push({ message: "Shortcut settings contain an unknown action." });
  for (const { id, label } of EDITOR_KEYBOARD_ACTIONS) {
    if (!Array.isArray(raw[id]) || raw[id].length > 8) {
      errors.push({
        action: id,
        message: `${label}: supply up to eight shortcuts, or an empty list to disable it.`,
      });
      continue;
    }
    bindings[id] = [];
    for (const value of raw[id]) {
      const chord = typeof value === "string" ? parseChord(value) : null;
      if (!chord) {
        errors.push({
          action: id,
          message: `${label}: use one key with optional Mod, Ctrl, Meta, Alt and Shift modifiers.`,
        });
        continue;
      }
      const normalized = serializeChord(chord);
      const reserved = reservedReason(chord);
      if (reserved)
        errors.push({ action: id, message: `${label}: ${reserved}` });
      const physical = physicalChords(chord);
      const collision = physical.map(key => occupied.get(key)).find(Boolean);
      if (collision) {
        const other = EDITOR_KEYBOARD_ACTIONS.find(
          action => action.id === collision.action
        )!;
        errors.push({
          action: id,
          message: `${label}: ${normalized} conflicts with ${other.label} (${collision.chord}).`,
        });
      } else {
        physical.forEach(key =>
          occupied.set(key, { action: id, chord: normalized })
        );
      }
      bindings[id].push(normalized);
    }
  }
  return errors.length
    ? { valid: false, errors }
    : { valid: true, bindings, errors };
}

export type EditorKeyEvent = {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
  keyCode?: number;
  defaultPrevented?: boolean;
  getModifierState?: (key: string) => boolean;
};

export function editorChordFromEvent(event: EditorKeyEvent): string | null {
  if (
    event.isComposing ||
    event.keyCode === 229 ||
    event.key === "Dead" ||
    event.key === "Process" ||
    event.key === "Unidentified" ||
    event.getModifierState?.("AltGraph") ||
    (event.ctrlKey && event.metaKey) ||
    (event.ctrlKey && event.altKey && event.key.length === 1)
  )
    return null;
  // Physical codes avoid Alt/Option-generated letters and shifted symbols.
  const code = event.code ?? "";
  const rawKey =
    /^(Key[A-Z]|Digit[0-9])$/.test(code) ||
    ownLookup(specialKeys, code.toLowerCase())
      ? code
      : event.key === " "
        ? "Space"
        : event.key;
  const chord = parseChord(rawKey);
  if (!chord) return null;
  if (event.ctrlKey) chord.modifiers.add("Ctrl");
  if (event.metaKey) chord.modifiers.add("Meta");
  if (event.altKey) chord.modifiers.add("Alt");
  if (event.shiftKey) chord.modifiers.add("Shift");
  return serializeChord(chord);
}

export function matchEditorKeybinding(
  event: EditorKeyEvent,
  bindings: EditorKeybindings
): EditorActionId | null {
  if (event.defaultPrevented) return null;
  const pressed = editorChordFromEvent(event);
  if (!pressed) return null;
  for (const { id } of EDITOR_KEYBOARD_ACTIONS) {
    for (const value of bindings[id] ?? []) {
      const chord = parseChord(value);
      if (chord && physicalChords(chord).includes(pressed)) return id;
    }
  }
  return null;
}

type KeybindingStorage = Pick<Storage, "getItem" | "setItem">;
function browserStorage(): KeybindingStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function loadEditorKeybindings(
  storage: KeybindingStorage | undefined = browserStorage()
): EditorKeybindings {
  try {
    const saved = storage?.getItem(EDITOR_KEYBINDINGS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.version === 1) {
        const result = validateEditorKeybindings(parsed.bindings);
        if (result.valid) return result.bindings!;
      }
    }
  } catch {
    /* A blocked or corrupt preference must never break the editor. */
  }
  return createDefaultEditorKeybindings();
}

export function saveEditorKeybindings(
  bindings: EditorKeybindings,
  storage: KeybindingStorage | undefined = browserStorage()
): boolean {
  const result = validateEditorKeybindings(bindings);
  if (!result.valid || !storage) return false;
  try {
    storage.setItem(
      EDITOR_KEYBINDINGS_STORAGE_KEY,
      JSON.stringify({ version: 1, bindings: result.bindings })
    );
    return true;
  } catch {
    return false;
  }
}

export function formatEditorChord(chord: string): string {
  return chord
    .split("+")
    .map(part => (part === "Mod" ? "Ctrl/⌘" : part))
    .join(" + ")
    .replace(/ArrowLeft/g, "←")
    .replace(/ArrowRight/g, "→")
    .replace(/ArrowUp/g, "↑")
    .replace(/ArrowDown/g, "↓")
    .replace(/Escape/g, "Esc");
}
