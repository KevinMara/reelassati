import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { TimelineClip } from "@contracts/workspace";
import { NativeGraphicRenderer } from "@/lib/native-graphic-renderer";
import { useUiText } from "@/lib/i18n/ui";
import {
  nativeGraphicExportActive,
  subscribeNativeGraphicActivity,
} from "@/lib/native-graphic-activity";

export function NativeGraphicLayer({
  clip,
  time,
}: {
  clip: TimelineClip;
  time: number;
}) {
  const ui = useUiText(),
    canvas = useRef<HTMLCanvasElement>(null),
    renderer = useRef<NativeGraphicRenderer | undefined>(undefined);
  const exporting = useSyncExternalStore(
    subscribeNativeGraphicActivity,
    nativeGraphicExportActive,
    () => false
  );
  const [revision, retry] = useState(0),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  const [size, setSize] = useState({ width: 480, height: 270 });
  const latest = useRef<
      | { clip: TimelineClip; time: number; width: number; height: number }
      | undefined
    >(undefined),
    busy = useRef<NativeGraphicRenderer | undefined>(undefined);
  useEffect(() => {
    const node = canvas.current?.parentElement;
    if (!node) return;
    const measure = () => {
      const box = node.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) return;
      const scale = Math.min(1, 720 / box.width);
      setSize({
        width: Math.max(2, Math.round(box.width * scale)),
        height: Math.max(2, Math.round(box.height * scale)),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (exporting) return;
    const worker = new NativeGraphicRenderer();
    renderer.current = worker;
    setError("");
    setReady(false);
    return () => {
      worker.close();
      if (renderer.current === worker) renderer.current = undefined;
    };
  }, [revision, exporting]);
  useEffect(() => {
    latest.current = { clip, time, ...size };
    const worker = renderer.current;
    if (!worker || busy.current === worker) return;
    busy.current = worker;
    setError("");
    void (async () => {
      try {
        while (latest.current && renderer.current === worker) {
          try {
            const request = latest.current;
            latest.current = undefined;
            const c = request.clip,
              elapsed = c.inPoint + (request.time - c.start) * (c.speed ?? 1);
            const frame = await worker.render(
              c.graphic!,
              elapsed,
              c.graphicDuration ?? c.outPoint ?? c.duration,
              request.width,
              request.height
            );
            if (renderer.current !== worker) return;
            const node = canvas.current;
            if (!node) return;
            node.width = frame.width;
            node.height = frame.height;
            node
              .getContext("2d")!
              .putImageData(
                new ImageData(
                  new Uint8ClampedArray(frame.pixels),
                  frame.width,
                  frame.height
                ),
                0,
                0
              );
            setReady(true);
          } catch (e) {
            if (renderer.current === worker && !latest.current)
              setError(e instanceof Error ? e.message : String(e));
          }
        }
      } finally {
        if (busy.current === worker) busy.current = undefined;
      }
    })();
  }, [clip, time, size, revision, exporting]);
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      aria-busy={!ready && !error}
    >
      <canvas
        ref={canvas}
        className="h-full w-full"
        aria-label={clip.graphic?.text || clip.label}
      />
      {!ready && !error && (
        <span
          role="status"
          className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs text-white"
        >
          {ui("Loading animation…")}
        </span>
      )}
      {error && (
        <div
          role="alert"
          className="pointer-events-auto absolute inset-x-2 top-2 rounded bg-background/95 p-2 text-xs"
        >
          <p>{ui(error)}</p>
          <button
            type="button"
            className="mt-1 underline"
            onClick={() => retry(v => v + 1)}
          >
            {ui("Try again")}
          </button>
        </div>
      )}
    </div>
  );
}
