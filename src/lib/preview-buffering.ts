export type PreviewReadiness = "ready" | "loading" | "error";

export interface PreviewSourceReadiness {
  kind: "image" | "media";
  error: boolean;
  readyState?: number;
  seeking?: boolean;
  ended?: boolean;
  complete?: boolean;
  naturalWidth?: number;
}

/** Call with active sources only. A genuine empty timeline interval is ready. */
export function previewReadiness(
  sources: PreviewSourceReadiness[]
): PreviewReadiness {
  if (
    sources.some(
      source =>
        source.error ||
        (source.kind === "image" && source.complete && !source.naturalWidth)
    )
  )
    return "error";
  return sources.some(source =>
    source.kind === "image"
      ? !source.complete || !source.naturalWidth
      : source.seeking || (source.readyState ?? 0) < (source.ended ? 2 : 3)
  )
    ? "loading"
    : "ready";
}

/** Media events don't bubble consistently. Capture them on the preview canvas. */
export function observePreviewReadiness(
  root: HTMLElement,
  report: (state: PreviewReadiness, paused: boolean) => void
) {
  let disposed = false;
  const refresh = () => {
    if (disposed) return;
    const elements = Array.from(
      root.querySelectorAll<HTMLMediaElement | HTMLImageElement>(
        'video[data-preview-state="active"],audio[data-preview-state="active"],img[data-preview-state="active"]'
      )
    );
    report(
      previewReadiness(
        elements.map(element =>
          element instanceof HTMLImageElement
            ? {
                kind: "image",
                complete: element.complete,
                naturalWidth: element.naturalWidth,
                error: false,
              }
            : {
                kind: "media",
                error: !!element.error,
                readyState: element.readyState,
                seeking: element.seeking,
                ended: element.ended,
              }
        )
      ),
      elements.some(
        element =>
          element instanceof HTMLMediaElement &&
          element.paused &&
          !element.ended
      )
    );
  };
  const events = [
    "load",
    "loadedmetadata",
    "loadeddata",
    "canplay",
    "canplaythrough",
    "waiting",
    "seeking",
    "seeked",
    "emptied",
    "error",
    "ended",
    "play",
    "playing",
    "pause",
  ];
  for (const event of events) root.addEventListener(event, refresh, true);
  refresh();
  return {
    refresh,
    dispose() {
      disposed = true;
      for (const event of events)
        root.removeEventListener(event, refresh, true);
    },
  };
}
