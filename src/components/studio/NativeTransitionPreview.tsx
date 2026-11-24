import { Play, RotateCcw } from "lucide-react";
import {
  nativeTransitionDefinitions,
  type NativeTransitionId,
} from "@contracts/native-transition-program";
import { useUiText } from "@/lib/i18n/ui";

interface Props {
  id: NativeTransitionId;
  seconds: number;
  playing: boolean;
  onToggle: () => void;
  onEnd: () => void;
}

/** Each strip contains the 14 frames of the authored preset's 0.45-second
 * sample. The library can display every card without retaining GPU contexts. */
export function NativeTransitionPreview({
  id,
  seconds,
  playing,
  onToggle,
  onEnd,
}: Props) {
  const ui = useUiText(),
    name = ui(nativeTransitionDefinitions[id].name);
  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded bg-black">
        <img
          src={`/native-transition-previews/${id}.png`}
          alt={`${name} · ${ui("Preview")}`}
          loading="lazy"
          draggable={false}
          className="absolute inset-y-0 left-0 h-full max-w-none"
          style={{
            width: "1400%",
            transform: "translateX(-42.85714286%)",
            animation: playing
              ? `native-transition-strip ${seconds}s steps(13, end) both`
              : undefined,
          }}
          onAnimationEnd={onEnd}
        />
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-label={`${ui("Preview")} ${name}`}
        aria-pressed={playing}
        className="mt-1 flex items-center gap-1 rounded px-1 py-1 text-[10px] text-foreground/70"
      >
        {playing ? <RotateCcw size={11} /> : <Play size={11} />}{" "}
        {ui(playing ? "Reset preview" : "Preview")}
      </button>
    </div>
  );
}
