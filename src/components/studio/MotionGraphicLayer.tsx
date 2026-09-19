import { graphicFrame, normalizeGraphic } from "@contracts/motion-graphics";
import type { TimelineClip } from "@contracts/workspace";
import {
  isSpatialGraphic,
  spatialGraphicFrame,
  spatialSvgPath,
} from "@contracts/spatial-graphics";
export function MotionGraphicLayer({
  clip,
  time,
}: {
  clip: TimelineClip;
  time: number;
}) {
  const g = normalizeGraphic(clip.graphic);
  if (!g) return null;
  const elapsed = clip.inPoint + (time - clip.start) * (clip.speed ?? 1);
  const graphicDuration =
    clip.graphicDuration ?? clip.outPoint ?? clip.duration;
  if (isSpatialGraphic(g)) {
    const spatial = spatialGraphicFrame(g, elapsed, graphicDuration);
    return (
      <div
        className="pointer-events-none absolute z-10 aspect-square w-full"
        style={{
          left: `${spatial.x}%`,
          top: `${spatial.y}%`,
          transform: "translate(-50%,-50%)",
          opacity: spatial.opacity,
        }}
      >
        <svg
          viewBox="-3 -3 6 6"
          className="h-full w-full overflow-visible"
          aria-label={`3D ${g.kind.slice(8)}`}
        >
          {spatial.faces.map((face, index) => (
            <path
              key={index}
              d={spatialSvgPath(face.contours)}
              fill={face.color}
              fillRule="nonzero"
            />
          ))}
        </svg>
      </div>
    );
  }
  const f = graphicFrame(g, elapsed, graphicDuration);
  return (
    <div
      className="pointer-events-none absolute z-10 text-center font-bold"
      style={{
        left: `${f.x}%`,
        top: `${f.y}%`,
        transform: `translate(-50%,-50%) rotate(${f.rotation}deg) scale(${f.scale})`,
        opacity: f.opacity,
        color: g.color,
        fontFamily: '"Editor Sans", sans-serif',
        fontSize: `${g.size}cqw`,
        lineHeight: 1.2,
        whiteSpace: "pre-wrap",
        maxWidth: "90%",
        textShadow: g.kind === "text" ? "0 1px 2px black" : undefined,
        background: g.kind === "callout" ? g.background : undefined,
        padding: g.kind === "callout" ? "1.5cqw" : undefined,
        width:
          g.kind === "highlight"
            ? "40%"
            : g.kind === "arrow"
              ? "25%"
              : undefined,
        height: g.kind === "highlight" ? "15%" : undefined,
        border:
          g.kind === "highlight" ? "0.42cqw solid currentColor" : undefined,
      }}
    >
      {g.kind === "arrow" ? (
        <svg viewBox="0 0 100 48" aria-label="Arrow">
          <path
            fill="currentColor"
            d="M0 19.2 H65 V0 L100 24 L65 48 V28.8 H0 Z"
          />
        </svg>
      ) : g.kind === "highlight" ? null : (
        f.text
      )}
    </div>
  );
}
