import { expect, it } from "vitest";
import { withFfmpegLease } from "./ffmpeg-lease";
it("serializes active renderers and removes canceled waiters without stopping the holder", async () => {
  const calls: string[] = [];
  let release!: () => void;
  const hold = new Promise<void>(resolve => {
    release = resolve;
  });
  const first = withFfmpegLease(new AbortController().signal, async () => {
    calls.push("first");
    await hold;
  });
  await Promise.resolve();
  await Promise.resolve();
  const canceled = new AbortController();
  const second = withFfmpegLease(canceled.signal, async () => {
    calls.push("canceled");
  });
  canceled.abort();
  await expect(second).rejects.toBeDefined();
  const third = withFfmpegLease(new AbortController().signal, async () => {
    calls.push("third");
  });
  expect(calls).toEqual(["first"]);
  release();
  await first;
  await third;
  expect(calls).toEqual(["first", "third"]);
});
