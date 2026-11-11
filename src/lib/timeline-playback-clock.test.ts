import { describe, expect, it, vi } from "vitest";
import { createTimelinePlaybackClock } from "./timeline-playback-clock";

function setup(time = 0, duration = 20) {
  let now = 1000;
  let id = 0;
  const frames = new Map<number, (now: number) => void>();
  const onTime = vi.fn();
  const onEnd = vi.fn();
  const clock = createTimelinePlaybackClock(time, duration, {
    now: () => now,
    requestFrame: callback => {
      frames.set(++id, callback);
      return id;
    },
    cancelFrame: handle => {
      frames.delete(handle);
    },
    onTime,
    onEnd,
  });
  return {
    clock,
    frames,
    onTime,
    onEnd,
    advance(milliseconds: number) {
      now += milliseconds;
      const pending = [...frames.values()];
      frames.clear();
      for (const frame of pending) frame(now);
    },
  };
}

describe("timeline playback clock", () => {
  it("updates at animation-frame cadence without losing elapsed time on slow frames", () => {
    const { clock, advance, onTime, frames } = setup(4);
    clock.start();
    advance(16);
    expect(onTime).toHaveBeenLastCalledWith(4.016);
    advance(584);
    expect(onTime).toHaveBeenLastCalledWith(4.6);
    expect(frames.size).toBe(1);
    clock.stop();
    expect(frames.size).toBe(0);
  });

  it("reanchors backward and forward seeks while playback continues", () => {
    const { clock, advance, onTime } = setup(4);
    clock.start();
    advance(100);
    clock.seek(12);
    advance(25);
    expect(onTime).toHaveBeenLastCalledWith(12.025);
    clock.seek(1);
    advance(25);
    expect(onTime).toHaveBeenLastCalledWith(1.025);
  });

  it("stops completely while paused and resumes from the same timeline position", () => {
    const { clock, advance, onTime } = setup(4);
    clock.start();
    advance(200);
    clock.stop();
    advance(5000);
    expect(onTime).toHaveBeenCalledTimes(1);
    clock.start();
    advance(100);
    expect(onTime).toHaveBeenLastCalledWith(4.3);
  });

  it("uses updated duration without resetting progress and stops exactly at the end", () => {
    const { clock, advance, onTime, onEnd, frames } = setup(0, 2);
    clock.start();
    advance(1500);
    clock.setDuration(4);
    advance(2000);
    expect(onTime).toHaveBeenLastCalledWith(3.5);
    expect(onEnd).not.toHaveBeenCalled();
    advance(1000);
    expect(onTime).toHaveBeenLastCalledWith(4);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
  });

  it("rejects stale callbacks after a project switch or a stop/start cycle", () => {
    const { clock, advance, onTime, frames } = setup(4);
    clock.start();
    const stale = [...frames.values()][0];
    clock.stop();
    clock.setDuration(10);
    clock.seek(2);
    clock.start();
    stale(9000);
    expect(onTime).not.toHaveBeenCalled();
    expect(frames.size).toBe(1);
    advance(20);
    expect(onTime).toHaveBeenLastCalledWith(2.02);
  });
});
