import { useEffect, useRef, useState } from "react";
import {
  graphicTextLines,
  graphicShapes,
  graphicCardLayout,
} from "@contracts/graphic-layout";
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
  const canvasRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(1);
  useEffect(() => {
    const node = canvasRef.current;
    if (!node) return;
    const measure = () => {
      const box = node.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) setRatio(box.height / box.width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [clip.graphic?.kind]);
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
  const shapes = graphicShapes(g, elapsed, graphicDuration);
  const lines = graphicTextLines(f.text, g.size).split("\n");
  const layout = graphicCardLayout(f.text, g.size, g.padding, g.secondaryText);
  const primary = ![
    "rectangle",
    "ellipse",
    "star",
    "line",
    "arrow",
    "highlight",
  ].includes(g.kind);
  return (
    <div ref={canvasRef} className="pointer-events-none absolute inset-0 z-10">
      <svg
        viewBox={`0 0 1000 ${1000 * ratio}`}
        className="h-full w-full overflow-visible"
        aria-label={g.text || g.kind}
      >
        <g
          opacity={f.opacity}
          transform={`translate(${f.x * 10} ${f.y * 10 * ratio}) rotate(${f.rotation}) scale(${f.scale})`}
        >
          {shapes.map((shape, index) => (
            <polygon
              key={index}
              points={shape.points
                .map(([x, y]) => `${x * 10},${y * 10}`)
                .join(" ")}
              fill={shape.color}
            />
          ))}
          {g.kind === "arrow" && (
            <path
              fill={g.color}
              d="M-125 -12 H37.5 V-60 L125 0 L37.5 60 V12 H-125 Z"
            />
          )}
          {g.kind === "highlight" && (
            <rect
              x={-200}
              y={-75 * ratio}
              width={400}
              height={150 * ratio}
              fill="none"
              stroke={g.color}
              strokeWidth={4.2}
            />
          )}
          {primary && (
            <text
              fill={g.color}
              fontFamily="Editor Sans, DejaVu Sans, sans-serif"
              fontWeight={700}
              fontSize={g.size * 10}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {lines.map((line, index) => (
                <tspan
                  key={index}
                  x={0}
                  y={(index - (lines.length - 1) / 2) * g.size * 12}
                >
                  {line}
                </tspan>
              ))}
            </text>
          )}
          {g.secondaryText && (
            <text
              fill={g.accent ?? g.color}
              fontFamily="Editor Sans, DejaVu Sans, sans-serif"
              fontWeight={400}
              fontSize={g.size * 6}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {layout.secondaryLines.map((line, i) => (
                <tspan
                  key={i}
                  x={0}
                  y={(layout.secondaryY + i * g.size * 0.72) * 10}
                >
                  {line}
                </tspan>
              ))}
            </text>
          )}
        </g>
      </svg>
    </div>
  );
}
