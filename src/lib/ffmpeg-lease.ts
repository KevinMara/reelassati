let tail: Promise<void> = Promise.resolve();

/** One foreground renderer at a time. Cancellation while waiting does not
 * terminate the holder or launch a deferred job after the caller returns. */
export async function withFfmpegLease<T>(
  signal: AbortSignal,
  work: () => Promise<T>
): Promise<T> {
  signal.throwIfAborted();
  const previous = tail;
  let release!: () => void;
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  tail = previous.then(() => held);
  let detach = () => {};
  try {
    await Promise.race([
      previous,
      new Promise<never>((_, reject) => {
        const abort = () =>
          reject(signal.reason ?? new DOMException("Canceled", "AbortError"));
        signal.addEventListener("abort", abort, { once: true });
        detach = () => signal.removeEventListener("abort", abort);
        if (signal.aborted) abort();
      }),
    ]);
    signal.throwIfAborted();
    return await work();
  } finally {
    detach();
    release();
  }
}
