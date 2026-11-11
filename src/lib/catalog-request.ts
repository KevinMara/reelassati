/** Bound a foreground transfer, including session resolution. Timers/listeners
 * are removed on every exit; canceled work cannot issue a later fetch. */
export async function catalogRequest<T>(
  request: (signal: AbortSignal) => Promise<T>,
  parent?: AbortSignal,
  bytes = 0
): Promise<T> {
  parent?.throwIfAborted();
  const controller = new AbortController();
  const cancel = () => controller.abort(parent?.reason);
  parent?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException("Catalog transfer timed out.", "TimeoutError")
      ),
    Math.max(120_000, Math.ceil(bytes / 65_536) * 1000)
  );
  let abort!: () => void;
  try {
    const stopped = new Promise<never>((_, reject) => {
      abort = () => reject(controller.signal.reason);
      controller.signal.addEventListener("abort", abort, { once: true });
      if (controller.signal.aborted) abort();
    });
    return await Promise.race([request(controller.signal), stopped]);
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", cancel);
    controller.signal.removeEventListener("abort", abort);
  }
}
