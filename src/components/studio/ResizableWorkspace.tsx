import {
  useState,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type PointerEvent,
} from "react";
import { useUiText } from "@/lib/i18n/ui";

type Sizes = { media: number; chat: number; height: number };
const defaultSizes = (): Sizes => ({
  media: 276,
  chat: 340,
  height:
    typeof window === "undefined"
      ? 440
      : Math.max(300, Math.min(440, window.innerHeight - 285)),
});
const storageKey = "reelassati:editor-panels:v3";
function persistSizes(sizes: Sizes | null) {
  try {
    if (sizes) localStorage.setItem(storageKey, JSON.stringify(sizes));
    else localStorage.removeItem(storageKey);
  } catch {
    // The panels remain usable when browser storage is unavailable or full.
  }
}
export function ResizableWorkspace({
  children,
  mediaHidden,
}: {
  children: ReactNode;
  mediaHidden: boolean;
}) {
  const ui = useUiText();
  const [sizes, setSizes] = useState<Sizes>(() => {
    const defaults = defaultSizes();
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
      return Object.fromEntries(
        Object.entries(defaults).map(([key, value]) => [
          key,
          typeof saved[key] === "number" && Number.isFinite(saved[key])
            ? Math.max(
                key === "height" ? 300 : 220,
                Math.min(key === "height" ? 900 : 600, saved[key])
              )
            : value,
        ])
      ) as Sizes;
    } catch {
      return defaults;
    }
  });
  const stopDragging = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => stopDragging.current?.(), []);
  function bounded(key: keyof Sizes, value: number) {
    return Math.round(
      Math.max(
        key === "height" ? 300 : 220,
        Math.min(key === "height" ? 900 : 600, value)
      )
    );
  }
  function drag(event: PointerEvent<HTMLDivElement>, key: keyof Sizes) {
    if (event.button !== 0) return;
    event.preventDefault();
    stopDragging.current?.();
    event.currentTarget.setPointerCapture(event.pointerId);
    const handle = event.currentTarget;
    const panel = handle.parentElement
      ?.querySelector(
        key === "height" ? "#editor-preview-panel" : `#editor-${key}-panel`
      )
      ?.getBoundingClientRect();
    const origin = {
      x: event.clientX,
      y: event.clientY,
      value: panel
        ? key === "height"
          ? panel.height
          : panel.width
        : sizes[key],
    };
    let next = sizes;
    const move = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      const delta =
        key === "height"
          ? e.clientY - origin.y
          : (e.clientX - origin.x) * (key === "chat" ? -1 : 1);
      next = { ...sizes, [key]: bounded(key, origin.value + delta) };
      setSizes(next);
    };
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
      handle.removeEventListener("lostpointercapture", stop);
      if (handle.hasPointerCapture(event.pointerId))
        handle.releasePointerCapture(event.pointerId);
      stopDragging.current = undefined;
      persistSizes(next);
    };
    stopDragging.current = stop;
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop, { once: true });
    handle.addEventListener("pointercancel", stop, { once: true });
    handle.addEventListener("lostpointercapture", stop, { once: true });
  }
  return (
    <div
      className="editor-workspace"
      data-media-hidden={mediaHidden}
      style={
        {
          "--editor-media": `${sizes.media}px`,
          "--editor-chat": `${sizes.chat}px`,
          "--editor-upper": `${sizes.height}px`,
        } as CSSProperties
      }
    >
      {children}
      {(["media", "chat", "height"] as const).map(key => (
        <div
          tabIndex={0}
          key={key}
          role="slider"
          aria-label={
            key === "height"
              ? ui("Resize timeline panel")
              : key === "media"
                ? ui("Resize media panel")
                : ui("Resize chat panel")
          }
          aria-controls={
            key === "height" ? "editor-preview-panel" : `editor-${key}-panel`
          }
          aria-orientation={key === "height" ? "vertical" : "horizontal"}
          aria-valuenow={sizes[key]}
          aria-valuemin={key === "height" ? 300 : 220}
          aria-valuemax={key === "height" ? 900 : 600}
          className={`editor-resizer editor-resizer-${key}`}
          onPointerDown={event => drag(event, key)}
          onDoubleClick={() => {
            stopDragging.current?.();
            setSizes(defaultSizes());
            persistSizes(null);
          }}
          onKeyDown={event => {
            const keys =
              key === "height"
                ? ["ArrowUp", "ArrowDown"]
                : ["ArrowLeft", "ArrowRight"];
            if (!keys.includes(event.key)) return;
            event.preventDefault();
            const direction = ["ArrowLeft", "ArrowUp"].includes(event.key)
              ? -1
              : 1;
            const next = {
              ...sizes,
              [key]: bounded(
                key,
                sizes[key] + direction * 20 * (key === "chat" ? -1 : 1)
              ),
            };
            setSizes(next);
            persistSizes(next);
          }}
        >
          <span />
        </div>
      ))}
    </div>
  );
}
