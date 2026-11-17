import { useEffect, useRef, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import {
  nativeTransitionDefinitions,
  nativeTransitionProgram,
  type NativeTransitionId,
} from "@contracts/native-transition-program";
import { createNativeFrameRenderer } from "@/lib/native-frame-renderer";
import { useUiText } from "@/lib/i18n/ui";

/** Actual graph preview. The sample artwork is generated locally; no external
 * files, video service or native application is involved. */
export function NativeTransitionPreview({
  id,
  seconds,
}: {
  id: NativeTransitionId;
  seconds: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    ui = useUiText();
  const [playing, setPlaying] = useState(false),
    [error, setError] = useState("");
  const definition = nativeTransitionDefinitions[id];
  useEffect(() => {
    if (!canvas.current) return;
    let frame = 0,
      disposed = false;
    let renderer: ReturnType<typeof createNativeFrameRenderer> | undefined;
    try {
      const width = 240,
        height = 135;
      const pictures = ["outgoing", "incoming"].map((role, i) => {
        const sample = new OffscreenCanvas(width, height),
          c = sample.getContext("2d")!;
        c.fillStyle = i ? "#15333c" : "#30224e";
        c.fillRect(0, 0, width, height);
        c.fillStyle = i ? "#72d9c4" : "#b6a0ff";
        c.beginPath();
        c.arc(i ? 166 : 74, 67, 34, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#ffffff";
        c.font = "600 14px sans-serif";
        c.fillText(i ? "B" : "A", i ? 161 : 69, 72);
        return { role, sample };
      });
      const inputs = definition.inputOrder.map(
        role => pictures.find(p => p.role === role)!.sample
      ) as [OffscreenCanvas, OffscreenCanvas];
      const program = nativeTransitionProgram(
        id,
        Math.max(2, Math.ceil(seconds * 30)),
        30
      );
      renderer = createNativeFrameRenderer(canvas.current, width, height);
      const draw = (time: number) =>
        renderer!.render(
          program,
          inputs,
          Math.min(
            program.frames - 1,
            Math.max(0, time / seconds) * (program.frames - 1)
          )
        );
      setError("");
      draw(0);
      if (playing) {
        const start = performance.now();
        const tick = (now: number) => {
          if (disposed) return;
          try {
            const time = (now - start) / 1000;
            draw(Math.min(seconds, time));
            if (time >= seconds + 0.7) {
              setPlaying(false);
              return;
            }
            frame = requestAnimationFrame(tick);
          } catch (cause) {
            setError(
              cause instanceof Error ? cause.message : "Preview unavailable"
            );
            setPlaying(false);
          }
        };
        frame = requestAnimationFrame(tick);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Preview unavailable");
    }
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      renderer?.dispose();
    };
  }, [id, seconds, playing, definition]);
  return (
    <div>
      <canvas
        ref={canvas}
        className="aspect-video w-full rounded bg-black"
        aria-label={`${ui(definition.name)} · ${ui("Preview")}`}
      />
      <button
        type="button"
        onClick={() => setPlaying(p => !p)}
        aria-label={`${ui("Preview")} ${ui(definition.name)}`}
        className="mt-1 flex items-center gap-1 rounded px-1 py-1 text-[10px] text-foreground/70"
      >
        {playing ? <RotateCcw size={11} /> : <Play size={11} />}{" "}
        {ui(playing ? "Reset preview" : "Preview")}
      </button>
      {error && (
        <p role="alert" className="text-[10px] text-destructive">
          {ui("This browser could not prepare the transition preview.")}
        </p>
      )}
    </div>
  );
}
