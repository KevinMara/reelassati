import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import type { ClipColorLut } from "@contracts/color-lut";
import { loadColorLut } from "@/lib/color-lut";
import {
  createLutPreviewRenderer,
  type LutPreviewRenderer,
} from "@/lib/lut-preview-renderer";
import { useUiText } from "@/lib/i18n/ui";

export function LutPreview({
  sourceRef,
  reference,
  playing,
  active,
  style,
  onReady,
}: {
  sourceRef: RefObject<HTMLVideoElement | HTMLImageElement | null>;
  reference: ClipColorLut;
  playing: boolean;
  active: boolean;
  style: CSSProperties;
  onReady(ready: boolean): void;
}) {
  const ui = useUiText();
  const canvas = useRef<HTMLCanvasElement>(null);
  const configuration = useRef({ playing, active, amount: reference.amount });
  const refresh = useRef<(() => void) | undefined>(undefined);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [mode, setMode] = useState("loading");
  useLayoutEffect(() => {
    configuration.current = { playing, active, amount: reference.amount };
    refresh.current?.();
  }, [playing, active, reference.amount]);
  useEffect(() => {
    const source = sourceRef.current,
      surface = canvas.current;
    if (!source || !surface) return;
    const controller = new AbortController();
    const video = source instanceof HTMLVideoElement ? source : undefined;
    let renderer: LutPreviewRenderer | undefined;
    let videoFrame: number | undefined, animationFrame: number | undefined;
    let ready = false,
      lastDraw = -Infinity,
      lastTime = -1;
    const cancelFrame = () => {
      if (videoFrame !== undefined) video?.cancelVideoFrameCallback(videoFrame);
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
      videoFrame = animationFrame = undefined;
    };
    const failed = () => {
      if (controller.signal.aborted) return;
      cancelFrame();
      onReady(false);
      setState("failed");
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      failed();
    };
    surface.addEventListener("webglcontextlost", contextLost);
    source.addEventListener("error", failed);
    onReady(false);
    void loadColorLut(
      {
        id: reference.id,
        name: reference.name,
        sha256: reference.sha256,
        amount: 1,
      },
      controller.signal
    )
      .then(lut => {
        if (controller.signal.aborted) return;
        renderer = createLutPreviewRenderer(surface);
        setMode(renderer.mode);
        const draw = (force = false) => {
          if (controller.signal.aborted) return;
          const image = source as HTMLImageElement;
          const width = video?.videoWidth ?? image.naturalWidth;
          const height = video?.videoHeight ?? image.naturalHeight;
          const now = performance.now();
          if (!width || !height || (video && video.readyState < 2)) return;
          if (!force && renderer!.mode === "cpu" && now - lastDraw < 80) return;
          if (!force && video && lastTime === video.currentTime) return;
          renderer!.draw(
            source,
            width,
            height,
            lut,
            configuration.current.amount
          );
          lastDraw = now;
          lastTime = video?.currentTime ?? 0;
          if (!ready) {
            ready = true;
            onReady(true);
            setState("ready");
          }
        };
        const schedule = () => {
          if (
            !video ||
            !configuration.current.playing ||
            !configuration.current.active ||
            controller.signal.aborted ||
            videoFrame !== undefined ||
            animationFrame !== undefined
          )
            return;
          const frame = () => {
            videoFrame = animationFrame = undefined;
            try {
              draw();
              schedule();
            } catch {
              failed();
            }
          };
          if (typeof video.requestVideoFrameCallback === "function")
            videoFrame = video.requestVideoFrameCallback(frame);
          else animationFrame = requestAnimationFrame(frame);
        };
        refresh.current = () => {
          cancelFrame();
          try {
            draw(true);
            schedule();
          } catch {
            failed();
          }
        };
        refresh.current();
      })
      .catch(failed);
    const changed = () => refresh.current?.();
    for (const event of ["loadeddata", "seeked", "resize", "load"])
      source.addEventListener(event, changed);
    return () => {
      controller.abort();
      cancelFrame();
      refresh.current = undefined;
      for (const event of ["loadeddata", "seeked", "resize", "load"])
        source.removeEventListener(event, changed);
      surface.removeEventListener("webglcontextlost", contextLost);
      source.removeEventListener("error", failed);
      renderer?.dispose();
      onReady(false);
    };
  }, [reference.id, reference.name, reference.sha256, sourceRef, onReady]);
  return (
    <>
      <canvas
        ref={canvas}
        data-lut-preview={mode}
        aria-label={reference.name}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{
          ...style,
          visibility: state === "ready" ? undefined : "hidden",
        }}
      />
      {active && state !== "ready" && (
        <p
          role="status"
          className="absolute bottom-2 left-2 right-2 rounded bg-black/80 px-2 py-1 text-center text-[11px] text-white"
        >
          {ui(
            state === "failed"
              ? "Color look preview unavailable"
              : "Loading color look"
          )}
        </p>
      )}
    </>
  );
}
