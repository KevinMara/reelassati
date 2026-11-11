interface PlaybackScheduler {
  now(): number;
  requestFrame(callback: (now: number) => void): number;
  cancelFrame(id: number): void;
  onTime(time: number): void;
  onEnd(): void;
}

/** Playback advances by elapsed monotonic time, even if a frame is delayed. */
export function createTimelinePlaybackClock(
  initialTime: number,
  initialDuration: number,
  scheduler: PlaybackScheduler
) {
  let duration = initialDuration;
  const bounded = (value: number) => Math.max(0, Math.min(duration, value));
  let time = bounded(initialTime);
  let anchorTime = time;
  let anchorNow = 0;
  let running = false;
  let generation = 0;
  let pending: number | undefined;
  const sample = (now: number) =>
    bounded(anchorTime + Math.max(0, now - anchorNow) / 1000);
  const cancel = () => {
    if (pending !== undefined) scheduler.cancelFrame(pending);
    pending = undefined;
  };
  const frame = (now: number, token: number) => {
    if (!running || token !== generation) return;
    pending = undefined;
    time = sample(now);
    scheduler.onTime(time);
    if (time >= duration) {
      running = false;
      scheduler.onEnd();
    } else pending = scheduler.requestFrame(now => frame(now, token));
  };
  return {
    start() {
      if (running) return;
      running = true;
      anchorTime = time;
      anchorNow = scheduler.now();
      const token = ++generation;
      pending = scheduler.requestFrame(now => frame(now, token));
    },
    stop() {
      if (running) time = sample(scheduler.now());
      running = false;
      generation++;
      cancel();
    },
    seek(nextTime: number) {
      time = bounded(nextTime);
      anchorTime = time;
      anchorNow = scheduler.now();
    },
    setDuration(nextDuration: number) {
      duration = Math.max(0, nextDuration);
      time = bounded(time);
    },
  };
}
