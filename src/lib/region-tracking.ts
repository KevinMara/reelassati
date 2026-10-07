import {
  observeRegion,
  trackingTemplate,
  type GrayFrame,
  type TrackingRegion,
  type TrackedPoint,
} from "@contracts/region-tracking";

export interface RegionTrackingResult {
  points: TrackedPoint[];
  width: number;
  height: number;
}

export const readDecodedFrame = (
  video: HTMLVideoElement,
  signal: AbortSignal,
  action: () => void,
  seek = false,
  capture?: () => void
) =>
  new Promise<number>((resolve, reject) => {
    let callback = 0,
      finished = false;
    const timeout = globalThis.setTimeout(
      () => finish(new Error("The footage could not be decoded in time.")),
      15000
    );
    const finish = (error?: Error, time?: number) => {
      if (finished) return;
      finished = true;
      globalThis.clearTimeout(timeout);
      video.cancelVideoFrameCallback(callback);
      video.pause();
      video.removeEventListener("error", failed);
      video.removeEventListener("seeked", seeked);
      signal.removeEventListener("abort", aborted);
      if (error) reject(error);
      else resolve(time!);
    };
    const failed = () => finish(new Error("The footage could not be decoded."));
    const aborted = () =>
      finish(new DOMException("Tracking cancelled", "AbortError"));
    const presented: VideoFrameRequestCallback = (_now, metadata) => {
      if (finished) return;
      try {
        capture?.();
        finish(undefined, metadata.mediaTime);
      } catch (error) {
        finish(
          error instanceof Error
            ? error
            : new Error("Could not inspect the decoded frame.")
        );
      }
    };
    const request = () => {
      callback = video.requestVideoFrameCallback(presented);
      void video.play().catch(failed);
    };
    // Register only after seek completion, then present one actual frame. Pixels and
    // mediaTime are captured together; a queued frame from the old seek cannot win.
    const seeked = () => {
      video.cancelVideoFrameCallback(callback);
      request();
    };
    video.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", aborted, { once: true });
    if (seek) video.addEventListener("seeked", seeked, { once: true });
    if (signal.aborted) aborted();
    else {
      action();
      if (!seek) request();
    }
  });

/** Uses decoded presentation timestamps; requested seek times never become keyframes. */
export async function trackVideoRegion(
  url: string,
  start: number,
  end: number,
  region: TrackingRegion,
  signal: AbortSignal,
  onProgress: (progress: number) => void
): Promise<RegionTrackingResult> {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end <= start ||
    end - start > 30
  )
    throw new Error("Track a source interval of up to 30 seconds.");
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.preload = "auto";
  video.muted = true;
  if (typeof video.requestVideoFrameCallback !== "function")
    throw new Error(
      "This browser cannot report decoded frame times. Use a browser with video frame callbacks for tracking."
    );
  video.setAttribute("aria-hidden", "true");
  Object.assign(video.style, {
    position: "fixed",
    width: "1px",
    height: "1px",
    left: "0",
    bottom: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(video);

  try {
    let decodedTime = await readDecodedFrame(video, signal, () => {
      video.src = url;
      video.load();
    });
    if (!Number.isFinite(video.duration) || end > video.duration + 0.05)
      throw new Error(
        "The selected interval extends beyond the source footage."
      );
    const factor = Math.min(
      1,
      480 / Math.max(video.videoWidth, video.videoHeight)
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * factor);
    canvas.height = Math.round(video.videoHeight * factor);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context)
      throw new Error("Frame analysis is unavailable in this browser.");
    const frame = async (
      time: number
    ): Promise<{ frame: GrayFrame; time: number }> => {
      if (signal.aborted)
        throw new DOMException("Tracking cancelled", "AbortError");
      if (Math.abs(video.currentTime - time) > 0.0001)
        decodedTime = await readDecodedFrame(
          video,
          signal,
          () => {
            video.currentTime = time;
          },
          true,
          () => context.drawImage(video, 0, 0, canvas.width, canvas.height)
        );
      else context.drawImage(video, 0, 0, canvas.width, canvas.height);
      let rgba: Uint8ClampedArray;
      try {
        rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      } catch {
        throw new Error(
          "This source does not allow frame analysis. Upload the footage to your media library and try again."
        );
      }
      const pixels = new Uint8Array(canvas.width * canvas.height);
      for (let i = 0; i < pixels.length; i++)
        pixels[i] = Math.round(
          rgba[i * 4] * 0.299 +
            rgba[i * 4 + 1] * 0.587 +
            rgba[i * 4 + 2] * 0.114
        );
      return {
        frame: { width: canvas.width, height: canvas.height, pixels },
        time: decodedTime,
      };
    };
    const first = await frame(start),
      template = trackingTemplate(first.frame, region);
    const points: TrackedPoint[] = [
      {
        time: first.time,
        x:
          (Math.round((region.x + region.width / 2) * canvas.width - 0.5) +
            0.5) /
          canvas.width,
        y:
          (Math.round((region.y + region.height / 2) * canvas.height - 0.5) +
            0.5) /
          canvas.height,
        confidence: 1,
      },
    ];
    const count = Math.ceil((end - start) * 8);
    for (let i = 1; i <= count; i++) {
      const requested = start + ((end - start) * i) / count;
      const decoded = await frame(Math.min(video.duration - 0.001, requested));
      if (decoded.time < points.at(-1)!.time - 0.000001)
        throw new Error(
          "The decoder returned frames out of order. No tracking path was applied."
        );
      if (decoded.time > points.at(-1)!.time + 0.000001) {
        const observed = observeRegion(decoded.frame, template, points.at(-1)!);
        if (!observed)
          throw new Error(
            `Tracking lost the region at ${(decoded.time - first.time).toFixed(1)}s. Choose a more distinctive region or a shorter interval. No path was applied.`
          );
        points.push({ time: decoded.time, ...observed });
      }
      onProgress(i / count);
      await new Promise<void>(resolve => window.setTimeout(resolve, 0));
    }
    if (points.length < 2)
      throw new Error(
        "The source did not provide enough distinct decoded frames to track."
      );
    return { points, width: video.videoWidth, height: video.videoHeight };
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
  }
}
